import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATIONS = "supabase/migrations";
const all = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(`${MIGRATIONS}/${f}`, "utf8"))
  .join("\n");

const read = (name) => readFileSync(`${MIGRATIONS}/${name}`, "utf8");
const schema = read("20261240000000_assessment_schema.sql");
const rls = read("20261255000000_assessment_rls.sql");
const engine = read("20261241000000_assessment_engine.sql");
const paper = read("20261253000000_exam_paper_fix.sql");
const saveFix = read("20261257000000_save_answer_validation_fix.sql");
const disabled = read("20261275000000_disable_broken_csv_import.sql");

describe("the question bank is independent of lessons", () => {
  it("has its own table rather than reusing academy_exercises", () => {
    expect(schema).toMatch(/create table if not exists public\.academy_exam_questions/);
    // Exercises are lesson scoped with a beginner/developing/challenge check,
    // which does not match easy, medium, hard.
    expect(schema).toMatch(/check \(difficulty in \('easy', 'medium', 'hard'\)\)/);
  });

  it("reuses the existing subject, class and level tables", () => {
    expect(schema).toMatch(/subject_id uuid[^;]*references public\.academy_subjects/);
    expect(schema).toMatch(/class_id uuid[^;]*references public\.academy_classes/);
    expect(schema).toMatch(/level_id uuid[^;]*references public\.academy_levels/);
  });

  it("reuses the existing permission helpers rather than a new auth model", () => {
    expect(rls).toMatch(/public\.academy_is_teacher\(\)/);
    expect(rls).toMatch(/public\.academy_is_class_member\(class_id\)/);
  });
});

describe("the exam takes a snapshot of its questions", () => {
  // Section 4: editing a question later must not change a paper already created.
  it("stores the question as well as a reference to it", () => {
    expect(schema).toMatch(/snapshot jsonb not null/);
  });

  it("grades from the snapshot, not the live row", () => {
    expect(engine).toMatch(/link\.snapshot ->> 'correct_key' as correct_key/);
  });
});

describe("timing is the database's decision", () => {
  it("computes the deadline when the attempt is created", () => {
    expect(engine).toMatch(
      /now\(\) \+ make_interval\(mins => exam_row\.duration_minutes\)/,
    );
  });

  it("never accepts a deadline from the client", () => {
    expect(engine).toMatch(
      /insert into public\.academy_exam_attempts \([\s\S]*?deadline_at,/,
    );
  });

  it("is configurable per exam, not a global setting", () => {
    expect(schema).toMatch(/duration_minutes integer not null check \(duration_minutes between 1 and 600\)/);
  });

  it("refuses a save after the deadline", () => {
    expect(saveFix).toMatch(
      /if now\(\) > attempt_row\.deadline_at then[\s\S]*?Time is up for this attempt/,
    );
  });

  it("auto submits expired attempts, and grading twice is harmless", () => {
    expect(engine).toMatch(/create or replace function public\.academy_exam_auto_submit_expired/);
    expect(engine).toMatch(/if attempt_row\.status <> 'in_progress' then\s*return attempt_row;/);
  });
});

describe("the answer key never reaches a student", () => {
  it("is absent from the paper function's output", () => {
    const paperBody = paper.slice(paper.indexOf("returns table"));
    expect(paperBody).not.toMatch(/correct_key/);
  });

  it("cannot be read from the question bank", () => {
    expect(rls).toMatch(
      /create policy academy_exam_questions_staff[\s\S]*?using \(public\.academy_is_teacher\(\)\)/,
    );
    expect(rls).toMatch(/revoke select on public\.academy_exam_questions/);
  });

  it("cannot be read from the link table, which was the actual leak", () => {
    expect(rls).toMatch(
      /create policy academy_exam_links_staff[\s\S]*?using \(public\.academy_is_teacher\(\)\)/,
    );
    expect(rls).toMatch(/revoke select on public\.academy_exam_question_links/);
  });
});

describe("a mark cannot be read before results are published", () => {
  it("withholds is_correct and marks_awarded at the column level", () => {
    expect(rls).toMatch(/revoke select on public\.academy_exam_answers/);
    expect(rls).toMatch(
      /grant select \(\s*id, attempt_id, question_id, selected_key/,
    );
  });

  it("withholds the graded totals from the student's own attempt row", () => {
    expect(rls).toMatch(/revoke select on public\.academy_exam_attempts/);
    expect(rls).not.toMatch(/grant select \([^)]*score[^)]*\) on public\.academy_exam_attempts/);
  });

  it("returns nothing at all while hidden", () => {
    expect(engine).toMatch(
      /if not exam_row\.results_published and not public\.academy_is_teacher\(\) then[\s\S]*?'results_published', false/,
    );
  });

  it("publishes for a whole exam at once, teachers only", () => {
    expect(engine).toMatch(
      /create or replace function public\.academy_exam_publish_results[\s\S]*?academy_is_teacher\(\) then/,
    );
  });
});

