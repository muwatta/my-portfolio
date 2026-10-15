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
const graderWriteAccess = readFileSync(
  "supabase/migrations/20261415000000_academy_grader_write_and_file_access.sql",
  "utf8",
);
const graderReadAccess = readFileSync(
  "supabase/migrations/20261428000000_academy_grader_read_policies.sql",
  "utf8",
);
const assignmentActivitySync = readFileSync(
  "supabase/migrations/20261416000000_academy_assignment_activity_sync.sql",
  "utf8",
);
const assignmentEditor = readFileSync("src/pages/AcademyTeacherAssignments.jsx", "utf8");
const academyLibrary = readFileSync("src/lib/academy.js", "utf8");
const appRoutes = readFileSync("src/App.jsx", "utf8");
const academyLayout = readFileSync("src/components/academy/AcademyLayout.jsx", "utf8");

describe("manual grading authorization", () => {
  it("separates graders from teachers and limits appointment to the superadmin", () => {
    expect(migration).toMatch(/create table if not exists public\.academy_graders/);
    expect(migration).toMatch(/create or replace function public\.academy_can_grade/);
    expect(migration).toMatch(/auth\.uid\(\) is distinct from public\.academy_primary_admin_id\(\)/);
    expect(migration).toMatch(/Only the primary superadmin can appoint or remove graders/);
  });

  it("guards direct result writes as well as UI calls", () => {
    expect(migration).toMatch(/create trigger academy_submission_results_manual_grade_guard/);
    expect(migration).toMatch(/not public\.academy_can_grade\(\)/);
    expect(gradingQueue).toMatch(/if not public\.academy_can_grade\(\)/);
    expect(graderWriteAccess).toMatch(/for insert to authenticated\s+with check \(public\.academy_can_grade\(\)\)/);
    expect(graderWriteAccess).toMatch(/for update to authenticated\s+using \(public\.academy_can_grade\(\)\)/);
  });

  it("lets appointed graders securely open submissions without widening student access", () => {
    expect(graderWriteAccess).toMatch(/bucket_id = 'assignment-submissions'/);
    expect(graderWriteAccess).toMatch(/or public\.academy_can_grade\(\)/);
    expect(graderWriteAccess).toMatch(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
  });

  it("restricts direct submission, result, and event reads to the student or an appointed grader", () => {
    expect(graderReadAccess).toMatch(
      /drop policy if exists academy_submissions_teacher\s+on public\.academy_submissions/,
    );
    expect(graderReadAccess).toMatch(
      /create policy academy_submissions_student_self_read[\s\S]*?student_id = auth\.uid\(\)\s+or public\.academy_can_grade\(\)/,
    );
    expect(graderReadAccess).toMatch(
      /drop policy if exists academy_submission_results_teacher\s+on public\.academy_submission_results/,
    );
    expect(graderReadAccess).toMatch(
      /create policy academy_submission_results_student_read[\s\S]*?student_id = auth\.uid\(\)\s+or public\.academy_can_grade\(\)/,
    );
    expect(graderReadAccess).toMatch(
      /create policy academy_submission_events_student_read[\s\S]*?public\.academy_can_grade\(\)\s+or exists/,
    );
    expect(graderReadAccess).not.toMatch(/or public\.academy_is_teacher\(\)/);
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

  it("normalizes Unicode letters and numbers when comparing prompts", () => {
    expect(practiceGenerator).toContain('.replace(/[^\\p{L}\\p{N}]+/gu, " ")');
  });
});

describe("assignment lesson organization", () => {
  it("filters lesson choices by course and persists the lesson association", () => {
    expect(assignmentEditor).toMatch(/getAcademyTeacherCurriculum\(\)/);
    expect(assignmentEditor).toMatch(/week\?\.course_id === form\.course_id/);
    expect(academyLibrary).toMatch(/lesson_id: assignment\.lesson_id \|\| null/);
    expect(academyLibrary).toMatch(/status: assignment\.published \? "published" : "draft"/);
  });

  it("keeps assignment lesson activities synchronized for learner progress", () => {
    expect(assignmentActivitySync).toMatch(/before insert or update or delete on public\.academy_assignments/);
    expect(assignmentActivitySync).toMatch(/insert into public\.academy_lesson_activities/);
    expect(assignmentActivitySync).toMatch(/new\.course_id <> selected_course_id/);
    expect(assignmentActivitySync).toMatch(/new\.week_id := selected_week_id/);
    expect(assignmentActivitySync).toMatch(/delete from public\.academy_lesson_activities/);
    expect(assignmentActivitySync).toMatch(/assignment\.course_id = week\.course_id/);
  });

  it("keeps grading routes behind the grader guard and gives graders a restricted navigation", () => {
    expect(appRoutes).toMatch(/<Route element=\{<AcademyGraderGuard \/>\}>[\s\S]*?path="\/academy\/grading"/);
    expect(appRoutes).toMatch(/path="\/academy\/teacher\/submissions"[\s\S]*?Navigate to="\/academy\/grading"/);
    expect(academyLayout).toMatch(/const GRADER_LINKS = \[[\s\S]*?to: "\/academy\/grading"/);
    expect(academyLayout).not.toMatch(/label: "Submissions", to: "\/academy\/teacher\/submissions"/);
  });
});
