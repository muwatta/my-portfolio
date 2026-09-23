export const MAX_SOURCE_LENGTH = 50000;
export const MAX_TESTS = 50;
export const MAX_TEST_INPUT_LENGTH = 2000;

const dangerousPatterns = [
  /\b(?:import|from)\s+(?:os|sys|subprocess|socket|requests|urllib|pathlib)\b/i,
  /\b(?:eval|exec|compile|__import__|open)\s*\(/i,
  /\b(?:getattr|setattr|globals|locals)\s*\(/i,
];

export function validateGradingRequest({ sourceCode, tests }) {
  if (typeof sourceCode !== "string" || !sourceCode.trim())
    return { valid: false, error: "Submission source code is required." };
  if (sourceCode.length > MAX_SOURCE_LENGTH)
    return { valid: false, error: "Submission source code is too large." };
  if (!Array.isArray(tests) || tests.length === 0 || tests.length > MAX_TESTS)
    return { valid: false, error: "Assignment tests are invalid." };
  if (dangerousPatterns.some((pattern) => pattern.test(sourceCode)))
    return { valid: false, error: "Submission uses a restricted Python feature." };
  for (const test of tests) {
    if (
      !test ||
      typeof test.name !== "string" ||
      !test.name.trim() ||
      !Array.isArray(test.input) ||
      JSON.stringify(test.input).length > MAX_TEST_INPUT_LENGTH ||
      !Object.prototype.hasOwnProperty.call(test, "expected")
    ) {
      return { valid: false, error: "Assignment contains an invalid test." };
    }
  }
  return { valid: true };
}

export function calculateObjectiveScore({ passedTests, totalTests, maxScore }) {
  if (
    !Number.isInteger(passedTests) ||
    !Number.isInteger(totalTests) ||
    totalTests <= 0 ||
    passedTests < 0 ||
    passedTests > totalTests ||
    !Number.isFinite(maxScore) ||
    maxScore <= 0
  )
    throw new Error("Invalid deterministic grading totals.");
  return Number(((passedTests / totalTests) * maxScore).toFixed(2));
}

export async function gradeSubmission({ sourceCode, tests, maxScore, executor }) {
  const validation = validateGradingRequest({ sourceCode, tests });
  if (!validation.valid) {
    return {
      status: "grading_failed",
      error: validation.error,
      passed_tests: 0,
      total_tests: Array.isArray(tests) ? tests.length : 0,
    };
  }
  if (typeof executor !== "function")
    return { status: "grading_unavailable", error: "Executor is unavailable." };

  let execution;
  try {
    execution = await executor({ sourceCode, tests });
  } catch (error) {
    return {
      status: "grading_unavailable",
      error: error instanceof Error ? error.message : "Executor is unavailable.",
    };
  }
  if (!execution || execution.status !== "completed")
    return {
      status:
        ["syntax_error", "runtime_error", "timeout"].includes(execution?.status)
          ? "grading_failed"
          : "grading_unavailable",
      error: execution?.error || "Deterministic executor did not complete.",
    };
  if (
    !Array.isArray(execution.tests) ||
    execution.tests.length !== tests.length ||
    execution.tests.some(
      (test) => typeof test?.name !== "string" || typeof test.passed !== "boolean",
    )
  )
    return { status: "grading_failed", error: "Executor returned malformed results." };

  const passedTests = execution.tests.filter((test) => test.passed).length;
  return {
    status: "graded",
    passed_tests: passedTests,
    total_tests: tests.length,
    objective_score: calculateObjectiveScore({
      passedTests,
      totalTests: tests.length,
      maxScore,
    }),
    max_score: maxScore,
    tests: execution.tests.map(({ name, passed, message }) => ({
      name,
      passed,
      ...(message ? { message } : {}),
    })),
  };
}
