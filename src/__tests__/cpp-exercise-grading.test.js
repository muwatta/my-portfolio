// @vitest-environment node
//
// The 15 C++ programming exercises had tests = [], and there was a reason that
// was not obvious: they were not gradable. They were bare fragments with no
// includes and no main, 12 of them calling Arduino APIs, and 9 printing nothing
// at all, so there was no output to compare. Fixing the reference solutions was
// necessary and not sufficient.
//
// These assertions guard the properties that make the marking honest, and they
// deliberately check the reference solutions against a real g++ rather than
// against expected strings written by hand. A test that says "the average of
// 310, 420, 380, 450 and 330 is 378" is a claim; a test that compiles the
// reference and grades it is evidence.
//
// Skipped where there is no compiler, so the suite still passes on a machine
// without one.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import {
  EXERCISES,
  starterFor,
  solutionFor,
} from "../../scripts/lib/cpp-exercise-programs.mjs";

const PORT = "8093";
const TOKEN = "vitest-exercise-grading-token";
const hasCompiler = spawnSync("g++", ["--version"], { stdio: "ignore" }).status === 0;
const suite = hasCompiler ? describe : describe.skip;

let server;

const grade = async (sourceCode, tests) => {
  const response = await fetch(`http://127.0.0.1:${PORT}/grade`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_code: sourceCode,
      tests: tests.map((test) => ({
        name: test.name,
        input: test.input,
        expected: test.expected,
      })),
      max_score: 100,
    }),
  });
  return response.json();
};

beforeAll(async () => {
  if (!hasCompiler) return;
  server = spawn("node", ["executor/server.mjs"], {
    env: { ...process.env, EXECUTOR_TOKEN: TOKEN, PORT, CXX: "g++", TEST_TIMEOUT_MS: "6000" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Surface the server's own output. A silent "other side closed" is the
  // executor having died for a reason this file would otherwise hide.
  server.stderr.on("data", (chunk) => {
    process.stderr.write(`[executor] ${chunk}`);
  });
  server.on("exit", (code, signal) => {
    process.stderr.write(`[executor] exited code=${code} signal=${signal}\n`);
  });
  // Waiting on a timeout alone turns "the server never started" into a wall of
  // unrelated failures, because a bind conflict looks exactly like a slow boot.
  // An early exit is a real error and says so.
  await new Promise((resolve, reject) => {
    const failFast = (code, signal) =>
      reject(
        new Error(
          `executor exited before listening (code=${code} signal=${signal}); port ${PORT} may already be in use`,
        ),
      );
    server.on("exit", failFast);
    server.stdout.on("data", (chunk) => {
      if (!String(chunk).includes("listening")) return;
      server.off("exit", failFast);
      resolve();
    });
    setTimeout(resolve, 8000);
  });
}, 20000);

afterAll(() => {
  server?.kill("SIGKILL");
});

describe("the C++ exercise programs are complete", () => {
  it.each(EXERCISES)("$title is a whole program, not a fragment", (spec) => {
    for (const [label, source] of [
      ["starter", starterFor(spec)],
      ["solution", solutionFor(spec)],
    ]) {
      expect(source, label).toContain("#include <iostream>");
      expect(source, label).toContain("int main()");
      // The braces have to balance or nothing compiles, and the compiler is the
      // real check further down. This is the cheap one.
      const open = (source.match(/\{/g) || []).length;
      const close = (source.match(/\}/g) || []).length;
      expect(open, `${label} brace balance`).toBe(close);
    }
  });

  it.each(EXERCISES)("$title gives every case an expected value", (spec) => {
    for (const test of spec.tests) {
      expect(typeof test.expected, test.name).toBe("string");
      expect(test.expected.length, test.name).toBeGreaterThan(0);
    }
  });

  it.each(EXERCISES)("$title asks the student to do something", (spec) => {
    // A starter with no TODO is an exercise nobody has to attempt.
    expect(starterFor(spec)).toMatch(/TODO/);
  });

  it("keeps the WiFi exercise out, because no honest test exists for it", () => {
    // It needs a real association and the executor runs with no network. Rather
    // than a test that would pass or fail for reasons unrelated to the student.
    expect(EXERCISES.map((spec) => spec.title)).not.toContain(
      "ESP32 connection check",
    );
  });
});

suite("every reference solution passes its own tests", () => {
  it.each(EXERCISES)("$title", async (spec) => {
    const result = await grade(solutionFor(spec), spec.tests);
    expect(result.status, result.error || "").toBe("completed");
    const failed = (result.tests || []).filter((test) => !test.passed);
    expect(
      failed.map((test) => test.name),
    ).toEqual([]);
  }, 30000);
});

suite("no exercise is already solved", () => {
  it.each(EXERCISES)("$title starter code passes nothing", async (spec) => {
    // The check that catches a real failure mode: an exercise whose starter code
    // already produces the right answer is marked correct before the student
    // types anything.
    const result = await grade(starterFor(spec), spec.tests);
    const passed = (result.tests || []).filter((test) => test.passed);
    expect(passed.map((test) => test.name)).toEqual([]);
  }, 30000);
});

describe("the expected values are the arithmetic, not typos", () => {
  // Hand-checked against the exercise instructions. A generator that produced
  // whatever the compiler emitted would sail through the tests above even if the
  // reference itself were wrong, so the intent is asserted separately.
  const byTitle = Object.fromEntries(EXERCISES.map((spec) => [spec.title, spec]));
  const expectedFor = (title, name) =>
    byTitle[title].tests.find((test) => test.name === name)?.expected;

  it("the average of 310, 420, 380, 450 and 330 is 378, and the lowest is 310", () => {
    const readings = [310, 420, 380, 450, 330];
    expect(readings.reduce((a, b) => a + b, 0) / readings.length).toBe(378);
    expect(Math.min(...readings)).toBe(310);
    expect(expectedFor("Sensor readings summary", "averages the five readings and finds the lowest")).toBe(
      "Average: 378\nMinimum: 310\n",
    );
  });

  it("keeps the LED threshold strict, so >= fails the boundary", () => {
    // 400 is exactly the threshold, so the LED must be off. This is the case a
    // student gets wrong by writing >=.
    expect(expectedFor("Calibrated night light", "a reading at the threshold turns it off")).toContain(
      "digitalWrite 9 LOW",
    );
  });

  it("keeps the servo threshold strict too", () => {
    expect(expectedFor("Servo gate opener", "a reading at the threshold closes it")).toContain(
      "servo 9 0",
    );
  });

  it("shows the integer division trap in the data types exercise", () => {
    const out = expectedFor(
      "Data types quiz calculator",
      "types print, and 7/2 truncates while 7/2.0 does not",
    );
    expect(out.split("\n").slice(1, 3)).toEqual(["3", "3.5"]);
  });

  it("squares and tips correctly", () => {
    expect(expectedFor("Functions playground", "squares and tips a whole bill")).toBe("16\n20\n");
    expect(expectedFor("Functions playground", "squares a decimal and tips a fraction")).toBe("6.25\n5\n");
  });
});
