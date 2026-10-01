// @vitest-environment node
//
// Runs the built container, because three faults in this sandbox were invisible
// until the image was actually built and started:
//
//   1. `network_mode: none` made the service unreachable. No network interfaces
//      means no ingress either, so the edge function could never call it. It read
//      like the most secure line in the file and was the one that could not work.
//   2. Docker mounts every --tmpfs noexec by default. The grader compiles into
//      its work directory and then has to execute it, so every submission failed
//      with no error shown: the compile succeeded and the exec was refused, which
//      is indistinguishable from a wrong answer.
//   3. A tmpfs is mounted root-owned, so mkdtemp failed EACCES for a non-root
//      executor.
//
// Asserted here rather than in prose, so a change to the Dockerfile or the
// compose file cannot quietly reintroduce any of them.
//
// Skipped when there is no Docker daemon or no image, so the suite still passes
// on a machine without one.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

const IMAGE = "academy-cpp-executor:test";
const PORT = "8087";
const TOKEN = "container-test-token";

const dockerAvailable =
  spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;
const imageBuilt =
  dockerAvailable &&
  spawnSync("docker", ["image", "inspect", IMAGE], { stdio: "ignore" }).status === 0;
const suite = imageBuilt ? describe : describe.skip;

const CORRECT = `#include <iostream>
using namespace std;
int main() {
  int a, b;
  cin >> a >> b;
  cout << a + b << endl;
  return 0;
}`;

const TESTS = [
  { name: "adds 2 and 3", input: ["2", "3"], expected: "5" },
  { name: "adds 10 and -4", input: ["10", "-4"], expected: "6" },
];

let container = null;

const grade = async (sourceCode, tests = TESTS) => {
  const response = await fetch(`http://127.0.0.1:${PORT}/grade`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ source_code: sourceCode, tests, max_score: 10 }),
  });
  return response.json();
};

/** Run a command inside the container as its own unprivileged user. */
const inside = (command) =>
  spawnSync("docker", ["exec", container, "sh", "-c", command], {
    encoding: "utf8",
  }).stdout.trim();

beforeAll(() => {
  if (!imageBuilt) return;
  spawnSync("docker", ["rm", "-f", container], { stdio: "ignore" });
  const run = spawnSync(
    "docker",
    [
      "run", "-d", "--name", container,
      "-p", `127.0.0.1:${PORT}:8080`,
      "--read-only",
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges:true",
      // The two --tmpfs defaults that matter, spelled out.
      "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
      "--tmpfs", "/work:rw,exec,nosuid,size=64m,uid=10001,gid=10001,mode=0750",
      "--pids-limit", "128",
      "--memory", "512m",
      "--cpus", "1.0",
      "-e", `EXECUTOR_TOKEN=${TOKEN}`,
      "-e", "WORK_DIR=/work",
      IMAGE,
    ],
    { encoding: "utf8" },
  );
  if (run.status !== 0) throw new Error(run.stderr);
  // Wait for the listener rather than sleeping and hoping.
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const health = spawnSync("docker", [
      "exec", container, "node", "-e",
      `fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`,
    ]);
    if (health.status === 0) return;
  }
  throw new Error("executor container never became healthy");
}, 60000);

afterAll(() => {
  if (container) spawnSync("docker", ["rm", "-f", container], { stdio: "ignore" });
});

suite("the container can be reached", () => {
  it("answers the health check over the published port", async () => {
    const response = await fetch(`http://127.0.0.1:${PORT}/health`);
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("ok");
  });

  it("rejects a wrong token", async () => {
    const response = await fetch(`http://127.0.0.1:${PORT}/grade`, {
      method: "POST",
      headers: { Authorization: "Bearer wrong", "Content-Type": "application/json" },
      body: JSON.stringify({ source_code: CORRECT, tests: TESTS, max_score: 10 }),
    });
    expect(response.status).toBe(401);
  });
});

