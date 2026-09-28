import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATIONS = "supabase/migrations";
const allSql = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(`${MIGRATIONS}/${name}`, "utf8"))
  .join("\n");

const signup = readFileSync(
  `${MIGRATIONS}/20261110000000_academy_automatic_registration_numbers.sql`,
  "utf8",
);
const delFn = readFileSync(
  `${MIGRATIONS}/20261117000000_academy_delete_unused_registration_code_fix.sql`,
  "utf8",
);

describe("registration numbers are issued automatically and sequentially", () => {
  it("no longer refuses signup for a missing number", () => {
    // The old trigger raised unless a pre-issued number was supplied.
    expect(signup).toMatch(
      /if normalized_number <> '' then/,
    );
    expect(signup).not.toMatch(
      /raise exception 'We couldn''t verify this registration number[\s\S]*?normalized_number !~ /,
    );
  });

  it("allocates the next number rather than the last plus one unchecked", () => {
    expect(signup).toMatch(
      /coalesce\(max\(serial_number\), 0\) \+ 1/,
    );
  });

  it("locks the year while allocating, so two signups cannot collide", () => {
    // Without the advisory lock two concurrent signups read the same max and
    // collide on the unique (year, serial) index.
    expect(signup).toMatch(
      /pg_advisory_xact_lock\(hashtextextended\('academy-registration-' \|\| target_year::text, 0\)\)/,
    );
  });

  it("refuses to allocate past the serial ceiling rather than wrapping", () => {
    expect(signup).toMatch(/if next_serial > 999 then/);
    expect(signup).toMatch(/are exhausted/);
  });

  it("issues as provisional and stamps acceptance separately", () => {
    expect(signup).toMatch(/status = 'provisional'/);
    expect(signup).toMatch(/set status = 'claimed', accepted_at = now\(\), accepted_by = auth\.uid\(\)/);
  });
});

describe("an issued number is never handed to another student", () => {
  it("refuses to delete an issued number", () => {
    expect(delFn).toMatch(
      /if code_row\.status <> 'available' or code_row\.claimed_by is not null then/,
    );
    expect(delFn).toMatch(/Withdraw it instead/);
  });

  it("deleting an unused number keeps the audit trail without the foreign key", () => {
    // Writing the audit row first and deleting second was refused by the audit
    // table's own foreign key, so deletion could never succeed.
    expect(delFn).toMatch(
      /set registration_code_id = null\s*where registration_code_id = code_row\.id/,
    );
    expect(delFn.indexOf("set registration_code_id = null")).toBeLessThan(
      delFn.indexOf("delete from public.academy_registration_codes"),
    );
  });

  it("withdrawing keeps the row, so the serial stays consumed", () => {
    expect(signup).toMatch(/set status = 'voided', voided_at = now\(\)/);
    expect(signup).not.toMatch(/delete from public\.academy_registration_codes where id = code_row\.id/);
  });
});

describe("the lifecycle functions are admin only", () => {
  for (const fn of [
    "academy_accept_registration",
    "academy_void_registration",
    "academy_edit_registration_number",
    "academy_delete_registration_code",
  ]) {
    it(`guards ${fn}`, () => {
      expect(allSql).toMatch(
        new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?academy_is_admin\\(\\) then`),
      );
    });
  }

  it("keeps the internal allocator unreachable from any role", () => {
    expect(signup).toMatch(
      /revoke execute on function public\.academy_next_registration_serial\(integer\) from public, anon, authenticated/,
    );
  });
});

describe("editing a number cannot collide with a real one", () => {
  it("refuses a serial already used in that year", () => {
    expect(signup).toMatch(
      /That number is already in use for %/,
    );
  });

  it("bounds the serial to the column constraint", () => {
    expect(signup).toMatch(
      /if p_new_serial is null or p_new_serial < 1 or p_new_serial > 999 then/,
    );
  });
});

describe("the signup form no longer asks for a number", () => {
  const page = readFileSync("src/pages/AcademySignup.jsx", "utf8");
  const ctx = readFileSync("src/context/AcademyAuthContext.jsx", "utf8");

  it("has no registration number input", () => {
    expect(page).not.toMatch(/Academy Registration Number/);
    expect(page).not.toMatch(/setRegistrationNumber/);
  });

  it("does not validate a number the student has not been asked for", () => {
    expect(page).not.toMatch(/isValidAcademyRegistrationNumber/);
  });

  it("still lets a school pass a pre-issued number", () => {
    expect(ctx).toMatch(/\.\.\.\(registrationNumber/);
  });

  it("tells the student the number is issued on confirmation", () => {
    expect(page).toMatch(/issued for you automatically/);
  });
});