describe("a student cannot fabricate their own attempt", () => {
  it("has no insert policy on attempts at all", () => {
    const policies = rls.match(/create policy [\s\S]*?;/g) ?? [];
    const attemptPolicies = policies.filter((p) => p.includes("academy_exam_attempts"));
    expect(attemptPolicies.every((p) => !/for insert/.test(p))).toBe(true);
  });

  it("has no write policy on answers either", () => {
    const policies = rls.match(/create policy [\s\S]*?;/g) ?? [];
    const answerPolicies = policies.filter((p) => p.includes("academy_exam_answers"));
    expect(answerPolicies.every((p) => !/for insert|for update/.test(p))).toBe(true);
  });

  it("allows only one live attempt per exam, in the database", () => {
    expect(schema).toMatch(
      /create unique index if not exists academy_exam_attempts_one_live_idx[\s\S]*?where status = 'in_progress'/,
    );
  });

  it("honours max_attempts for sequential retries", () => {
    expect(engine).toMatch(/if taken >= exam_row\.max_attempts then/);
  });
});

describe("an answer has to be real", () => {
  it("refuses a key that is not one of the options", () => {
    // The original condition raised whenever options differed from the answer,
    // which rejected every legitimate answer. It now checks the key is present.
    expect(saveFix).toMatch(
      /if p_selected_key is not null and not exists \([\s\S]*?elem ->> 'key' = p_selected_key/,
    );
    // The buggy comparison is quoted in the header comment, so strip comments
    // before asserting it is gone from the code.
    expect(saveFix.replace(/--.*$/gm, "")).not.toMatch(
      /elem ->> 'key' <> p_selected_key/,
    );
  });

  it("refuses a question that is not in this exam", () => {
    expect(saveFix).toMatch(
      /if valid_key is null then[\s\S]*?That question is not part of this examination/,
    );
  });
});

describe("offline sync cannot lose a newer answer", () => {
  it("takes last write wins on the student's own clock", () => {
    expect(saveFix).toMatch(
      /existing\.client_answered_at > p_client_answered_at then\s*return false;/,
    );
  });

  it("records the student clock for the record, but never decides validity", () => {
    expect(engine).toMatch(
      /effective_reason := case\s*when now\(\) > attempt_row\.deadline_at then 'timeout'/,
    );
    expect(engine).toMatch(/client_submitted_at/);
  });
});

describe("randomisation is stable for one attempt", () => {
  it("derives the order from a stored seed", () => {
    expect(schema).toMatch(/random_seed bigint not null/);
  });

  it("reuses the stored position as a tiebreak so nothing swaps", () => {
    expect(paper).toMatch(/order by b\.rank, b\.seq/);
  });
});

describe("publishing is refused for a broken exam", () => {
  it("reports each problem rather than a single failure", () => {
    expect(engine).toMatch(/create or replace function public\.academy_exam_validate/);
    expect(engine).toMatch(/'question_missing_key'/);
    expect(engine).toMatch(/'bad_duration'/);
    expect(engine).toMatch(/'duplicate_question'/);
  });
});

describe("the CSV importer is switched off until it works", () => {
  // It was reachable and raised "The file is empty" for every file, which is
  // worse than the feature being absent.
  it("is not executable by anyone", () => {
    expect(disabled).toMatch(
      /revoke execute on function public\.academy_exam_preview_csv\(text, uuid, boolean\)\s*\n?\s*from public, anon, authenticated/,
    );
    expect(disabled).toMatch(
      /revoke execute on function public\.academy_exam_import_csv\(text, uuid, boolean, boolean\)\s*\n?\s*from public, anon, authenticated/,
    );
  });

  it("still exists, ready to re-enable", () => {
    expect(all).toMatch(/create or replace function public\.academy_exam_preview_csv/);
  });
});

describe("the audit trail is recorded", () => {
  it("has a table for the events in section 25", () => {
    expect(schema).toMatch(/create table if not exists public\.academy_exam_events/);
  });

  it("records starting, submitting and auto submitting", () => {
    expect(engine).toMatch(/'exam_started'/);
    expect(engine).toMatch(/case when effective_reason = 'timeout' then 'exam_auto_submitted' else 'exam_submitted' end/);
  });
});
