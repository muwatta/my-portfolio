import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261417000000_academy_school_scoped_admins.sql",
  "utf8",
);
const accessPage = readFileSync("src/pages/AcademyAdminAccess.jsx", "utf8");
const schoolDashboard = readFileSync(
  "src/pages/AcademySchoolAdminDashboard.jsx",
  "utf8",
);
const authContext = readFileSync("src/context/AcademyAuthContext.jsx", "utf8");
const academyLibrary = readFileSync("src/lib/academy.js", "utf8");
const app = readFileSync("src/App.jsx", "utf8");

describe("school administrator privacy boundary", () => {
  it("pins the sole global administrator to the requested account", () => {
    expect(migration).toMatch(
      /where lower\(email\) = 'abdullahmusliudeen@gmail\.com'/,
    );
    expect(migration).toMatch(/array_length\(matching_user_ids, 1\), 0\) <> 1/);
    expect(migration).toMatch(
      /delete from public\.academy_admins\s+where user_id <> public\.academy_primary_admin_id\(\)/,
    );
    expect(migration).toMatch(
      /coalesce\(auth\.uid\(\) = public\.academy_primary_admin_id\(\), false\)/,
    );
  });

  it("assigns each school administrator one school and exposes its roster only", () => {
    expect(migration).toMatch(/user_id uuid primary key[\s\S]*?school_id uuid not null/);
    expect(migration).toMatch(
      /if not public\.academy_is_admin\(\) then[\s\S]*?Primary administrator access required/,
    );
    expect(migration).toMatch(/using \(user_id = auth\.uid\(\) or public\.academy_is_admin\(\)\)/);
    expect(migration).toMatch(
      /if not public\.academy_is_school_admin\(\) then[\s\S]*?School administrator access required/,
    );
    expect(migration).toMatch(/profile\.school_id = assigned_school\.id/);
    expect(migration).toMatch(/'verified_points', coalesce\(points\.verified_points, 0\)/);
    expect(migration).toMatch(/'completed_lessons', coalesce\(progress\.completed_lessons, 0\)/);
  });

  it("prevents school administrators from inheriting global teacher access", () => {
    expect(migration).toMatch(
      /and not exists \([\s\S]*?from public\.academy_school_admins[\s\S]*?where user_id = auth\.uid\(\)/,
    );
    expect(migration).toMatch(
      /not public\.academy_school_admin_can_manage_student\(target_student_id\)/,
    );
  });

  it("provides course changes only through the school-scoped dashboard", () => {
    expect(accessPage).toMatch(/setAcademySchoolAdmin/);
    expect(accessPage).not.toMatch(/setAcademyAdmin/);
    expect(academyLibrary).toMatch(/target_school_id: schoolId \|\| null/);
    expect(schoolDashboard).toMatch(/getAcademySchoolAdminDashboard/);
    expect(schoolDashboard).toMatch(/assignAcademyStudentLevel\(studentId, courseId\)/);
    expect(schoolDashboard).toMatch(/Their progress and achievements are unchanged/);
  });

  it("routes school admins to a distinct guarded dashboard", () => {
    expect(authContext).toMatch(
      /const \[adminStatus, setAdminStatus\] = useState\(false\)/,
    );
    expect(authContext).toMatch(
      /const \[profileSettled, setProfileSettled\] = useState\(false\)/,
    );
    expect(authContext).toMatch(/isSchoolAdmin: schoolAdminStatus/);
    expect(app).toMatch(
      /<Route element=\{<AcademyGuard \/>\}>[\s\S]*?<Route element=\{<AcademySchoolAdminGuard \/>\}>[\s\S]*?path="\/academy\/school-admin"/,
    );
  });
});
