import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261360000000_python_ml_weekly_assignments.sql",
  "utf8",
);
const selectCourse = readFileSync(
  "supabase/migrations/20261336000000_academy_prevent_course_reselection.sql",
  "utf8",
);

describe("weeks 6 to 11 now have graded assignments", () => {
  it("covers every remaining week of the course", () => {
    const weeks = [
      ...new Set(
        [...migration.matchAll(/^\s{2}\((\d+), 'Week/gm)].map((m) => m[1]),
      ),
    ];
    expect(weeks.sort((a, b) => a - b)).toEqual([
      "6", "7", "8", "9", "10", "11",
    ]);
  });

  it("carries machine-verified expected output", () => {
    expect([...migration.matchAll(/"input":\[.*?\],"expected":/g)].length).toBe(6);
    // Assert fragments rather than a phrase: the comment wraps mid-sentence.
    expect(migration).toMatch(/normalising its stdout/);
    expect(migration).toMatch(/scikit-learn 1\.9\.1/);
  });

  it("grades numbers rather than rendered charts", () => {
    // A figure cannot be compared as stdout, so where a week involves one the task
    // prints the values it would show and says that is what is checked.
    expect(migration).toMatch(/Nothing graded depends on drawing a chart/);
    expect(migration).toMatch(/printed values are what is checked/);
  });

  it("records why these were held back until now", () => {
    expect(migration).toMatch(/used to call loadPyodide with no packages argument/);
    expect(migration).toMatch(/unpassable content/);
  });

  it("targets only the Python course", () => {
    expect(migration).toMatch(/course\.slug = 'python-for-ai-machine-learning'/);
    expect(migration).not.toMatch(/cpp-embedded-robotics/);
  });
});

describe("the two courses stay independent", () => {
  it("lets a student hold only one active enrolment", () => {
    // A learner picks C++ or Python for their course and is then locked into it,
    // so neither course can be swapped underneath them by the other.
    expect(selectCourse).toMatch(/Your current course is locked/);
    expect(selectCourse).toMatch(/elsif v_active_course_id is not null then/);
  });

  it("scopes selection to the caller's own profile", () => {
    expect(selectCourse).toMatch(
      /auth\.uid\(\) <> target_student_id then[\s\S]*?Students may only select a course for themselves/,
    );
  });

  it("refuses a course that is not published and active", () => {
    expect(selectCourse).toMatch(
      /and published\s*\n\s*and is_active[\s\S]*?Course is not available/,
    );
  });

  it("locks the profile row so two concurrent picks cannot both win", () => {
    expect(selectCourse).toMatch(/for update/);
  });
});

describe("migration versions are unique", () => {
  it("has no other migration claiming this version", () => {
    // A collision once meant two files shared 20261349000000, which would have
    // left one of them permanently unapplied and unrecorded.
    const versions = readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.split("_")[0]);
    const duplicates = versions.filter(
      (v, i) => versions.indexOf(v) !== i,
    );
    expect(duplicates).toEqual([]);
  });
});