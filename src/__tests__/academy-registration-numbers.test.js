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
const registrationNumbers = readFileSync(
  `${MIGRATIONS}/20261025000000_academy_registration_numbers.sql`,
  "utf8",
);
const verifiedSignup = readFileSync(
  `${MIGRATIONS}/20261401000000_academy_verified_registration_profiles.sql`,
  "utf8",
);
const delFn = readFileSync(
  `${MIGRATIONS}/20261117000000_academy_delete_unused_registration_code_fix.sql`,
  "utf8",
);

describe("registration numbers are issued automatically and sequentially", () => {
  it("issues a number only after email confirmation", () => {
    expect(verifiedSignup).toMatch(
      /after update of email_confirmed_at on auth\.users/,
    );
    expect(verifiedSignup).toMatch(
      /old\.email_confirmed_at is not null or new\.email_confirmed_at is null/,
    );
    expect(verifiedSignup).toMatch(
      /if new\.email_confirmed_at is null then\s+return new/,
    );
    expect(verifiedSignup).toMatch(/'claimed'/);
    expect(verifiedSignup).toMatch(/source', 'email_confirmation'/);
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

  it("removes unused numbers and disables creating new unassigned numbers", () => {
    expect(verifiedSignup).toMatch(/delete from public\.academy_registration_codes codes[\s\S]*?codes\.status = 'available'/);
    expect(verifiedSignup).toMatch(/codes\.status = 'provisional'[\s\S]*?users\.email_confirmed_at is null/);
    expect(verifiedSignup).toMatch(/revoke execute on function public\.academy_generate_registration_codes\(integer, integer\)/);
    expect(verifiedSignup).toMatch(/revoke execute on function public\.academy_assign_registration_code\(uuid, text\)/);
  });

  it("preserves existing assigned numbers when cleaning unused numbers", () => {
    expect(verifiedSignup).toMatch(/codes\.claimed_by is null/);
    expect(verifiedSignup).toMatch(/not exists \([\s\S]*?profiles\.registration_code_id = codes\.id/);
    expect(verifiedSignup).toMatch(/verified_student_backfill/);
  });

  it("reconnects an existing claim before allocating during backfill", () => {
    const backfill = verifiedSignup.slice(
      verifiedSignup.indexOf("-- Existing confirmed students without an assigned number"),
    );
    expect(backfill).toMatch(
      /where claimed_by = student_row\.id\s+for update[\s\S]*?if found then[\s\S]*?else[\s\S]*?insert into public\.academy_registration_codes[\s\S]*?end if;[\s\S]*?set registration_code_id = code_row\.id/,
    );
    expect(verifiedSignup).toMatch(
      /where claimed_by = new\.id\s+for update[\s\S]*?if found then[\s\S]*?set registration_code_id = code_row\.id/,
    );
  });

  it("keeps manually changed serials consumed for future allocations", () => {
    expect(verifiedSignup).toMatch(/registration_code_id is not null[\s\S]*?registration_number ~ /);
    expect(verifiedSignup).toMatch(/max\(substring\(registration_number from 8\)::integer\)/);
    expect(verifiedSignup).toMatch(/previous_number/);
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
    expect(verifiedSignup).toMatch(
      /That number is already in use for %/,
    );
  });

  it("bounds the serial to the column constraint", () => {
    expect(verifiedSignup).toMatch(
      /if p_new_serial is null or p_new_serial < 1 or p_new_serial > 999 then/,
    );
  });

  it("allows administrators to edit a student's existing serial from the UI", () => {
    const page = readFileSync("src/pages/AcademyAdminRegistrations.jsx", "utf8");
    const library = readFileSync("src/lib/academy.js", "utf8");
    expect(page).toMatch(/editAcademyRegistrationNumber\(/);
    expect(page).toMatch(/New serial/);
    expect(page).not.toMatch(/Generate Registration Numbers|Show unused/);
    expect(library).toMatch(/academy_edit_registration_number/);
  });

  it("keeps student numbers and email addresses unique", () => {
    const emailMigration = readFileSync(
      `${MIGRATIONS}/20261203000000_academy_profile_email.sql`,
      "utf8",
    );
    expect(registrationNumbers).toMatch(/unique \(registration_number\)/);
    expect(registrationNumbers).toMatch(/unique \(registration_year, serial_number\)/);
    expect(emailMigration).toMatch(/unique index if not exists academy_profiles_email_key/);
    expect(emailMigration).toMatch(/lower\(email\)/);
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

  it("sends the selected provisioned school to signup", () => {
    expect(page).toMatch(/getAcademySchools/);
    expect(page).toMatch(/Select your school/);
    expect(page).toMatch(/selectedSchool/);
    expect(ctx).toMatch(/school_code: selectedSchool\.code/);
  });

  it("requires school selection before signup and explains number issuance", () => {
    expect(page).toMatch(/if \(!selectedSchool\)/);
    expect(page).toMatch(/issued for you automatically/);
  });

  it("allows the verified student number as a login identifier", () => {
    const loginPage = readFileSync("src/pages/AcademyLogin.jsx", "utf8");
    expect(loginPage).toMatch(/Verified email or registration number/);
    expect(ctx).toMatch(/academy-registration-login/);
  });

  it("limits profile schools and states to active, provisioned schools", () => {
    const profile = readFileSync("src/pages/AcademyProfile.jsx", "utf8");
    const layout = readFileSync(
      "src/components/academy/AcademyLayout.jsx",
      "utf8",
    );
    expect(page).toMatch(/required[\s\S]*?schools\.map/);
    expect(profile).toMatch(/state: selectedSchool\?\.state/);
    expect(profile).toMatch(/State[\s\S]*?readOnly/);
    expect(layout).toMatch(/profileIncomplete/);
    expect(layout).toMatch(/animate-pulse/);
    expect(layout).toMatch(/Your profile needs attention/);
  });

  it("does not expose the account email during registration-number lookup", () => {
    const loginFunction = readFileSync(
      "supabase/functions/academy-registration-login/index.ts",
      "utf8",
    );
    expect(loginFunction).toMatch(/getUserById/);
    expect(loginFunction).toMatch(/signInWithPassword/);
    expect(loginFunction).not.toMatch(/json\(\{\s*email/);
  });
});