suite("the container can actually run what it compiles", () => {
  // The fault this exists for. With --tmpfs mounted noexec, /work refused exec
  // and this returned passed:false for a correct program, which looks exactly
  // like a student getting the answer wrong.
  it("passes a correct program", async () => {
    const result = await grade(CORRECT);
    expect(result.status).toBe("completed");
    expect(result.tests.map((test) => test.passed)).toEqual([true, true]);
  });

  it("fails a wrong program", async () => {
    const result = await grade("#include <iostream>\nint main(){std::cout<<5<<std::endl;}");
    expect(result.tests.some((test) => test.passed)).toBe(true);
    expect(result.tests.filter((test) => !test.passed).length).toBeGreaterThan(0);
  });

  it("enforces the timeout rather than hanging", async () => {
    const started = Date.now();
    const result = await grade("int main() { while (true) {} }", [
      { name: "hangs", input: [], expected: "x" },
    ]);
    const elapsed = Date.now() - started;
    expect(result.status).toBe("completed");
    expect(result.tests[0].passed).toBe(false);
    // The default is 5000ms. Allow slack for compile time on a loaded machine,
    // but not so much that a killed-and-failing-exec would pass for a timeout:
    // a refused exec returns in well under a second.
    expect(elapsed).toBeGreaterThan(3000);
    expect(elapsed).toBeLessThan(30000);
  }, 45000);

  it("survives a crash and keeps serving", async () => {
    await grade("int main() { int* p = 0; *p = 1; }", [
      { name: "segv", input: [], expected: "" },
    ]);
    const after = await grade(CORRECT);
    expect(after.tests.map((test) => test.passed)).toEqual([true, true]);
  });

  it("reports a compile failure as a syntax error", async () => {
    const result = await grade("int main() { this is not c++ }");
    expect(result.status).toBe("syntax_error");
    expect(result.tests).toEqual([]);
  });
});

suite("the container's isolation actually holds", () => {
  it("has no capabilities left", () => {
    const caps = inside("grep CapEff /proc/self/status");
    expect(caps).toMatch(/CapEff:\s+0{16}/);
  });

  it("does not run as root", () => {
    expect(inside("id -u")).not.toBe("0");
    expect(inside("id -un")).toBe("executor");
  });

  it("has a read-only root filesystem", () => {
    // Both paths must refuse a write. The earlier run only proved /app.
    expect(inside("touch /app/x 2>&1 || true")).toMatch(/Read-only/);
    expect(inside("touch /etc/x 2>&1 || true")).toMatch(/Read-only/);
  });

  it("cannot execute anything from the scratch tmpfs", () => {
    expect(inside("grep ' /tmp ' /proc/mounts")).toMatch(/noexec/);
    expect(inside("cp /bin/cat /tmp/c 2>/dev/null; chmod +x /tmp/c; /tmp/c --help 2>&1 || true"))
      .toMatch(/Permission denied|not found/);
  });

  it("can execute in the work directory, which is the point of the split", () => {
    // The mirror image of the test above. If this ever stops working, every
    // submission fails with no explanation.
    expect(inside("grep ' /work ' /proc/mounts")).not.toMatch(/noexec/);
    const output = inside(
      'mkdir -p /work/t && printf "int main(){return 7;}" > /work/t/a.c && ' +
        'gcc -o /work/t/a /work/t/a.c && /work/t/a; echo "exit=$?"',
    );
    expect(output).toMatch(/exit=7/);
  });

  it("has the memory, process and cpu caps it claims", () => {
    const inspect = JSON.parse(
      spawnSync("docker", ["inspect", container], { encoding: "utf8" }).stdout,
    )[0].HostConfig;
    expect(inspect.PidsLimit).toBe(128);
    expect(inspect.Memory).toBe(512 * 1024 * 1024);
    expect(inspect.NanoCpus).toBe(1e9);
  });

  it("has the g++ the whole thing depends on", () => {
    expect(inside("g++ --version | head -1")).toMatch(/g\+\+/);
  });
});