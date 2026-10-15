import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261347000000_cpp_weekly_assignments.sql",
  "utf8",
);
const gradeFn = readFileSync(
  "supabase/functions/academy-grade-submission/index.ts",
  "utf8",
);
const learningFixes = readFileSync(
  "supabase/migrations/20261405000000_academy_learning_material_and_leaderboard_limit.sql",
  "utf8",
);
const weekThreeFix = readFileSync(
  "supabase/migrations/20261421000000_cpp_week_three_beginner_speed_task.sql",
  "utf8",
);
const beginnerGuides = readFileSync(
  "supabase/migrations/20261422000000_cpp_weekly_beginner_guides.sql",
  "utf8",
);
const assignmentRetakes = readFileSync(
  "supabase/migrations/20261423000000_cpp_assignment_retakes_and_marked_progression.sql",
  "utf8",
);
const unlimitedAssignments = readFileSync(
  "supabase/migrations/20261424000000_academy_unlimited_assignment_submissions.sql",
  "utf8",
);
const workflowMigration = readFileSync(
  "supabase/migrations/20261409000000_academy_signup_notifications_cpp_sequence_and_leaderboard.sql",
  "utf8",
);
const academy = readFileSync("src/lib/academy.js", "utf8");

// A deterministic grader rejects correct code when the expected string is wrong,
// and it fails silently: the student's submission simply never passes. So the
// shape of these tests matters more than it would for a normal assertion.
describe("every C++ week has a graded assignment", () => {
  it("covers all fifteen weeks", () => {
    // Match the week number only where it precedes an assignment title, so the
    // bare numbers inside the jsonb test arrays are not counted.
    const weeks = new Set(
      [...migration.matchAll(/^\s{4}(\d+),\n\s{4}'C\+\+ Week/gm)].map(
        (match) => match[1],
      ),
    );
    expect([...weeks].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 15 }, (_, index) => String(index + 1)),
    );
  });

  it("publishes them so a student can reach them", () => {
    expect(migration).toMatch(/published[\s\S]*?true/);
    expect(migration).toMatch(/is_draft[\s\S]*?false/);
    expect(migration).toMatch(/status[\s\S]*?'published'/);
  });

  it("attaches each to its own week rather than a fixed one", () => {
    expect(migration).toMatch(
      /join public\.academy_weeks week\s*\n\s*on week\.course_id = course\.id\s*\n\s*and week\.week_number = seed\.week_number/,
    );
  });

  it("sets an author, because created_by is not nullable", () => {
    expect(migration).toMatch(/created_by/);
    expect(migration).toMatch(/coalesce\([\s\S]*?academy_primary_admin_id\(\)/);
  });
});

