import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261349000000_python_weekly_assignments.sql",
  "utf8",
);
const worker = readFileSync("src/workers/pythonWorker.js", "utf8");

describe("the pure-Python weeks have graded assignments", () => {
  it("covers weeks one to five", () => {
    const weeks = [
      ...new Set(
        [...migration.matchAll(/^\s{2}\((\d+), 'Python Week/gm)].map((m) => m[1]),
      ),
    ];
    expect(weeks.sort((a, b) => a - b)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("carries machine-verified expected output for every case", () => {
    expect([...migration.matchAll(/"input":\[.*?\],"expected":/g)].length).toBe(8);
    expect(migration).toMatch(
      /running each reference solution and normalising[\s\S]*?stdout the way the executor does/,
    );
  });

  it("attributes each to its own week and sets an author", () => {
    expect(migration).toMatch(
      /join public\.academy_weeks week\s*\n\s*on week\.course_id = course\.id\s*\n\s*and week\.week_number = seed\.week_number/,
    );
    expect(migration).toMatch(/coalesce\([\s\S]*?academy_primary_admin_id\(\)/);
  });

  it("does not duplicate on a re-run", () => {
    expect(migration).toMatch(
      /where not exists \([\s\S]*?existing\.title = seed\.title/,
    );
  });
});

describe("weeks six to eleven are held back deliberately", () => {
  it("says why in the migration rather than leaving a silent gap", () => {
    // Pandas, NumPy, charts and machine learning cannot be run by a student today,
    // so an assignment for those weeks would be unpassable content.
    expect(migration).toMatch(/Weeks 6 to 11 deliberately have none yet/);
    expect(migration).toMatch(/loadPyodide with no packages argument/);
  });

  it("confirms the browser runtime really does load the standard library only", () => {
    // The reason above is only true while loadPyodide is called without packages.
    // If that changes, this test fails and the reasoning is revisited.
    expect(worker).toMatch(/loadPyodide\(\{\s*\n\s*indexURL/);
    expect(worker).not.toMatch(/loadPyodide\(\{[^}]*packages/);
  });

  it("is not a progress gate while deterministic Python grading cannot run", () => {
    const statements = migration.replace(/^--.*$/gm, "");
    expect(statements).not.toMatch(/required_for_completion/);
    expect(statements).not.toMatch(/academy_lesson_activities/);
  });
});