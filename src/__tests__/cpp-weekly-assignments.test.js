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