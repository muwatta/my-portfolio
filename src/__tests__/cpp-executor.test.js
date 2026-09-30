// @vitest-environment node
//
// Runs the real executor against the real compiler, because this is the one
// component whose whole job is to compile and run code written by children on
// the internet. A mocked compiler would prove nothing about the one thing that
// has to be right.
//
// Skipped, loudly, when there is no C++ compiler, so the suite still passes on a
// machine without one rather than failing for a reason that has nothing to do
// with the code.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import { readFileSync } from "node:fs";

const SERVER = "executor/server.mjs";
const PORT = "8123";
const TOKEN = "vitest-executor-token";
const URL = `http://127.0.0.1:${PORT}/grade`;

const hasCompiler = spawnSync("g++", ["--version"], { stdio: "ignore" }).status === 0;
const suite = hasCompiler ? describe : describe.skip;

let server;

async function call(body, token = TOKEN) {
  const response = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

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

beforeAll(async () => {
  if (!hasCompiler) return;
  server = spawn("node", [SERVER], {
    env: { ...process.env, EXECUTOR_TOKEN: TOKEN, PORT, CXX: "g++" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve) => {
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes("listening")) resolve();
    });
    setTimeout(resolve, 4000);
  });
}, 20000);

afterAll(() => {
  server?.kill("SIGKILL");
});

suite("the C++ executor grades real programs", () => {
  it("refuses to start without a token", () => {
    // Checked by reading the source, because the alternative is starting a
    // server with no token and seeing whether it exits.
    const source = readFileSync(SERVER, "utf8");
    expect(source).toMatch(/if \(!TOKEN\)[\s\S]*process\.exit\(1\)/);
  });

  it("passes a correct program", async () => {
    const result = await call({ source_code: CORRECT, tests: TESTS, max_score: 10 });
    expect(result.status).toBe(200);
    expect(result.body.status).toBe("completed");
    expect(result.body.tests.every((test) => test.passed)).toBe(true);
  });

  it("fails the cases a wrong program gets wrong, without failing the ones it gets right", async () => {
    // Subtraction still answers 0 - 0 correctly. Scoring per test rather than per
    // program is what makes a partial mark possible at all.
    const result = await call({
      source_code: CORRECT.replace("a + b", "a - b"),
      tests: [...TESTS, { name: "adds 0 and 0", input: ["0", "0"], expected: "0" }],
      max_score: 10,
    });
    expect(result.body.tests.map((test) => test.passed)).toEqual([false, false, true]);
  });

  it("returns test names the caller can correlate", async () => {
    // The edge function refuses a result whose names do not line up, so this is
    // load-bearing rather than cosmetic.
    const result = await call({ source_code: CORRECT, tests: TESTS, max_score: 10 });
    expect(result.body.tests.map((test) => test.name)).toEqual(TESTS.map((test) => test.name));
  });

  it("reports a compile failure as a syntax error, with no test results", async () => {
    const result = await call({
      source_code: "int main() { this is not c++ }",
      tests: TESTS,
      max_score: 10,
    });
    expect(result.body.status).toBe("syntax_error");
    expect(result.body.tests).toEqual([]);
    expect(result.body.error).toBeTruthy();
  });

  it("stops an infinite loop and fails that test", async () => {
    const result = await call({
      source_code: "int main() { while (true) {} }",
      tests: [{ name: "hangs", input: [], expected: "x" }],
      max_score: 10,
    });
    expect(result.body.status).toBe("completed");
    expect(result.body.tests[0].passed).toBe(false);
  }, 25000);

  it("survives a program that crashes", async () => {
    const result = await call({
      source_code: "int main() { int* p = 0; *p = 1; return 0; }",
      tests: [{ name: "segv", input: [], expected: "x" }],
      max_score: 10,
    });
    expect(result.body.status).toBe("completed");
    // Still serving afterwards.
    const after = await call({ source_code: CORRECT, tests: TESTS, max_score: 10 });
    expect(after.body.status).toBe("completed");
  });

  it("rejects a request with the wrong token", async () => {
    const result = await call({ source_code: CORRECT, tests: TESTS }, "not-the-token");
    expect(result.status).toBe(401);
  });

  it("rejects a request with no tests rather than scoring nothing", async () => {
    const result = await call({ source_code: CORRECT, tests: [] });
    expect(result.status).toBe(400);
  });

  it("rejects a test with no expected value", async () => {
    // Otherwise a missing expectation could be read as "matches anything".
    const result = await call({
      source_code: CORRECT,
      tests: [{ name: "no expectation", input: ["1", "1"] }],
    });
    expect(result.status).toBe(400);
  });
});

