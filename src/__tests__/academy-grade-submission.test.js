import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("supabase/functions/academy-grade-submission/index.ts", "utf8");

describe("the trusted grader reports failures honestly", () => {
  it("treats untrustworthy executor output as a terminal failure, not an outage", () => {
    // This is the bug that mattered. Unverifiable output used to be reported as
    // grading_unavailable, a 503, which is a retryable state. The submission
    // would then retry forever and no teacher would ever be shown a reason.
    expect(src).toMatch(/results that could not be verified/);
    expect(src).toMatch(/return fail\(\s*serviceClient,\s*submission\.id,\s*"Trusted executor returned results/);
  });

  it("reserves grading_unavailable for the executor being genuinely unreachable", () => {
    // Network failure, timeout and 5xx are ours to retry. A verdict is not.
    const unavailable = [...src.matchAll(/status: "grading_unavailable"/g)].length;
    expect(unavailable).toBeGreaterThan(0);
    expect(src).toMatch(/if \(!response\.ok\)[\s\S]*?grading_unavailable/);
    expect(src).toMatch(/catch \(error\)[\s\S]*?grading_unavailable/);
  });

  it("does not let a failed result write report success", () => {
    // Previously the upsert error was thrown into a catch that only set an
    // unavailable state, so a 200 could be returned for a grade that was
    // never written.
    expect(src).toMatch(/if \(resultError\)\s*\n?\s*return json\(\{ status: "grading_unavailable", error: "Could not record the grade\." \}, 503\)/);
  });
});

describe("the trusted grader cannot be used to manufacture a grade", () => {
  it("refuses executor output whose test names do not match the assignment", () => {
    expect(src).toMatch(/returned\.every\(\(test: \{ name: string \}\) => expected\.includes\(test\.name\)\)/);
  });

  it("checks the set size, so duplicated names cannot pad the total", () => {
    expect(src).toMatch(/new Set\(returned\.map\(\(test: \{ name: string \}\) => test\.name\)\)\.size === new Set\(expected\)\.size/);
  });

  it("grades a submission at most once, so the endpoint cannot be used to burn executor time", () => {
    // Nothing else limited how often a student could ask for the same code to
    // be re-executed.
    expect(src).toMatch(/graded at most once/);
    expect(src).toMatch(/cached: true/);
  });

  it("only authorises the owner, a teacher, or an administrator", () => {
    expect(src).toMatch(
      /submission\.student_id !== userResult\.user\.id && !isTeacher && !isAdmin\)\s*\n\s*return json\(\{ error: "Submission access denied\." \}, 403\)/,
    );
  });
});

describe("the grader does not pretend to be a sandbox", () => {
  it("documents the pattern filter as a pre-filter, not a security boundary", () => {
    // The patterns are trivially bypassed. The real boundary is that student
    // code is never executed in this function at all.
    expect(src).toMatch(/not a security boundary/);
    expect(src).toMatch(/trivially bypassed/);
    expect(src).toMatch(/never executes student code at all/);
  });

  it("keeps the obvious pre-filter", () => {
    expect(src).toMatch(/restricted Python feature/);
  });
});

describe("the grader refuses to run without an executor", () => {
  it("fails closed when no executor is configured", () => {
    expect(src).toMatch(
      /if \(!executorUrl \|\| !executorKey\)\s*\n\s*return json\(\{ status: "grading_unavailable" \}, 503\)/,
    );
  });

  it("never invents a score when the executor is absent", () => {
    const beforeCheck = src.slice(0, src.indexOf("if (!executorUrl"));
    expect(beforeCheck).not.toMatch(/objective_score/);
  });

  it("keeps the source and test ceilings", () => {
    expect(src).toMatch(/const MAX_SOURCE_LENGTH = 50_000/);
    expect(src).toMatch(/const MAX_TESTS = 50/);
  });
});
