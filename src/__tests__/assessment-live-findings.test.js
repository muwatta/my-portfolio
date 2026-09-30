import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every check in this file guards a fault that unit tests with a mocked Supabase
// client could not see. Each one had a passing test suite while the feature was
// broken in production, because the mock agreed with whatever the code asked for.
// The live script scripts/e2e-exam.mjs is what actually found them.
const resume = readFileSync(
  "supabase/migrations/20261302000000_exam_attempt_resume.sql",
  "utf8",
);
const staffReads = readFileSync(
  "supabase/migrations/20261300000000_exam_staff_read_functions.sql",
  "utf8",
);
const authorTrigger = readFileSync(
  "supabase/migrations/20261301000000_exam_question_author_trigger.sql",
  "utf8",
);
const lib = readFileSync("src/lib/academy.js", "utf8");
const e2e = readFileSync("scripts/e2e-exam.mjs", "utf8");

// These files explain themselves at length, which is worth having but means a
// regex over the raw text can match a sentence in a comment instead of the SQL.
// Two checks below were caught doing exactly that, so the comments come off first.
function code(migration) {
  return migration
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("an interrupted attempt can be resumed", () => {
  it("returns the live attempt instead of refusing once the count is used up", () => {
    // This was the worst of the four. The count included the attempt still in
    // progress, so on a one-attempt paper a student who refreshed was told they
    // had used their attempt and could not get back into their own paper.
    expect(resume).toMatch(/and status = 'in_progress'/);
    expect(resume).toMatch(/return existing_attempt/);
  });

  it("checks for a live attempt before it checks the attempt limit", () => {
    // Order is the whole fix. Reordered, the limit refuses first and nothing
    // downstream is reached. Compared against the executable text, because the
    // header comment quotes the very error message being looked for.
    const body = code(resume);
    const resumeAt = body.indexOf("return existing_attempt");
    const limitAt = body.indexOf("You have used all");
    expect(resumeAt).toBeGreaterThan(-1);
    expect(limitAt).toBeGreaterThan(-1);
    expect(resumeAt).toBeLessThan(limitAt);
  });

  it("does not move the deadline when resuming", () => {
    // Returning the row unchanged is the point. Recomputing deadline_at here
    // would hand unlimited extra time to anyone who reopened the paper.
    expect(resume).toMatch(/existing_attempt\.deadline_at > now\(\)/);
    expect(resume).toMatch(/Returned unchanged\. deadline_at in particular is not refreshed/);
    expect(resume).not.toMatch(/update public\.academy_exam_attempts[\s\S]{0,200}deadline_at =/);
  });

  it("banks the work before refusing an attempt already past its deadline", () => {
    expect(resume).toMatch(/perform public\.academy_exam_auto_submit_expired\(\)/);
    expect(resume).toMatch(/raise exception 'Time is up for this examination\.'/);
  });

  it("still keeps the limit for genuinely exhausted attempts", () => {
    expect(resume).toMatch(/taken >= exam_row\.max_attempts/);
  });
});

describe("the question bank is writable again", () => {
  it("grants the table privilege the RLS policy assumed", () => {
    // A policy does not grant access. The policy allowed teachers, the
    // privilege had been revoked, and every list, create, edit and archive call
    // in the admin question bank failed.
    expect(staffReads).toMatch(
      /grant select, insert, update, delete\s+on public\.academy_exam_questions to authenticated/,
    );
  });

  it("stamps the author, which is not null and was never supplied", () => {
    // The second fault behind the same screen: even with the grant restored, the
    // insert failed on created_by because nothing ever set it.
    expect(authorTrigger).toMatch(
      /before insert on public\.academy_exam_questions[\s\S]*execute function public\.academy_exam_question_stamp_author/,
    );
    expect(authorTrigger).toMatch(/new\.created_by := auth\.uid\(\)/);
  });

  it("forces the author rather than trusting a supplied one", () => {
    expect(authorTrigger).toMatch(/if auth\.uid\(\) is not null then\s+new\.created_by := auth\.uid\(\)/);
  });

  it("does not constrain updates, so a teacher can still edit another teacher's question", () => {
    // A WITH CHECK of created_by = auth.uid() would have looked tidier and
    // quietly broken collaborative editing, which the staff policy allows. The
    // check is that no policy was added here at all, so this is read from the
    // executable text: the file's own comment mentions the phrase.
    expect(code(authorTrigger)).not.toMatch(/create policy/i);
    expect(code(authorTrigger)).not.toMatch(/with check/i);
  });
});

describe("staff read the marked work through functions, not through grants", () => {
  it("does not grant the score columns to authenticated", () => {
    // The tempting fix for the mark sheet was to grant the missing columns. That
    // would have handed every student their own result before release, because a
    // student may read their own attempt row.
    expect(staffReads).not.toMatch(
      /grant select[\s\S]{0,300}score[\s\S]{0,80}on public\.academy_exam_attempts/,
    );
  });

  it("leaves the student column grant alone", () => {
    expect(staffReads).not.toMatch(/grant select \(/);
  });

  it("gates both staff reads on academy_is_teacher", () => {
    const checks = staffReads.match(/public\.academy_is_teacher\(\)/g) ?? [];
    expect(checks.length).toBeGreaterThanOrEqual(2);
  });

  it("revokes both from anon", () => {
    expect(staffReads).toMatch(
      /revoke execute on function public\.academy_exam_attempt_sheet\(uuid\) from public, anon/,
    );
    expect(staffReads).toMatch(
      /revoke execute on function public\.academy_exam_paper_review\(uuid\) from public, anon/,
    );
  });

  it("resolves the student name in the mark sheet query", () => {
    expect(staffReads).toMatch(
      /left join public\.academy_profiles pr on pr\.id = a\.student_id/,
    );
  });

  it("keeps the answer key out of the review function", () => {
    const review = staffReads.slice(
      staffReads.indexOf("academy_exam_paper_review"),
    );
    expect(review).not.toMatch(/correct_key/);
  });

  it("and the client calls those functions rather than selecting the tables", () => {
    expect(lib).toMatch(/supabase\.rpc\("academy_exam_attempt_sheet"/);
    expect(lib).toMatch(/supabase\.rpc\("academy_exam_paper_review"/);
    // The old form selected score columns that are deliberately not granted.
    expect(lib).not.toMatch(
      /from\("academy_exam_attempts"\)\s*\n\s*\.select\([^)]*score/,
    );
  });
});

describe("the live script stays honest", () => {
  it("never uses the service role for the flow under test", () => {
    // If the flow were run as service role it would bypass RLS and prove nothing
    // about what a signed-in student can do.
    expect(e2e).toMatch(/service role is used only to seed and to clean up/);
    expect(e2e).toMatch(/const rpc = \(token, name, args\) =>\s*\n?\s*asUser\(/);
  });

  it("reads the key from the environment rather than hard coding it", () => {
    expect(e2e).toMatch(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
    expect(e2e).not.toMatch(/sb_secret_|eyJ[A-Za-z0-9]/);
  });

  it("cleans up after itself", () => {
    expect(e2e).toMatch(/async function finish\(\)/);
    expect(e2e).toMatch(/auth\/v1\/admin\/users\/\$\{id\}/);
  });

  it("deletes every exam it made, not just the one under test", () => {
    // It only tracked one exam and forgot the draft it also created. Because
    // academy_exams.class_id is on delete set null, deleting the class orphaned
    // the draft, and the draft's created_by reference then blocked the user
    // delete, so a run left a real test account behind in the live database.
    expect(e2e).toMatch(/created\.exams\.push\(draftId\)/);
    expect(e2e).toMatch(/for \(const id of created\.exams\)/);
  });

  it("checks its cleanup instead of trusting a 2xx", () => {
    expect(e2e).toMatch(/CLEANUP PROBLEMS/);
    expect(e2e).toMatch(/e2e account\(s\) still exist/);
    expect(e2e).toMatch(/process\.exit\(failed\.length \|\| problems\.length \? 1 : 0\)/);
  });

  it("removes everything a user points at before deleting the user", () => {
    // Three references block a user delete: an exam they created (restrict), an
    // enrollment they hold, and the course-selection test creates one. The
    // account delete must come last, or it is refused and a test account is left
    // behind in a live database, which is exactly what happened once.
    const enrollmentDeletes = e2e.indexOf("academy_enrollments?student_id=eq.${id}");
    const examDeletes = e2e.indexOf("for (const id of created.exams)");
    const userDeletes = e2e.indexOf("auth/v1/admin/users/${id}");
    expect(enrollmentDeletes).toBeGreaterThan(-1);
    expect(examDeletes).toBeGreaterThan(-1);
    expect(userDeletes).toBeGreaterThan(examDeletes);
    expect(userDeletes).toBeGreaterThan(enrollmentDeletes);
  });

  it("asserts the guarantee that motivated the column grants", () => {
    expect(e2e).toMatch(/selecting a score column on an own row is refused/);
    expect(e2e).toMatch(/no score is visible before publication/);
    expect(e2e).toMatch(/history hides the score of an unreleased exam/);
  });
});
