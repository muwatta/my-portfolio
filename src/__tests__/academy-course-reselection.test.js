import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrations = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(`supabase/migrations/${name}`, "utf8"))
  .join("\n");
const selection = [
  ...migrations.matchAll(
    /create or replace function public\.academy_select_course\([\s\S]*?\$\$;/g,
  ),
].at(-1)?.[0];

describe("students cannot reselect or switch an active course", () => {
  it("returns a clear error if a student submits their already active course", () => {
    expect(selection).toMatch(/if v_active_course_id = target_course_id then/);
    expect(selection).toMatch(/This is already your current course/);
  });

  it("rejects a different course until staff changes the active enrollment", () => {
    expect(selection).toMatch(/elsif v_active_course_id is not null then/);
    expect(selection).toMatch(/Your current course is locked/);
  });

  it("serializes concurrent choices for the same student", () => {
    expect(selection).toMatch(/from public\.academy_profiles[\s\S]*?for update/);
  });

  it("leaves admin and teacher course changes on their separate path", () => {
    expect(selection).toMatch(/auth\.uid\(\) <> target_student_id/);
    expect(selection).toMatch(/role = 'student'/);
  });
});

describe("active course lookup", () => {
  it("reads the active enrollment without invoking course selection", () => {
    const library = readFileSync("src/lib/academy.js", "utf8");
    const lookup = library.slice(
      library.indexOf("export async function getActiveCourseForStudent"),
      library.indexOf("export async function selectAcademyCourse"),
    );

    expect(lookup).toContain('.from("academy_enrollments")');
    expect(lookup).toContain('.eq("status", "active")');
    expect(lookup).not.toContain('rpc("academy_select_course"');
  });
});