describe("the executor's isolation is declared, not assumed", () => {
  const compose = readFileSync("executor/docker-compose.yml", "utf8");
  const dockerfile = readFileSync("executor/Dockerfile", "utf8");
  const server = readFileSync(SERVER, "utf8");

  it("has no network", () => {
    // The single most important line in the whole setup. A student program that
    // can open a socket reaches the grading service, the database, or anything
    // else reachable, and nothing inside the process compensates for that.
    expect(compose).toMatch(/network_mode: none/);
  });

  it("drops every capability and refuses privilege escalation", () => {
    expect(compose).toMatch(/cap_drop:\s*\n\s*- ALL/);
    expect(compose).toMatch(/no-new-privileges:true/);
  });

  it("writes nowhere except a noexec tmpfs", () => {
    expect(compose).toMatch(/read_only: true/);
    expect(compose).toMatch(/noexec/);
  });

  it("caps memory, cpu and process count", () => {
    expect(compose).toMatch(/mem_limit:/);
    expect(compose).toMatch(/cpus:/);
    expect(compose).toMatch(/pids_limit:/);
  });

  it("does not publish a port to the host", () => {
    // It is reached over the container network or an authenticated proxy, never
    // straight off the machine.
    expect(compose).not.toMatch(/^\s*ports:/m);
  });

  it("runs as an unprivileged user", () => {
    expect(dockerfile).toMatch(/USER executor/);
    expect(dockerfile).toMatch(/useradd/);
  });

  it("kills the whole process group, so forked children cannot outlive the test", () => {
    expect(server).toMatch(/process\.kill\(-child\.pid, "SIGKILL"\)/);
    expect(server).toMatch(/detached: true/);
  });

  it("never uses a shell, so source cannot become a command", () => {
    expect(server).toMatch(/shell: false/);
  });

  it("bounds the request body before buffering it", () => {
    expect(server).toMatch(/request too large/);
    expect(server).toMatch(/MAX_SOURCE_BYTES/);
  });

  it("has no dependencies to audit", () => {
    // Three node builtins is the whole runtime surface of the process that runs
    // untrusted code.
    const imports = [...server.matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1]);
    expect(imports.every((name) => name.startsWith("node:"))).toBe(true);
  });

  it("compares output exactly, apart from trailing whitespace", () => {
    // Loosening this is how a trusted executor starts handing out marks for
    // wrong programs, so the rule is asserted rather than left to the code.
    expect(server).toContain('.replace(/[ \\t]+$/, "")');
    expect(server).toContain('.replace(/\\n+$/, "")');
  });
});

describe("the edge function and the executor agree on the contract", () => {
  const edge = readFileSync(
    "supabase/functions/academy-grade-submission/index.ts",
    "utf8",
  );

  it("posts the three fields the executor reads", () => {
    expect(edge).toMatch(/source_code: submission\.source_code/);
    expect(edge).toMatch(/tests,/);
    expect(edge).toMatch(/max_score:/);
  });

  it("sends the bearer token the executor checks", () => {
    expect(edge).toMatch(/Authorization: `Bearer \$\{executorKey\}`/);
  });

  it("understands every status the executor returns", () => {
    expect(edge).toMatch(/const EXECUTOR_VERDICTS = \["syntax_error", "runtime_error", "timeout"\]/);
    expect(edge).toMatch(/result\?\.status === "completed"/);
  });

  it("reads the per-test names it correlates against", () => {
    expect(edge).toMatch(/expected\.includes\(test\.name\)/);
  });
});