describe("the tests are verified output, not guesses", () => {
  it("carries input and expected pairs for every case", () => {
    const cases = [...migration.matchAll(/"input":\[.*?\],"expected":/g)];
    expect(cases.length).toBe(25);
  });

  it("documents how the expected values were produced", () => {
    // If this is lost, the next person will hand-write expected strings and the
    // grader will start rejecting correct answers for no visible reason.
    expect(migration).toMatch(
      /compiling and running the reference[\s\S]*?solution with g\+\+ and normalising its stdout the way the executor does/,
    );
  });

  it("uses escaped literals so a backslash or quote cannot break the statement", () => {
    // Every string literal is E'...' rather than a bare quote, which is what let
    // the C++ escapes survive into the database.
    expect(migration).not.toMatch(/starter_code,\n\s+'/);
  });
});

describe("grading goes through the same path Python already uses", () => {
  it("posts the source to the executor rather than adding a C++ path", () => {
    expect(gradeFn).toMatch(/source_code: submission\.source_code/);
    expect(gradeFn).toMatch(/executorUrl/);
  });

  it("compares against normalised output, so line endings cannot fail a run", () => {
    const server = readFileSync("executor/server.mjs", "utf8");
    expect(server).toMatch(/function normaliseOutput/);
    expect(server).toMatch(/replace\(\/\\r\\n\/g, "\\n"\)/);
  });
});

describe("these assignments are not a progress gate yet", () => {
  it("does not mark them required for completion", () => {
    // The executor is not hosted, so grading returns 503. Requiring these would
    // block lesson completion until infrastructure exists, which is the
    // retroactive lock that was just removed.
    // The words appear in the header comment explaining the decision, so assert
    // on behaviour: no insert column and no activity rows, only the prose.
    const statements = migration.replace(/^--.*$/gm, "");
    expect(statements).not.toMatch(/required_for_completion/);
    expect(statements).not.toMatch(/academy_lesson_activities/);
    expect(migration).toMatch(/not marked required_for_completion/);
  });

  it("is re-runnable without duplicating", () => {
    expect(migration).toMatch(/where not exists \([\s\S]*?existing\.title = seed\.title/);
  });
});

describe("the learning assignment corrections", () => {
  it("makes the Week 3 motor task self-contained for a beginner", () => {
    expect(weekThreeFix).toMatch(/program already has a distance value of 60/i);
    expect(weekThreeFix).toMatch(/Do not read input/);
    expect(weekThreeFix).toMatch(/change distance to 10 and then 120/);
    expect(weekThreeFix).toMatch(/int distance = 60;/);
    expect(weekThreeFix).toMatch(/"expected":"medium"/);
    expect(weekThreeFix).not.toMatch(/cin\s*>>/);
  });

  it("gives all fifteen weeks beginner instructions and matching example input", () => {
    const weeks = new Set(
      [...beginnerGuides.matchAll(/^\s{6}(\d+),$/gm)].map((match) => match[1]),
    );
    expect([...weeks].sort((left, right) => Number(left) - Number(right))).toEqual(
      Array.from({ length: 15 }, (_, index) => String(index + 1)),
    );
    expect(beginnerGuides).toMatch(/Program input example: 3000/);
    expect(beginnerGuides).toMatch(/Program input example \(five values\): 10 20 30 40 60/);
    expect(beginnerGuides).toMatch(/Program input example: F/);
    expect(beginnerGuides).toMatch(/Expected output: unknown/);
    expect(beginnerGuides).toMatch(/"expected":"20\\\\nalarm"/);
  });

  it("simplifies the week 9 calculation and matches its grading cases", () => {
    expect(learningFixes).toMatch(/C\+\+ Week 9: average two distances/);
    expect(learningFixes).toMatch(/Read two distance readings/);
    expect(learningFixes).toMatch(/"expected":"20\.00"/);
    expect(learningFixes).toMatch(/"expected":"35\.00"/);
  });

  it("makes the week 10 motor limit match its tested output", () => {
    expect(learningFixes).toMatch(/values 0, 50, 100, 150, 200, and 250/);
    expect(learningFixes).toMatch(/must not go above 250/);
    expect(learningFixes).not.toMatch(/final value must be exactly 255/);
  });

  it("ranks the full standings before returning only ten students", () => {
    expect(learningFixes).toMatch(/row_number\(\) over[\s\S]*?as rank/);
    expect(learningFixes).toMatch(/where ranked\.rank <= 10/);
  });

  it("orders C++ assignments by week and blocks later submissions server side", () => {
    const assignmentList = readFileSync("src/pages/AcademyAssignments.jsx", "utf8");
    const assignmentDetail = readFileSync("src/pages/AcademyAssignment.jsx", "utf8");
    expect(academy).toMatch(/activeCourse\.language === "cpp"[\s\S]*?week_number/);
    expect(academy).toMatch(/locked:[\s\S]*?week_number > nextCppWeek/);
    expect(assignmentList).toMatch(/Week \$\{assignment\.week_number\}/);
    expect(assignmentList).toMatch(/Waiting for the previous week to be marked/);
    expect(assignmentDetail).toMatch(/assignment\.locked/);
    expect(workflowMigration).toMatch(
      /create trigger academy_require_prior_cpp_assignments\s+before insert on public\.academy_submissions/,
    );
    expect(workflowMigration).toMatch(
      /prior_week\.week_number < target_week_number/,
    );
    expect(workflowMigration).toMatch(/Submit the previous C\+\+ week assignment/);
  });

  it("keeps previous C++ work visible, shows the best mark, and unlocks only after grading", () => {
    const assignmentList = readFileSync("src/pages/AcademyAssignments.jsx", "utf8");
    expect(academy).toMatch(/activeCourse\.language === "cpp"[\s\S]*?assignments/);
    expect(academy).toMatch(/completed_mark:[\s\S]*?final_score/);
    expect(academy).toMatch(/submission\.status === "graded"/);
    expect(assignmentList).toMatch(/Marked · Best mark/);
    expect(assignmentList).toMatch(/submit again/);
    expect(assignmentList).toMatch(/latest_submission_status/);
    expect(assignmentRetakes).toMatch(/result\.final_score is not null/);
    expect(assignmentRetakes).toMatch(/submission\.status = 'graded'/);
    expect(assignmentRetakes).toMatch(/must be marked before starting/);
    expect(unlimitedAssignments).not.toMatch(/assignment\.retry_limit/);
    expect(unlimitedAssignments).toMatch(/coalesce\(max\(attempt_number\), 0\) \+ 1/);
    expect(unlimitedAssignments).toMatch(/where id = p_assignment_id\s+for update/);
    expect(unlimitedAssignments).toMatch(/set published = false/);
  });

  it("gives administrators the full cohort while limiting other viewers to ten", () => {
    expect(workflowMigration).toMatch(/ranked\.rank <= 10/);
    expect(workflowMigration).toMatch(/or public\.academy_is_admin\(\)/);
    expect(academy).toMatch(/data: data \?\? \[\], error, configured: true/);
  });
});