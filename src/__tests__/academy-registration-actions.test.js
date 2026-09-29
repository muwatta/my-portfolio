import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/pages/AcademyAdminRegistrations.jsx", "utf8");
const listFn = readFileSync(
  "supabase/migrations/20261229000000_reglist_as_sql.sql",
  "utf8",
);
const footer = readFileSync("src/components/academy/AcademyFooter.jsx", "utf8");

describe("the registrations list function actually works", () => {
  // It failed on every call with "structure of query does not match function
  // result type" even though the declared RETURNS TABLE matched the select list
  // column for column and every column worked outside plpgsql. The plpgsql
  // return query machinery was the fault, not the query.
  it("is a plain SQL function, so the structure check cannot fire", () => {
    const code = listFn.replace(/--.*$/gm, "");
    expect(code).toMatch(/^language sql$/m);
    expect(code).not.toMatch(/language plpgsql/);
    expect(code).not.toMatch(/return query/i);
  });

  it("still refuses anyone who is not an administrator", () => {
    expect(listFn).toMatch(/where public\.academy_is_admin\(\)/);
  });

  it("still validates and filters by status", () => {
    expect(listFn).toMatch(/codes\.status = btrim\(status_filter\)/);
  });

  it("grants execute to signed in users only", () => {
    expect(listFn).toMatch(
      /revoke execute on function public\.academy_admin_registration_list\(text, text\) from public, anon/,
    );
  });
});

describe("an administrator can accept and withdraw from the page", () => {
  it("offers Accept on a provisional number", () => {
    expect(page).toMatch(/row\.status === "provisional"/);
    expect(page).toMatch(/onClick=\{\(\) => handleAccept\(row\)\}/);
  });

  it("says plainly what accepting does", () => {
    expect(page).toMatch(/accepted\. The student now has a final number/);
  });

  it("can withdraw, and explains the serial is not reused", () => {
    expect(page).toMatch(/onClick=\{\(\) => handleWithdraw\(row\)\}/);
    expect(page).toMatch(/withdrawn\. The serial is kept, so it is never issued to anyone else/);
  });

  it("does not offer a destructive action on a withdrawn number", () => {
    expect(page).toMatch(/row\.status === "voided" && "Withdrawn"/);
  });

  it("counts what is awaiting acceptance, so it cannot be overlooked", () => {
    expect(page).toMatch(/Awaiting acceptance/);
    expect(page).toMatch(/provisional: rows\.filter/);
  });
});

describe("the footer keeps contact details off the page", () => {
  it("shows WhatsApp as a link, not a number to read", () => {
    expect(footer).toMatch(/>\s*WhatsApp\s*<\/ContactLink>/);
    expect(footer).not.toMatch(/WhatsApp \{WHATSAPP_DISPLAY\}/);
  });

  it("shows Email as a link, not an address to read", () => {
    expect(footer).toMatch(/>\s*Email\s*<\/ContactLink>/);
    expect(footer).not.toMatch(/ariaLabel={`Email us at \$\{EMAIL\}`}/);
  });

  it("still targets the real WhatsApp number and address", () => {
    // Hiding the number from the page must not change where the link goes.
    expect(footer).toMatch(/const WHATSAPP_NUMBER = "2348142797233"/);
    expect(footer).toMatch(/https:\/\/wa\.me\/\$\{WHATSAPP_NUMBER\}/);
    expect(footer).toMatch(/mailto:\$\{EMAIL\}/);
  });

  it("links social profiles externally and safely", () => {
    expect(footer).toMatch(/rel="noopener noreferrer"/);
    expect(footer).toMatch(/SOCIALS/);
    // A placeholder profile would 404 in front of a student.
    const socials = footer.slice(footer.indexOf("const SOCIALS"), footer.indexOf("const FOCUS_RING"));
    expect(socials).not.toMatch(/example\.com|your-profile|placeholder/i);
    expect(socials).toMatch(/https:\/\/github\.com\/muwatta/);
  });
});
