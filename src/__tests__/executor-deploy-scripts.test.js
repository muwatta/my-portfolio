// @vitest-environment node
//
// deploy.sh and firewall-executor.sh are the only instructions a host operator
// will follow, and neither is exercised by anything else in this repository.
//
// deploy.sh in particular is unparseable unless the quoting happens to be right.
// It shipped that way once: an apostrophe inside ${PUBLIC_HOST:?...}, inside
// double quotes, opens a single-quoted string as far as bash is concerned, so the
// whole script failed to parse and would have died on the first line it reached.
// These assertions are cheap and catch that class of mistake.

import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = (name) => readFileSync(`executor/${name}`, "utf8");
const deploy = read("deploy.sh");
const firewall = read("firewall-executor.sh");

describe("the deploy scripts parse", () => {
  it.each(["deploy.sh", "firewall-executor.sh"])("%s is valid shell", (name) => {
    const check = spawnSync("bash", ["-n", `executor/${name}`], { encoding: "utf8" });
    expect(check.stderr, check.stderr).toBe("");
    expect(check.status).toBe(0);
  });

  it.each(["deploy.sh", "firewall-executor.sh"])("%s is executable", (name) => {
    // An operator runs these by path.
    expect(statSync(`executor/${name}`).mode & 0o111).toBeTruthy();
  });

  it("has no apostrophe inside a parameter expansion message", () => {
    // The exact bug: bash treats a lone ' inside ${VAR:?...} as opening a single
    // quoted string, even within double quotes, and the script stops parsing.
    const expansions = [...deploy.matchAll(/\$\{[A-Z_]+:\?[^}]*\}/g)].map((m) => m[0]);
    expect(expansions.length).toBeGreaterThan(0);
    for (const expansion of expansions) {
      expect(expansion, expansion).not.toMatch(/'/);
    }
  });
});

describe("deploy.sh refuses to do anything half-finished", () => {
  const order = (needle) => deploy.indexOf(needle);

  // The call that actually configures Supabase, not the earlier mention of the
  // command inside the "not finished" message, which sits in the middle of the
  // script and made this look like the ordering was wrong when it was the test.
  const SECRETS_CALL = '( cd "$EXECUTOR_DIR/.." && npx supabase secrets set';
  const secretsCall = () => {
    const at = deploy.indexOf(SECRETS_CALL);
    expect(at, "deploy.sh does not call supabase secrets set").toBeGreaterThan(-1);
    return at;
  };

  it("checks the executor answers before it points Supabase at it", () => {
    // Otherwise Supabase is pointed at a URL that 404s or hangs, and every
    // submission comes back as a terminal grading_failed on work never attempted.
    expect(order('"http://127.0.0.1:${UPSTREAM_PORT}/health"')).toBeGreaterThan(-1);
    expect(secretsCall()).toBeGreaterThan(
      order('"http://127.0.0.1:${UPSTREAM_PORT}/health"'),
    );
  });

  it("checks a real program grades correctly before pointing Supabase at it", () => {
    expect(secretsCall()).toBeGreaterThan(order('grep -q \'"passed":true\''));
  });

  it("checks the token is actually enforced before pointing Supabase at it", () => {
    expect(secretsCall()).toBeGreaterThan(order("expected 401 for a bad token"));
  });

  it("refuses to continue until egress is blocked", () => {
    expect(secretsCall()).toBeGreaterThan(
      order("Has firewall-executor.sh been applied"),
    );
    expect(deploy).toMatch(/STOP\. Do not point Supabase at this yet\./);
  });

  it("never puts the token on a command line", () => {
    // A command line lands in the shell history and in ps output for every other
    // user on the box. The token is written to executor/.env and read from it.
    expect(deploy).not.toMatch(/EXECUTOR_TOKEN=\$\{?TOKEN/);
    expect(deploy).toMatch(/openssl rand -hex 32/);
    expect(deploy).toMatch(/cut -d= -f2-/);
  });

  it("stops with nothing configured rather than half-configured", () => {
    expect(deploy).toMatch(/Nothing has been set in Supabase, which is the safe state/);
  });
});

describe("the firewall script cuts egress without cutting ingress", () => {
  it("is idempotent enough to be re-applied after a daemon restart", () => {
    // Documented as a manual step rather than pretended to be persistent, and the
    // status subcommand exists so an operator can check.
    expect(firewall).toMatch(/status\)/);
    expect(firewall).toMatch(/remove\)/);
  });

  it("drops outbound traffic from the executor's network", () => {
    expect(firewall).toMatch(/-i "\$COMPOSE_NETWORK" ! -d "\$COMPOSE_NETWORK"/);
    expect(firewall).toMatch(/-o "\$COMPOSE_NETWORK" ! -s "\$COMPOSE_NETWORK"/);
  });

  it("returns established traffic so published ports still work", () => {
    // Without this the executor cannot answer the health check that deploy.sh
    // relies on to decide whether it is safe to continue.
    expect(firewall).toMatch(/ESTABLISHED,RELATED -j RETURN/);
  });

  it("explains why it exists, since an unexplained DROP gets disabled one day", () => {
    expect(firewall).toMatch(/CAP_SYS_ADMIN/);
    expect(firewall).toMatch(/DOCKER-USER/);
  });
});

describe("the deployment instructions match the compose file", () => {
  const compose = read("docker-compose.yml");

  it("uses the same upstream port the script probes", () => {
    expect(deploy).toMatch(/UPSTREAM_PORT="\$\{UPSTREAM_PORT:-8080\}"/);
    expect(compose).toMatch(/127\.0\.0\.1:8080:8080/);
  });

  it("publishes on loopback, and says why", () => {
    expect(compose).toMatch(/127\.0\.0\.1:8080:8080/);
    expect(deploy).toMatch(/never be published on a public interface directly/);
  });
});
