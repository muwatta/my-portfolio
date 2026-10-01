// A C++ executor for untrusted student code.
//
// It exists because the edge function that grades submissions is already written
// and already refuses to execute anything itself, correctly: a function that ran
// student code inside the request path would be one bad submission away from
// taking the grading service with it. So the missing half was always a separate
// sandbox, and this is it.
//
// Zero dependencies on purpose. This is the process that compiles and runs code
// written by children on the internet, so every line of it that is not strictly
// necessary is a liability. node:http, node:child_process, node:fs. Nothing else.
//
// Isolation is not optional and is not done here either. This process limits what
// it can do to its own children, and the container it runs in removes the
// network, the filesystem and the capabilities. See docker-compose.yml. A student
// who can read /etc/passwd or make an outbound request is a problem this file
// cannot solve on its own.

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";

const PORT = Number(process.env.PORT ?? 8080);
const TOKEN = process.env.EXECUTOR_TOKEN ?? "";
const COMPILER = process.env.CXX ?? "g++";

// Per-test wall clock. Long enough for a beginner to print something, short
// enough that a fork bomb or an infinite loop is a failed test rather than a
// dead executor.
const TEST_TIMEOUT_MS = Number(process.env.TEST_TIMEOUT_MS ?? 5000);
const COMPILE_TIMEOUT_MS = Number(process.env.COMPILE_TIMEOUT_MS ?? 15000);
const MAX_SOURCE_BYTES = 64 * 1024;
const MAX_TESTS = 40;
const MAX_INPUT_BYTES = 16 * 1024;
const MAX_STDOUT_BYTES = 256 * 1024;
// A runaway program filling memory is stopped by the cgroup, but a bound here
// stops it consuming the whole box before that happens.
const MAX_MEMORY_MB = Number(process.env.MAX_MEMORY_MB ?? 256);
const MAX_FILE_MB = 8;

if (!TOKEN) {
  console.error("EXECUTOR_TOKEN is required. Refusing to start without it.");
  process.exit(1);
}

function authorised(header) {
  const expected = Buffer.from(`Bearer ${TOKEN}`);
  const given = Buffer.from(String(header ?? ""));
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      // Refuse early rather than buffering an unbounded body.
      if (size > 4 * 1024 * 1024) {
        reject(new Error("request too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function send(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    // The verdict is about a submission and must not be cached anywhere.
    "cache-control": "no-store",
  });
  response.end(payload);
}

// Runs a command with hard limits and no shell, so nothing in the source or the
// test names can be interpreted as a command. The child's whole process group is
// killed on timeout, because a program that forks children would otherwise leave
// them running after the parent is gone.
function runLimited(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      // No shell, so nothing here is ever word-split or glob-expanded.
      shell: false,
      detached: true,
      env: {
        PATH: "/usr/bin:/bin",
        HOME: options.cwd,
        LANG: "C",
        // Nothing that changes how the compiler or the runtime finds libraries.
        LD_PRELOAD: "",
      },
    });

    let stdout = "";
    let stderr = "";
    let truncated = false;
    let settled = false;

    const collect = (which) => (chunk) => {
      const text = chunk.toString("utf8");
      if (which === "out") {
        if (stdout.length < MAX_STDOUT_BYTES) stdout += text;
        else truncated = true;
      } else if (stderr.length < MAX_STDOUT_BYTES) stderr += text;
    };
    child.stdout.on("data", collect("out"));
    child.stderr.on("data", collect("err"));

    // A child that exits without reading its stdin closes the pipe, and the
    // pending write then fails with EPIPE. That is ordinary, not exceptional:
    // most exercises print without reading anything. Left unhandled it is an
    // unhandled 'error' event, which takes down the whole executor, so a
    // student who submitted a program that ignores its input could take the
    // grading service offline for everyone.
    child.stdin.on("error", () => {
      /* the program did not read its input; nothing to do */
    });

    if (options.input !== undefined && !child.stdin.destroyed) {
      try {
        child.stdin.write(options.input);
        child.stdin.end();
      } catch {
        /* the pipe closed between the check and the write */
      }
    }

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      try {
        // Negative pid is the process group, so forked children go too.
        process.kill(-child.pid, "SIGKILL");
      } catch {
        /* already gone */
      }
      finish({ code: null, signal: "SIGKILL", stdout, stderr, timedOut: true });
    }, options.timeoutMs);

    child.on("error", (error) => {
      finish({ code: null, signal: null, stdout, stderr, spawnError: error.message });
    });
    child.on("close", (code, signal) => {
      finish({ code, signal, stdout, stderr, timedOut: false, truncated });
    });
  });
}

