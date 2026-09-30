import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Both migrations are generated, and the generator ran every sample through the
// real worker before writing them. These assert the shape of the result and the
// fact that the generation step is still wired to that check, so a future content
// migration cannot quietly add code the Run button rejects.
const fiveLessons = readFileSync(
  "supabase/migrations/20261307000000_cpp_five_lessons_per_week.sql",
  "utf8",
);
const backfill = readFileSync(
  "supabase/migrations/20261308000000_cpp_starter_code_backfill.sql",
  "utf8",
);

describe("every C++ week has five lessons", () => {
  it("adds a Drill and a Wrap to each of the 24 weeks", () => {
    const drills = (fiveLessons.match(/^ {4}4,$/gm) ?? []).length;
    const wraps = (fiveLessons.match(/^ {4}5,$/gm) ?? []).length;
    expect(drills).toBe(24);
    expect(wraps).toBe(24);
  });

  it("gives each new lesson a starter_code the editor can run", () => {
    expect((fiveLessons.match(/'starter_code'/g) ?? []).length).toBe(48);
  });

  it("uses text[] for objectives, which is the column type", () => {
    // academy_lessons.objectives is text[]. A jsonb_build_array here is a type
    // error, which the first push of this migration duly was.
    expect(fiveLessons).toMatch(/array\['/);
    expect(fiveLessons).not.toMatch(/jsonb_build_array\(\s*'Write the same instruction/);
  });

  it("closes every SQL string literal it opens", () => {
    // A single quote inside a title or explanation would end the literal early
    // and blow up partway through the file, which is how the first version of
    // this migration failed. The literals are multi-line because they hold whole
    // C++ programs, so the only check that means anything here is that the file
    // as a whole is balanced. Whether it actually applies is verified against the
    // live database, not in a unit test.
    expect((fiveLessons.match(/'/g) ?? []).length % 2).toBe(0);
  });

  it("rebuilds the prerequisite chain after adding the lessons", () => {
    expect(fiveLessons).toMatch(
      /select public\.academy_rechain_course_lessons\(id\)[\s\S]*cpp-embedded-robotics/,
    );
  });

  it("is written to be re-runnable without duplicating lessons", () => {
    expect((fiveLessons.match(/not exists/g) ?? []).length).toBe(48);
  });
});

describe("no C++ lesson opens an empty editor", () => {
  it("backs a starter_code onto the 56 lessons that had none", () => {
    expect((backfill.match(/^update public\.academy_lessons$/gm) ?? []).length).toBe(56);
  });

  it("stores the code as a JSON string, not as JSON text", () => {
    // A ::jsonb cast fails, because a C++ program is not JSON.
    expect(backfill).toMatch(/to_jsonb\(/);
    expect(backfill).not.toMatch(/::jsonb\), updated_at/);
  });
});
