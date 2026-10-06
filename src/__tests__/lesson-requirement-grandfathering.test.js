import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regression cover for the retroactive lock. A required activity added to a
// lesson after a student had already completed it used to block the next lesson
// forever: 20261337000000 attached a required assignment to Python Session 1 on
// 2026-10-05, after students had completed Sessions 1 and 2 on 2026-10-02 and
// 2026-10-04. They had finished the work and were still told to go back and do
// an assignment they had never been asked for.
const migration = readFileSync(
  "supabase/migrations/20261345000000_grandfather_retroactive_lesson_requirements.sql",
  "utf8",
);

describe("requirements added later do not lock students who already finished", () => {
  it("ignores an activity created after the student completed the lesson", () => {
    expect(migration).toMatch(/activity\.created_at > progress\.completed_at/);
  });

  it("scopes the exemption to that student and that lesson", () => {
    // A per-student, per-lesson check. Anything looser would hand the exemption
    // to students who have not done the work at all.
    expect(migration).toMatch(
      /progress\.student_id = target_student_id[\s\S]*?progress\.lesson_id = target_lesson_id/,
    );
    expect(migration).toMatch(/completion_status = 'completed'/);
    expect(migration).toMatch(/completed_at is not null/);
  });

  it("still requires the work from anyone who has not completed the lesson", () => {
    // The original conditions must survive intact, or the gate stops being a gate.
    expect(migration).toMatch(/activity\.required_for_completion/);
    expect(migration).toMatch(/attempt\.passed > 0/);
    expect(migration).toMatch(/submission\.student_id = target_student_id/);
  });

  it("keeps the function's security attributes", () => {
    // It is SECURITY DEFININER and reads other tables, so the pinned search_path
    // and the revoked grants are load-bearing, not decoration.
    expect(migration).toMatch(/security definer/);
    expect(migration).toMatch(/set search_path = public, extensions, pg_temp/);
    expect(migration).toMatch(
      /revoke execute on function public\.academy_lesson_required_activities_complete\(uuid, uuid\)[\s\S]*?from public, anon/,
    );
  });
});

describe("the prerequisite chain ignores lessons students cannot see", () => {
  const chain = readFileSync(
    "supabase/migrations/20261343000000_published_lesson_prerequisite_chain.sql",
    "utf8",
  );

  it("chains only published lessons", () => {
    expect(chain).toMatch(/lesson\.published[\s\S]*?lesson\.status = 'published'/);
  });

  it("keeps the chain current when lesson visibility or order changes", () => {
    expect(chain).toMatch(
      /create trigger academy_rechain_lessons_after_change[\s\S]*?update of\s*\n?\s*week_id, lesson_number, sort_order, published, status/,
    );
  });

  it("rebinds existing courses", () => {
    expect(chain).toMatch(
      /select public\.academy_rechain_course_lessons\(course\.id\)/,
    );
  });
});

describe("draft example fixtures stay hidden", () => {
  // A migration that published all non-archived Python content was written and
  // then removed. On this database it would have published one assignment titled
  // "Example: auto-graded Python function task", a draft demo fixture rather
  // than student work. Nothing should reintroduce a blanket publish of drafts.
  it("has no migration that publishes every non-archived Python record", () => {
    const publishAll = /update\s+public\.academy_assignions[\s\S]*?status\s*<>\s*'archived'[\s\S]*?set\s+status\s*=\s*'published'/;
    expect(migration).not.toMatch(publishAll);
  });
});