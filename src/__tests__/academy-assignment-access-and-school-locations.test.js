import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const assignmentPage = readFileSync(
  "src/pages/AcademyAssignment.jsx",
  "utf8",
);
const academyLibrary = readFileSync("src/lib/academy.js", "utf8");
const profilePage = readFileSync("src/pages/AcademyProfile.jsx", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261338000000_academy_assignment_access_and_school_locations.sql",
  "utf8",
);

describe("student assignment access", () => {
  it("resolves and scopes the assignment to the signed-in student's active course", () => {
    expect(assignmentPage).toContain("getAcademyAssignment(id, user.id)");
    expect(academyLibrary).toMatch(
      /export async function getAcademyAssignment\(id, studentId = null\)[\s\S]*?getActiveCourseForStudent\(studentId\)[\s\S]*?query = query\.eq\("course_id", activeCourse\.id\)/,
    );
  });

  it("repairs missing enrollment rows only when a student has no active enrollment", () => {
    expect(migration).toContain(
      "profile.current_course_id, 'active'",
    );
    expect(migration).toMatch(
      /not exists \([\s\S]*?enrollment\.student_id = profile\.id[\s\S]*?enrollment\.status = 'active'/,
    );
    expect(migration).toContain("on conflict (student_id, course_id) do update");
  });

  it("ensures the two Week 1 assignments are published and attached to their lessons", () => {
    expect(migration).toContain("Week 1 Python: My First Welcome Card");
    expect(migration).toContain("Week 1 C++: Turn a Flowchart into Output");
    expect(migration).toMatch(
      /update public\.academy_assignments[\s\S]*?set[\s\S]*?status\s*=\s*'published'/,
    );
    expect(migration).toContain("'assignment'");
    expect(migration).toContain("automated_tests");
  });
});

describe("school locations", () => {
  it.each([
    ["CIMAI", "Kwara", "Ilorin"],
    ["SMS", "Plateau", "Jos"],
    ["MMS", "Lagos", "Lagos"],
    ["DGHIA", "Plateau", "Jos"],
    ["Haneef", "Plateau", "Jos"],
  ])("stores %s at %s, %s", (school, state, city) => {
    expect(migration).toContain(`('${school}', '${school}', '${state}', '${city}')`);
  });

  it("updates the profile location when a listed school is selected", () => {
expect(profilePage).toContain("const selectSchool = (schoolId) =>");
      // Null safe: a saved profile can carry a school_id that is no longer in
      // the catalogue, and reading .state off the missing match would throw.
      expect(profilePage).toContain("state: selectedSchool?.state");
      expect(profilePage).toContain("city: selectedSchool?.city");
    expect(profilePage).toContain("onChange={(event) => selectSchool(event.target.value)}");
  });
});
