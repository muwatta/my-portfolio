import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261426000000_academy_leaderboard_reward_balance.sql",
  "utf8",
);

describe("balanced leaderboard rewards", () => {
  it("awards five points for a completed lesson", () => {
    expect(migration).toMatch(/'lesson'[\s\S]*?new\.lesson_id,\s*5,/);
  });

  it("awards two points only for a student's first pass on an exercise", () => {
    expect(migration).toMatch(/'practice'[\s\S]*?new\.exercise_id,\s*2,/);
    expect(migration).toMatch(/not exists\s*\([\s\S]*?points\.source_type = 'practice'/);
  });

  it("uses the best published exam score at one point per ten percentage points", () => {
    expect(migration).toMatch(
      /greatest\(1,\s*round\(best\.percentage \/ 10\.0\)\)::integer/,
    );
    expect(migration).toMatch(/select results_published into is_published/);
    expect(migration).toMatch(/order by attempt\.student_id, attempt\.percentage desc/);
  });
});
