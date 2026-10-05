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

describe("the account owner is always an administrator", () => {
  it("is identified by user id, not by an address", () => {
    // Probing lower(email) = '...' against this database twice gave
    // contradictory answers, so a guard built on it could not be trusted to
    // match. An id is deterministic and has no case or collation question.
    expect(primary).toMatch(/select '[0-9a-f-]{36}'::uuid/);
    expect(guard).toMatch(
      /target_user_id = public\.academy_primary_admin_id\(\)\s+and not should_be_admin/,
    );
  });

  it("cannot be removed by an administrator", () => {
    expect(guard).toMatch(/primary administrator cannot be removed/i);
  });

  it("is guaranteed a row even if the table were emptied", () => {
    expect(allSql).toMatch(
      /insert into public\.academy_admins \(user_id\)[\s\S]*?values \(public\.academy_primary_admin_id\(\)\)[\s\S]*?on conflict \(user_id\) do nothing/,
    );
  });

  it("has the lookup revoked from every role", () => {
    expect(allSql).toMatch(
      /revoke execute on function public\.academy_primary_admin_id\(\) from public, anon, authenticated/,
    );
  });
});

describe("other teachers and colleagues keep their access", () => {
  it("lets an administrator grant and revoke anyone but the owner", () => {
    expect(guard).toMatch(/if should_be_admin then/);
    expect(guard).toMatch(/insert into public\.academy_admins/);
    expect(guard).toMatch(
      /delete from public\.academy_admins\s+where\s+user_id = target_user_id/,
    );
  });

  it("records the colleague as a named administrator", () => {
    // Removing a colleague on an ambiguous instruction was the wrong call, so
    // the restoration is kept on the record rather than left as a silent no-op.
    const restore = readFileSync(
      `${MIGRATIONS}/20261095000000_academy_restore_colleague_admin.sql`,
      "utf8",
    );
    expect(restore).toMatch(/ec499da3-5c3c-4df5-9f9d-8e1c6496e0ae/);
    expect(restore).toMatch(/on conflict \(user_id\) do nothing/);
  });

  it("is executable only by a signed in user, and still requires an administrator", () => {
    expect(allSql).toMatch(
      /revoke execute on function public\.academy_set_user_admin\(uuid, boolean\) from public, anon/,
    );
    expect(allSql).toMatch(
      /grant execute on function public\.academy_set_user_admin\(uuid, boolean\) to authenticated/,
    );
    expect(guard).toMatch(/Administrator access required/);
  });
});
