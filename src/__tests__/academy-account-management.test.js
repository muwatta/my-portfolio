import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fn = readFileSync(
  "supabase/functions/academy-admin-manage-user/index.ts",
  "utf8",
);
const emailSql = readFileSync(
  "supabase/migrations/20261203000000_academy_profile_email.sql",
  "utf8",
);
const rls = readFileSync(
  "supabase/migrations/20261209000000_profile_email_rls.sql",
  "utf8",
);
const forgot = readFileSync("src/pages/AcademyForgotPassword.jsx", "utf8");
const reset = readFileSync("src/pages/AcademyResetPassword.jsx", "utf8");
const profile = readFileSync("src/pages/AcademyAdminStudentProfile.jsx", "utf8");
const signup = readFileSync("src/lib/registration.js", "utf8");

describe("one account per email address", () => {
  it("is enforced by a unique index, not by whichever code checked first", () => {
    expect(emailSql).toMatch(
      /create unique index if not exists academy_profiles_email_key\s*on public\.academy_profiles \(lower\(email\)\)\s*where email is not null/,
    );
  });

  it("treats a case difference as the same address", () => {
    expect(emailSql).toMatch(/\(lower\(email\)\)/);
  });

  it("stores the address on signup, or the index would reject the second student", () => {
    expect(emailSql.replace(/\s+/g, " ")).toContain(
      "insert into public.academy_profiles ( id, display_name, role, school_id, state, city, registration_code_id, email )",
    );
    expect(emailSql).toMatch(/lower\(new\.email\)/);
  });

  it("keeps the address current when it changes", () => {
    expect(emailSql).toMatch(
      /create trigger academy_auth_user_email\s*after insert or update of email on auth\.users/,
    );
  });

  it("frees the address again once the account is deleted", () => {
    // The profile row goes with the auth user, so nothing holds the address.
    expect(fn).toMatch(/auth\.admin\.deleteUser\(target\)/);
  });

  it("still tells a signing up student an account may exist, without confirming it", () => {
    expect(signup).toMatch(/may already exist/);
  });
});

describe("students cannot harvest other students' addresses", () => {
  it("limits the email column to staff and the owner", () => {
    expect(rls).toMatch(
      /for select to authenticated\s*using \(public\.academy_is_teacher\(\) or id = auth\.uid\(\)\)/,
    );
  });
});

describe("only an administrator can manage accounts", () => {
  it("verifies with the caller's own token, not the request body", () => {
    expect(fn).toMatch(/callerClient\.rpc\("academy_is_admin"\)/);
    expect(fn).toMatch(/Only Academy administrators can manage accounts/);
  });

  it("needs the service role, so the key never reaches the browser", () => {
    expect(fn).toMatch(/Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  });
});

describe("account management cannot lock the Academy out", () => {
  it("pins the owner by id rather than comparing an address", () => {
    // An address comparison could not be trusted to match consistently here.
    expect(fn).toMatch(/const OWNER_ID = "45501f33-911d-495b-a994-ba654683e521"/);
    expect(fn).toMatch(/if \(target === OWNER_ID\)/);
  });

  it("refuses an administrator editing or deleting themselves", () => {
    expect(fn).toMatch(
      /if \(target === userResult\.user\.id\)\s*return json\(\{ error: "You cannot delete or edit your own account\." \}, 403\)/,
    );
  });

  it("keeps at least one removable administrator", () => {
    expect(fn).toMatch(/That is the last removable administrator/);
  });

  it("requires a reason before deleting, and records it", () => {
    expect(fn).toMatch(
      /if \(!reason\)\s*return json\(\s*\{ error: "A reason is required before deleting an account\." \}/,
    );
    expect(fn).toMatch(/action: "account_deleted"/);
    expect(fn).toMatch(/action: "account_updated"/);
  });

  it("checks the target still exists before acting", () => {
    expect(fn).toMatch(/That account no longer exists/);
  });
});

describe("the forgot password flow helps someone who is actually stuck", () => {
  it("does not reveal whether an address is registered", () => {
    expect(forgot.replace(/\s+/g, " ")).toMatch(
      /If that address has an Academy account/,
    );
    expect(forgot).not.toMatch(/no account|does not exist|not registered/);
  });

  it("rate limits the send button", () => {
    expect(forgot).toMatch(/const RESEND_SECONDS = 45/);
    expect(forgot).toMatch(/disabled=\{submitting \|\| cooldown > 0\}/);
  });

  it("validates the address before calling the server", () => {
    expect(forgot).toMatch(/Enter a valid email address/);
  });

  it("tells a locked out student an administrator can fix it", () => {
    // Now a shared component, so check it is used and that the component
    // actually offers the two things an administrator can do.
    expect(forgot).toMatch(/<ContactAdmin context="resetting my password"/);
    const contact = readFileSync(
      "src/components/academy/ContactAdmin.jsx",
      "utf8",
    );
    const flat = contact.replace(/\s+/g, " ");
    expect(flat).toMatch(/correct a wrong email address/);
    expect(flat).toMatch(/reset your access/);
  });
});

describe("an expired reset link is not a dead end", () => {
  it("detects that the recovery session is missing", () => {
    expect(reset).toMatch(/const hasRecoverySession = Boolean\(user\)/);
  });

  it("offers a new link instead of a form that cannot work", () => {
    expect(reset).toMatch(/This link is no longer valid/);
    expect(reset).toMatch(/to="\/academy\/forgot-password"/);
  });

  it("waits for auth state before deciding the link is dead", () => {
    expect(reset).toMatch(/if \(!loading && !hasRecoverySession\)/);
  });

  it("rejects the passwords that actually cause lockouts", () => {
    expect(reset).toMatch(/Use at least 8 characters/);
    expect(reset).toMatch(/not only numbers/);
    expect(reset).toMatch(/cannot start or end with a space/);
  });

  it("explains a failure as an expired link rather than a bare error", () => {
    expect(reset).toMatch(/expired or has already been used/);
  });
});

describe("the admin can edit or delete from the student page", () => {
  it("has both actions", () => {
    expect(profile).toMatch(/Edit account/);
    expect(profile).toMatch(/Delete account/);
  });

  it("warns that deletion frees the address so the student can re-register", () => {
    const flat = profile.replace(/\s+/g, " ");
    expect(flat).toMatch(/freed so they can register again/);
    expect(flat).toMatch(/cannot be undone/);
  });

  it("requires a reason before the delete button enables", () => {
    expect(profile).toMatch(/disabled=\{busy \|\| !reason\.trim\(\)\}/);
  });

  it("leaves the email field blank to mean keep the current address", () => {
    expect(profile).toMatch(/Leave empty to keep the current address/);
  });
});
