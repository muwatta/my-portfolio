import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATIONS = "supabase/migrations";
const allSql = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(`${MIGRATIONS}/${name}`, "utf8"))
  .join("\n");

function latestDefinition(name) {
  const matches = [
    ...allSql.matchAll(
      new RegExp(
        `create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`,
        "g",
      ),
    ),
  ];
  expect(matches.length, `${name} should exist`).toBeGreaterThan(0);
  return matches.at(-1)[0];
}

const guard = latestDefinition("academy_set_user_admin");
const primary = latestDefinition("academy_primary_admin_id");

describe("the requested account is the sole global administrator", () => {
  it("fails closed unless the requested email resolves to one account", () => {
    expect(allSql).toMatch(
      /where lower\(email\) = 'abdullahmusliudeen@gmail\.com'[\s\S]*?having count\(\*\) = 1/,
    );
    expect(primary).toMatch(/language sql\s+stable[\s\S]*?array_agg\(id\)[\s\S]*?having count\(\*\) = 1/);
    expect(guard).toMatch(
      /target_user_id = public\.academy_primary_admin_id\(\)\s+and not should_be_admin/,
    );
  });

  it("cannot be removed or replaced by another global administrator", () => {
    expect(guard).toMatch(/primary administrator cannot be removed/i);
    expect(guard).toMatch(/global administrator access is reserved for the primary administrator/i);
  });

  it("is guaranteed a row even if the table were emptied", () => {
    expect(allSql).toMatch(
      /insert into public\.academy_admins \(user_id\)[\s\S]*?select public\.academy_primary_admin_id\(\)[\s\S]*?where public\.academy_primary_admin_id\(\) is not null[\s\S]*?on conflict \(user_id\) do nothing/,
    );
  });

  it("has the lookup revoked from every role", () => {
    expect(allSql).toMatch(
      /revoke execute on function public\.academy_primary_admin_id\(\) from public, anon, authenticated/,
    );
  });
});

describe("school administrators have a separate, scoped role", () => {
  it("keeps the school assignment separate from global administrator grants", () => {
    expect(allSql).toMatch(/create table if not exists public\.academy_school_admins/);
    expect(allSql).toMatch(/create or replace function public\.academy_set_school_admin/);
    expect(allSql).toMatch(/academy_school_admin_dashboard\(\)/);
    expect(allSql).toMatch(/profile\.school_id = assigned_school\.id/);
    expect(allSql).toMatch(/academy_school_admin_can_manage_student\(target_student_id\)/);
    expect(allSql).toMatch(/delete from public\.academy_admins\s+where user_id is distinct from public\.academy_primary_admin_id\(\)/);
  });

  it("shows the primary admin by name and distinguishes viewer/editor access", () => {
    const accessPage = readFileSync("src/pages/AcademyAdminAccess.jsx", "utf8");
    expect(accessPage).toContain('"Abdullahi Musliudeen"');
    expect(accessPage).toContain('">Grading editor</th>');
    expect(accessPage).toContain('">School viewer</th>');
    expect(accessPage).toContain('"No school viewer access"');
    expect(accessPage).toContain('"Appoint grading editor"');
    expect(accessPage).toMatch(/across all schools/);
  });

  it("is executable only by a signed in user, and still requires an administrator", () => {
    expect(allSql).toMatch(
      /revoke execute on function public\.academy_set_user_admin\(uuid, boolean\) from public, anon/,
    );
    expect(allSql).toMatch(
      /grant execute on function public\.academy_set_user_admin\(uuid, boolean\) to authenticated/,
    );
    expect(guard).toMatch(/Primary administrator access required/);
  });
});
