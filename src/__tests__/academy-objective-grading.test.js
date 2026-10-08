import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATIONS = "supabase/migrations";
const allSql = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(`${MIGRATIONS}/${name}`, "utf8"))
  .join("\n");

const matches = [
  ...allSql.matchAll(
    /create or replace function public\.academy_submit_objective_answer\([\s\S]*?\$\$;/g,
  ),
];
const fn = matches.at(-1)[0];
const overloadFix = readFileSync(
  "supabase/migrations/20261362000000_academy_objective_rpc_overload_fix.sql",
  "utf8",
);

describe("objective grading checks access before scoring", () => {
  // A student who learned an exercise uuid could be graded on, and earn points
  // for, a topic whose prerequisites they had not reached, which is exactly what
  // the prerequisite system exists to prevent.
  it("reuses the single source of truth for lesson access", () => {
    expect(fn).toMatch(
      /if not public\.academy_lesson_is_unlocked_for_student\(auth\.uid\(\), exercise_row\.lesson_id\) then/,
    );
    expect(fn).toMatch(/raise exception 'This topic is not unlocked for you yet'/);
  });

  it("checks access before it scores anything", () => {
    const accessAt = fn.indexOf("academy_lesson_is_unlocked_for_student");
    const insertAt = fn.indexOf("insert into public.academy_exercise_attempts");
    expect(accessAt).toBeGreaterThan(-1);
    expect(accessAt).toBeLessThan(insertAt);
  });

  it("still refuses programming exercises", () => {
    expect(fn).toMatch(
      /if exercise_row\.question_type = 'programming' then\s*raise exception 'Programming exercises require the isolated grader'/,
    );
  });
});

describe("objective grading cannot be handed free credit", () => {
  // lower(trim(coalesce(submitted,''))) = lower(trim(coalesce(correct,'')))
  // marked any empty submission correct when correct_answer was null, awarding
  // points for nothing. The 105 all have an answer, so it was not reachable
  // today, but it silently manufactures a correct mark for any future exercise
  // authored without one.
  it("refuses an exercise that has no answer key", () => {
    expect(fn).toMatch(
      /if exercise_row\.correct_answer is null or btrim\(exercise_row\.correct_answer\) = '' then/,
    );
    expect(fn).toMatch(/raise exception 'This exercise has no answer key/);
  });

  it("compares against the answer key without coalescing it to empty", () => {
    expect(fn).toMatch(
      /is_correct := lower\(trim\(submitted_answer\)\) = lower\(trim\(exercise_row\.correct_answer\)\)/,
    );
    expect(fn).not.toMatch(/coalesce\(exercise_row\.correct_answer/);
  });
});

describe("attempt limits hold", () => {
  it("coalesces a null limit instead of comparing against null", () => {
    // attempt_count >= null is never true, so a null limit meant unlimited.
    expect(fn).toMatch(
      /if attempt_count >= coalesce\(exercise_row\.attempt_limit, 3\) then/,
    );
  });
});

describe("objective grading stays server side and unfakeable", () => {
  it("compares answers in a security definer, never in the browser", () => {
    expect(fn).toMatch(/security definer/);
    expect(fn).toMatch(/set search_path = public/);
  });

  it("leaves no direct write path for students", () => {
    expect(allSql).toMatch(
      /revoke insert, update, delete on public\.academy_exercise_attempts from authenticated/,
    );
  });

  it("scopes reads to the student who owns the attempt", () => {
    expect(allSql).toMatch(
      /on public\.academy_exercise_attempts[\s\S]*?for select to authenticated using \(student_id = auth\.uid\(\)\)/,
    );
  });

  it("removes the legacy overload that makes RPC resolution ambiguous", () => {
    expect(overloadFix).toMatch(
      /drop function if exists public\.academy_submit_objective_answer\(uuid, text\)/,
    );
    expect(overloadFix).toMatch(/notify pgrst, 'reload schema'/);
  });

  it("keeps offline retries idempotent", () => {
    expect(fn).toMatch(/client_operation_key/);
    expect(fn).toMatch(/client_operation_id = client_operation_key/);
  });
});
