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
const singleAdmin = readFileSync(
  `${MIGRATIONS}/20261091000000_academy_single_admin.sql`,
  "utf8",
);

describe("there is exactly one administrator", () => {
  it("removes every admin except the account owner", () => {
    expect(singleAdmin).toMatch(
      /delete from public\.academy_admins\s*\n\s*where user_id <> public\.academy_primary_admin_id\(\)/,
    );
  });

  it("guarantees the owner is present even if the delete emptied the table", () => {
    expect(singleAdmin).toMatch(
      /insert into public\.academy_admins \(user_id\)\s*\n\s*values \(public\.academy_primary_admin_id\(\)\)\s*\n\s*on conflict \(user_id\) do nothing/,
    );
  });
});

describe("the primary administrator guard actually fires", () => {
  it("identifies the owner by user id, not by an address", () => {
    // Probing lower(email) = '...' against this database twice gave
    // contradictory answers, so a guard built on it could not be trusted to
    // match. An id is deterministic and has no case or collation question.
    expect(primary).toMatch(/select '[0-9a-f-]{36}'::uuid/);
    expect(guard).toMatch(
      /if target_user_id = public\.academy_primary_admin_id\(\) and not should_be_admin then/,
    );
  });

  it("does not depend on a lower(email) comparison anywhere", () => {
    expect(guard).not.toMatch(/lower\(email\)/);
    expect(guard).not.toMatch(/auth\.users/);
  });

  it("still lets an administrator promote and demote anyone else", () => {
    expect(guard).toMatch(/if should_be_admin then/);
    expect(guard).toMatch(/insert into public\.academy_admins/);
    expect(guard).toMatch(/delete from public\.academy_admins where user_id = target_user_id/);
  });

  it("is executable only by a signed in user", () => {
    expect(allSql).toMatch(
      /revoke execute on function public\.academy_set_user_admin\(uuid, boolean\) from public, anon/,
    );
    expect(allSql).toMatch(
      /grant execute on function public\.academy_set_user_admin\(uuid, boolean\) to authenticated/,
    );
  });

  it("still requires caller to be an administrator", () => {
    expect(guard).toMatch(/Primary administrator access required/);
  });
});

describe("the helper is not a back door", () => {
  it("revokes the primary admin lookup from every role", () => {
    // It returns the owner id, which is not a secret, but exposing it would let
    // anyone enumerate the one account worth targeting.
    expect(allSql).toMatch(
      /revoke execute on function public\.academy_primary_admin_id\(\) from public, anon, authenticated/,
    );
  });
});
