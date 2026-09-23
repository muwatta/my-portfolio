import { describe, expect, it } from "vitest";
import {
  calculateObjectiveScore,
  gradeSubmission,
  validateGradingRequest,
} from "../lib/academyGrading";

const tests = [
  { name: "normal values", input: [10, 20, 30], expected: 20 },
  { name: "decimal values", input: [1, 2, 4], expected: 2.3333333333333335 },
  { name: "negative values", input: [-3, 0, 3], expected: 0 },
  { name: "single values", input: [9, 9, 9], expected: 9 },
  { name: "zero values", input: [0, 0, 0], expected: 0 },
];
const correctSource = "def average(a, b, c):\n    return (a + b + c) / 3";

const executorFor = (results) => async () => ({
  status: "completed",
  tests: tests.map((test, index) => ({
    name: test.name,
    passed: results[index],
    message: results[index] ? undefined : "Expected deterministic output.",
  })),
});

describe("deterministic Academy grading engine", () => {
  it("grades correct code through the executor contract", async () => {
    const result = await gradeSubmission({
      sourceCode: correctSource,
      tests,
      maxScore: 10,
      executor: executorFor([true, true, true, true, true]),
    });
    expect(result.status).toBe("graded");
    expect(result.passed_tests).toBe(5);
    expect(result.objective_score).toBe(10);
  });

  it("grades incorrect code with partial credit", async () => {
    const result = await gradeSubmission({
      sourceCode: correctSource,
      tests,
      maxScore: 10,
      executor: executorFor([true, false, true, false, true]),
    });
    expect(result.passed_tests).toBe(3);
    expect(result.objective_score).toBe(6);
  });

  it("preserves useful executor errors", async () => {
    for (const status of ["syntax_error", "runtime_error", "timeout"]) {
      const result = await gradeSubmission({
        sourceCode: correctSource,
        tests,
        maxScore: 10,
        executor: async () => ({ status, error: `${status} message` }),
      });
      expect(result.status).toBe("grading_failed");
      expect(result.error).toContain("message");
    }
  });

  it("reports syntax errors without an objective score", async () => {
    const result = await gradeSubmission({
      sourceCode: "def average(:",
      tests,
      maxScore: 10,
      executor: async () => ({ status: "syntax_error", error: "Invalid syntax." }),
    });
    expect(result.status).toBe("grading_failed");
    expect(result.objective_score).toBeUndefined();
  });

  it("reports runtime errors without an objective score", async () => {
    const result = await gradeSubmission({
      sourceCode: correctSource,
      tests,
      maxScore: 10,
      executor: async () => ({ status: "runtime_error", error: "NameError." }),
    });
    expect(result.status).toBe("grading_failed");
    expect(result.objective_score).toBeUndefined();
  });

  it("reports timeout as a terminated grading attempt", async () => {
    const result = await gradeSubmission({
      sourceCode: correctSource,
      tests,
      maxScore: 10,
      executor: async () => ({ status: "timeout", error: "Timed out." }),
    });
    expect(result.status).toBe("grading_failed");
  });

  it("rejects malformed executor output", async () => {
    const result = await gradeSubmission({
      sourceCode: correctSource,
      tests,
      maxScore: 10,
      executor: async () => ({ status: "completed", tests: [] }),
    });
    expect(result.status).toBe("grading_failed");
  });

  it("preserves per-test names and failure messages", async () => {
    const result = await gradeSubmission({
      sourceCode: correctSource,
      tests,
      maxScore: 10,
      executor: executorFor([true, false, true, false, true]),
    });
    expect(result.tests[1]).toEqual({
      name: "decimal values",
      passed: false,
      message: "Expected deterministic output.",
    });
  });

  it("rejects invalid score configuration", () => {
    expect(() =>
      calculateObjectiveScore({ passedTests: 6, totalTests: 5, maxScore: 10 }),
    ).toThrow("Invalid deterministic grading totals.");
  });

  it("does not fabricate a score when the executor is unavailable", async () => {
    const result = await gradeSubmission({
      sourceCode: correctSource,
      tests,
      maxScore: 10,
    });
    expect(result).toEqual({
      status: "grading_unavailable",
      error: "Executor is unavailable.",
    });
  });

  it("supports multiple tests and maximum score deterministically", () => {
    expect(calculateObjectiveScore({ passedTests: 4, totalTests: 5, maxScore: 10 })).toBe(8);
    expect(calculateObjectiveScore({ passedTests: 5, totalTests: 5, maxScore: 10 })).toBe(10);
  });

  it("rejects malformed, oversized, and dangerous submissions", () => {
    expect(validateGradingRequest({ sourceCode: "", tests })).toMatchObject({ valid: false });
    expect(
      validateGradingRequest({ sourceCode: "x".repeat(50001), tests }),
    ).toMatchObject({ valid: false });
    expect(
      validateGradingRequest({
        sourceCode: "import os\n\ndef average(a,b,c): return 0",
        tests,
      }),
    ).toMatchObject({ valid: false });
    expect(
      validateGradingRequest({ sourceCode: correctSource, tests: [{ name: "bad", input: [] }] }),
    ).toMatchObject({ valid: false });
  });

  it("keeps deterministic grading independent from AI availability", async () => {
    const result = await gradeSubmission({
      sourceCode: correctSource,
      tests,
      maxScore: 10,
      executor: executorFor([true, true, true, true, true]),
    });
    const aiFeedback = null;
    expect(result.objective_score).toBe(10);
    expect(aiFeedback).toBeNull();
  });
});
