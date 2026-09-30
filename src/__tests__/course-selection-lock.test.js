import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Both are live-verified in scripts/e2e-exam.mjs with a real signed-in student.
// These guard the reasoning, so a future change cannot quietly reintroduce the
// two ways this broke.
const scope = readFileSync(
  "supabase/migrations/20261310000000_course_lock_scope.sql",
  "utf8",
);
const idempotent = readFileSync(
  "supabase/migrations/20261311000000_course_lock_idempotent.sql",
  "utf8",
);
const e2e = readFileSync("scripts/e2e-exam.mjs", "utf8");

// These migrations explain the bug in their headers, which means they quote the
// old code. Assertions about what is gone have to be made against the SQL.
const code = (migration) =>
  migration
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

describe("the lock matches the index it is protecting", () => {
  it("looks for any active enrollment, not only programming ones", () => {
    // The partial unique index is on (student_id) where status = 'active' and
    // is not filtered by course family. Filtering the lookup to programming
    // courses is how a student passed the friendly check and then saw a raw
    // duplicate-key error from the index.
    //
    // Scoped to academy_select_course on purpose. The guard trigger still checks
    // is_programming_course, and it should: that is the rule it exists to
    // enforce. Only the lookup has to match the index.
    const lock = code(idempotent).slice(
      code(idempotent).indexOf("create or replace function public.academy_select_course"),
    );
    const lines = lock.split("\n").map((line) => line.trim());
    const at = lines.findIndex((line) => line.includes("select e.course_id into v_active_course_id"));
    expect(at).toBeGreaterThan(-1);
    const lookup = lines.slice(at, at + 4).join(" ");
    expect(lookup).toContain("e.status = 'active'");
    expect(lookup).not.toContain("is_programming_course");
  });

  it("and the guard trigger keeps enforcing the programming rule", () => {
    // The other half of the pair: narrowing the lookup must not quietly drop
    // the rule the index does not state.
    const guard = code(idempotent).slice(
      0,
      code(idempotent).indexOf("create or replace function public.academy_select_course"),
    );
    expect(guard).toContain("c.is_programming_course = true");
  });

  it("checks availability of the course being selected", () => {
    // Kept from the original definition: a student should not be able to enrol
    // in a draft or deactivated course by guessing its id.
    const lines = code(scope).split("\n").map((line) => line.trim());
    expect(lines.some((line) => line.includes("published and is_active"))).toBe(true);
  });

  it("turns a lost race into the same friendly message", () => {
    // The check is not atomic, so two clicks can both pass it. The index is the
    // only thing that settles that, and a student should not see the database's
    // wording for it.
    expect(idempotent).toMatch(/exception\s+when unique_violation then/);
    expect(idempotent).toMatch(/Your current course is locked/);
  });
});

describe("selecting the course you are already on", () => {
  it("reuses the existing row instead of upserting", () => {
    // The upsert is what broke it. Postgres runs the BEFORE INSERT trigger
    // speculatively with a freshly generated id, so the guard saw the student's
    // own enrollment as a second one and refused. Verified live: this used to
    // return 400 "A student cannot have more than one active programming-course
    // enrollment at the same time" for the course the student was on.
    expect(code(idempotent)).not.toMatch(/on conflict \(student_id, course_id\) do update/);
    expect(idempotent).toMatch(
      /select \* into selected_enrollment\s+from public\.academy_enrollments\s+where student_id = target_student_id and course_id = target_course_id/,
    );
  });

  it("reactivates a withdrawn row rather than making a second one", () => {
    expect(idempotent).toMatch(
      /update public\.academy_enrollments\s+set status = 'active'\s+where id = selected_enrollment\.id/,
    );
  });

  it("guards the trigger on the course, not the row id", () => {
    // On an upsert the row being replaced is not in the table under its own id
    // yet, so an id comparison misfires. The pair still catches a genuine second
    // enrollment, which is by definition a different course.
    expect(idempotent).toMatch(
      /and \(e\.student_id, e\.course_id\) <> \(new\.student_id, new\.course_id\)/,
    );
    expect(code(idempotent)).not.toMatch(/e\.id <> new\.id/);
  });
});

describe("the lock is checked in the live run", () => {
  it("covers select, re-select, and being refused a second course", () => {
    expect(e2e).toMatch(/a student can select a course/);
    expect(e2e).toMatch(/selecting the course they are already on is allowed and changes nothing/);
    expect(e2e).toMatch(/and leaves exactly one active enrollment, not two/);
    expect(e2e).toMatch(/selecting a different course is refused/);
    expect(e2e).toMatch(/with the friendly locked message rather than a database error/);
  });

  it("clears enrollments before deleting users, or cleanup is refused", () => {
    // academy_enrollments.student_id references auth.users, and the selection
    // test creates one. The cleanup check failing is how this was found.
    expect(e2e).toMatch(/academy_enrollments\?student_id=eq\.\$\{id\}/);
  });
});
