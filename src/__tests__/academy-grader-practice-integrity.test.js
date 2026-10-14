import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261410000000_academy_grader_permissions.sql",
  "utf8",
);
const practiceGenerator = readFileSync(
  "supabase/functions/academy-generate-practice/index.ts",
  "utf8",
);
const gradingQueue = readFileSync(
  "supabase/migrations/20261412000000_academy_grader_queue.sql",
  "utf8",
);

describe("manual grading authorization", () => {
  it("separates graders from teachers and limits appointment to the superadmin", () => {
    expect(migration).toMatch(/create table if not exists public\.academy_graders/);
    expect(migration).toMatch(/create or replace function public\.academy_can_grade/);
    expect(migration).toMatch(/if not public\.academy_is_admin\(\) then/);
    expect(migration).toMatch(/Only the superadmin can appoint or remove graders/);
  });

  it("guards direct result writes as well as UI calls", () => {
    expect(migration).toMatch(/create trigger academy_submission_results_manual_grade_guard/);
    expect(migration).toMatch(/not public\.academy_can_grade\(\)/);
    expect(gradingQueue).toMatch(/if not public\.academy_can_grade\(\)/);
  });
});

describe("practice question uniqueness", () => {
  it("normalizes prompts and rejects duplicate prepared questions", () => {
    expect(practiceGenerator).toMatch(/function normaliseQuestionText/);
    expect(practiceGenerator).toMatch(/function deduplicateQuestions/);
    expect(practiceGenerator).toMatch(/deduplicateQuestions\(preparedQuestions/);
  });

  it("rejects duplicate generated prompts and requires a complete prepared set", () => {
    expect(practiceGenerator).toMatch(/deduplicateQuestions\(validQuestions\)\.length === QUESTION_COUNT/);
    expect(practiceGenerator).toMatch(/selectedQuestions\.length === QUESTION_COUNT/);
  });
});