// How output is compared, stated plainly because it decides marks.
//
// Trailing whitespace on each line and a trailing newline at the end are
// ignored. Everything else is compared exactly, including spaces inside a line
// and the order of the lines. Loosening this any further would let wrong
// programs pass, and the whole point of a trusted executor is that it does not.
function normaliseOutput(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

function expectedText(expected) {
  if (expected === null || expected === undefined) return "";
  if (typeof expected === "string") return expected;
  if (Array.isArray(expected)) return expected.map((line) => String(line)).join("\n");
  return String(expected);
}

async function compile(directory, source) {
  const sourcePath = join(directory, "main.cpp");
  const binaryPath = join(directory, "main");
  await writeFile(sourcePath, source, "utf8");

  const result = await runLimited(
    COMPILER,
    [
      "-std=c++17",
      "-O0",
      "-o",
      binaryPath,
      sourcePath,
      // No exceptions we do not need, and no debug info, to keep the compile
      // inside its budget on a small box.
      "-w",
    ],
    { cwd: directory, timeoutMs: COMPILE_TIMEOUT_MS },
  );

  if (result.spawnError) return { ok: false, kind: "runtime_error", error: result.spawnError };
  if (result.timedOut) return { ok: false, kind: "timeout", error: "Compilation took too long." };
  if (result.code !== 0) {
    return {
      ok: false,
      kind: "syntax_error",
      error: (result.stderr || result.stdout || "Compilation failed.").slice(0, 4000),
    };
  }
  return { ok: true, binaryPath };
}

// Where compiled binaries are written.
//
// Split out from tmpdir() on purpose. The sandbox mounts /tmp noexec so that a
// student cannot stage a binary in the scratch area and run it, but the grader
// itself has to execute the one binary it just compiled. Writing to /tmp with
// noexec set means every submission fails, and silently: the compile succeeds and
// the exec is refused. The container gives the grader its own work directory that
// is writable and executable, and nothing else uses it.
const WORK_DIR = process.env.WORK_DIR || tmpdir();

async function grade(sourceCode, tests) {
  const directory = await mkdtemp(join(WORK_DIR, "grade-"));
  try {
    const compiled = await compile(directory, sourceCode);
    if (!compiled.ok) {
      return { status: compiled.kind, error: compiled.error, tests: [] };
    }

    const results = [];
    for (const test of tests) {
      const run = await runLimited(compiled.binaryPath, [], {
        cwd: directory,
        input: Array.isArray(test.input) ? `${test.input.join("\n")}\n` : String(test.input ?? ""),
        timeoutMs: TEST_TIMEOUT_MS,
      });

      if (run.spawnError) {
        results.push({ name: test.name, passed: false });
        continue;
      }
      if (run.timedOut) {
        // A timeout is a failed test rather than a verdict about the whole
        // submission, so one slow case does not discard the rest of the work.
        results.push({ name: test.name, passed: false });
        continue;
      }
      if (run.code !== 0) {
        results.push({ name: test.name, passed: false });
        continue;
      }
      const actual = normaliseOutput(run.stdout);
      const wanted = normaliseOutput(expectedText(test.expected));
      results.push({ name: test.name, passed: actual === wanted });
    }

    return { status: "completed", tests: results };
  } finally {
    // Never leave a student's source or a compiled binary lying around.
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

function validate(payload) {
  if (!payload || typeof payload !== "object") return "body must be an object";
  const { source_code: source, tests } = payload;
  if (typeof source !== "string" || source.trim() === "") return "source_code is required";
  if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) return "source_code is too large";
  if (!Array.isArray(tests) || tests.length === 0) return "at least one test is required";
  if (tests.length > MAX_TESTS) return `at most ${MAX_TESTS} tests`;
  for (const test of tests) {
    if (!test || typeof test.name !== "string" || test.name.trim() === "") {
      return "every test needs a name";
    }
    if (test.input !== undefined && !Array.isArray(test.input)) return "test input must be an array of lines";
    if (Array.isArray(test.input) && Buffer.byteLength(test.input.join("\n"), "utf8") > MAX_INPUT_BYTES) {
      return "test input is too large";
    }
    if (!Object.prototype.hasOwnProperty.call(test, "expected")) return "every test needs an expected value";
  }
  return null;
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    return send(response, 200, { status: "ok" });
  }
  if (request.method !== "POST" || request.url !== "/grade") {
    return send(response, 404, { status: "not_found" });
  }
  if (!authorised(request.headers.authorization)) {
    return send(response, 401, { status: "unauthorized" });
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(request));
  } catch (error) {
    return send(response, 400, { status: "invalid_request", error: error.message });
  }

  const problem = validate(payload);
  if (problem) return send(response, 400, { status: "invalid_request", error: problem });

  try {
    const verdict = await grade(payload.source_code, payload.tests);
    return send(response, 200, verdict);
  } catch (error) {
    // The executor failing is not the student's fault and must not be reported
    // as one, so this is a 5xx and the edge function keeps the submission in a
    // retryable state instead of failing it.
    return send(response, 500, { status: "executor_error", error: error.message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`C++ executor listening on :${PORT}`);
  console.log(`compiler: ${COMPILER}, per test timeout ${TEST_TIMEOUT_MS}ms, memory ${MAX_MEMORY_MB}MB`);
});
