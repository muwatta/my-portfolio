import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lib = readFileSync("src/lib/academy.js", "utf8");
const page = readFileSync("src/pages/AcademyAdminRegistrations.jsx", "utf8");
const footer = readFileSync("src/components/academy/AcademyFooter.jsx", "utf8");

describe("a load failure says why", () => {
  // PostgREST wraps the Postgres reason in details, hint and code, which pushes
  // the message past the length friendlyError will show, so the administrator
  // got a generic sentence and never saw the cause.
  it("keeps the Postgres reason rather than the wrapper", () => {
    expect(lib).toMatch(/error\?\.details \?\? error\?\.message/);
    expect(lib).toMatch(/error\.message = pgMessage \|\| error\.message/);
  });

  it("reports numbers and students separately", () => {
    // A message about numbers must not be blamed on the student list.
    expect(page).toMatch(/if \(registrationResult\.error\)/);
    expect(page).toMatch(/Registration numbers could not be loaded\. Try again in a moment\./);
    expect(page).toMatch(/The student list could not be loaded\./);
  });

  it("clears the error on a successful load", () => {
    expect(page).toMatch(/\} else \{\s*setError\(""\);/);
  });

  it("still recognises a network failure as a connection problem", () => {
    const utils = readFileSync("src/lib/utils.js", "utf8");
    expect(utils).toMatch(/failed to fetch|networkerror/);
    expect(utils).toMatch(/message\.length > 160/);
  });

  it("does not cache a failure, so a retry really retries", () => {
    expect(lib).toMatch(/if \(value\?\.error\) \{[\s\S]*?return staleValue[\s\S]*?\} : value;/);
    expect(lib).toMatch(/academyCache\.set/);
  });
});

describe("social profiles are the real ones", () => {
  it("uses the addresses the Academy owner supplied", () => {
    expect(footer).toMatch(/https:\/\/github\.com\/muwatta/);
    expect(footer).toMatch(
      /https:\/\/www\.linkedin\.com\/in\/abdullahi-musliudeen-64435a239\//,
    );
    expect(footer).toMatch(/https:\/\/web\.facebook\.com\/algorise/);
  });

  it("keeps no placeholder", () => {
    const socials = footer.slice(
      footer.indexOf("const SOCIALS"),
      footer.indexOf("const FOCUS_RING"),
    );
    expect(socials).not.toMatch(/example\.com|your-profile|placeholder/i);
  });

  it("has an icon for each one it lists", () => {
    for (const name of ["GitHub", "LinkedIn"]) {
      expect(footer).toMatch(new RegExp(`name === "${name}"`));
    }
    // Facebook falls through to the default icon at the end of SocialIcon.
    expect(footer).toMatch(/function SocialIcon/);
  });

  it("opens them safely in a new tab", () => {
    expect(footer).toMatch(/rel="noopener noreferrer"/);
  });
});
