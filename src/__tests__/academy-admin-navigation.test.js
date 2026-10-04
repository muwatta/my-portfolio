import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync("src/components/academy/AcademyLayout.jsx", "utf8");
const app = readFileSync("src/App.jsx", "utf8");

function extractLinks(constantName) {
  const block = layout.match(
    new RegExp(`const ${constantName} = \\[([\\s\\S]*?)\\n\\];`),
  )?.[1];
  if (!block) throw new Error(`${constantName} not found in AcademyLayout.jsx`);
  return [...block.matchAll(/to:\s*"([^"]+)"/g)].map((match) => match[1]);
}

const declaredRoutes = [
  ...app.matchAll(/path="([^"]+)"/g),
].map((match) => match[1]);

describe("an administrator can reach the leaderboard", () => {
  it("offers it in the admin navigation", () => {
    expect(extractLinks("ADMIN_LINKS")).toContain("/academy/admin/leaderboard");
  });

  it("sits alongside the other performance views", () => {
    const links = extractLinks("ADMIN_LINKS");
    const at = links.indexOf("/academy/admin/leaderboard");
    expect(at).toBeGreaterThan(0);
    expect(links).toContain("/academy/admin/analytics");
  });
});

// The leaderboard page existed and was guarded, but nothing linked to it, so an
// admin could only reach it by typing the URL. Checking every admin entry against
// the declared routes catches that class of gap for all current and future links.
describe("every navigation entry points at a real route", () => {
  for (const constantName of [
    "STUDENT_LINKS",
    "TEACHER_LINKS",
    "ADMIN_LINKS",
  ]) {
    it(`${constantName} has no dead links`, () => {
      const dead = extractLinks(constantName).filter(
        (to) => !declaredRoutes.includes(to),
      );
      expect(dead).toEqual([]);
    });
  }
});

describe("the admin leaderboard stays behind the administrator guard", () => {
  it("is declared inside the guarded admin route group", () => {
    const guardIndex = app.indexOf("element={<AcademyAdminGuard />}");
    const leaderboardIndex = app.indexOf('path="/academy/admin/leaderboard"');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(leaderboardIndex).toBeGreaterThan(guardIndex);
  });
});