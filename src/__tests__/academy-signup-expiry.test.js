import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const expiryMigration = readFileSync(
  "supabase/migrations/20261349000000_academy_unconfirmed_signup_expiry.sql",
  "utf8",
);
const verifiedRegistrationMigration = readFileSync(
  "supabase/migrations/20261401000000_academy_verified_registration_profiles.sql",
  "utf8",
);
const accountFunction = readFileSync(
  "supabase/functions/academy-admin-manage-user/index.ts",
  "utf8",
);
const studentList = readFileSync("src/pages/AcademyAdminStudents.jsx", "utf8");

describe("unconfirmed Academy signup expiry", () => {
  it("expires only unconfirmed student accounts after three hours since the latest email", () => {
    expect(expiryMigration).toMatch(/p\.role = 'student'/);
    expect(expiryMigration).toMatch(/u\.email_confirmed_at is null/);
    expect(expiryMigration).toMatch(
      /coalesce\(u\.confirmation_sent_at, u\.created_at\)\s*<= now\(\) - interval '3 hours'/,
    );
  });

  it("runs cleanup every five minutes and keeps it unavailable to client roles", () => {
    expect(expiryMigration).toMatch(/'\*\/5 \* \* \* \*'/);
    expect(expiryMigration).toMatch(
      /revoke all on function public\.academy_expire_unconfirmed_student_signups\(\)\s+from public, anon, authenticated/,
    );
  });

  it("audits expiry and removes any unconfirmed provisional number", () => {
    expect(expiryMigration).toMatch(/action,\s*reason,\s*metadata/);
    expect(expiryMigration).toMatch(/'signup_expired'/);
    expect(expiryMigration).toMatch(/status = 'provisional'/);
    expect(verifiedRegistrationMigration).toMatch(
      /academy_release_provisional_registration_on_user_delete[\s\S]*?delete from public\.academy_registration_codes/,
    );
    expect(verifiedRegistrationMigration).toMatch(/academy\.registration_cleanup/);
  });
});

describe("manual student account deletion", () => {
  it("records the registration number before deleting the account", () => {
    expect(accountFunction).toMatch(
      /registration_number:\s*registrationCode\?\.registration_number\s*\?\?\s*"UNASSIGNED"/,
    );
    expect(accountFunction).toMatch(/if \(auditError\)/);
    expect(accountFunction).toMatch(/auth\.admin\.deleteUser\(target\)/);
    // The audit must be written, and fail loudly, before the account is removed.
    expect(accountFunction.indexOf("if (auditError)")).toBeLessThan(
      accountFunction.indexOf("auth.admin.deleteUser(target)"),
    );
  });

  it("lets admins find a student by the unique email address", () => {
    expect(studentList).toMatch(/student\.email/);
    expect(studentList).toMatch(/Search by name, email, registration number, or school/);
  });
});
