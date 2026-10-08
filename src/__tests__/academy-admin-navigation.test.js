import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync("src/components/academy/AcademyLayout.jsx", "utf8");
const studentNavigation = readFileSync(
  "src/components/academy/studentNavigation.js",
  "utf8",
);
const studentSections = readFileSync(
  "src/components/academy/StudentSectionNav.jsx",
  "utf8",
);
const app = readFileSync("src/App.jsx", "utf8");

function extractLinks(constantName) {
  const source =
    constantName === "STUDENT_LINKS"
      ? studentNavigation
      : constantName === "TEACHER_LINKS" || constantName === "ADMIN_LINKS"
        ? layout
        : studentSections;
  const declaration =
    constantName === "STUDENT_LINKS"
      ? "STUDENT_NAVIGATION"
      : constantName === "STUDENT_SECTION_LINKS"
        ? "SECTIONS"
        : constantName;
  const block = source.match(
    new RegExp(`(?:const|export const) ${declaration} = \\[([\\s\\S]*?)\\n\\];`),
  )?.[1];
  if (!block) throw new Error(`${constantName} not found`);
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


describe("every navigation entry points at a real route", () => {
  for (const constantName of [
    "STUDENT_LINKS",
    "STUDENT_SECTION_LINKS",
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

describe("the Academy mobile header and navigation", () => {
  it("places the Academy logo before the right-aligned menu button", () => {
    expect(layout.indexOf('src="/images/ate-logo.jpg"')).toBeLessThan(
      layout.indexOf('aria-label={navigationOpen ? "Close navigation" : "Open navigation"}'),
    );
  });

  it("puts help in the mobile sidebar and keeps connection status visible", () => {
    expect(layout).toMatch(/to="\/academy\/faq"[\s\S]*?Help and FAQ/);
    expect(layout).toMatch(/hidden h-10 w-10[\s\S]*?lg:grid/);
    const offlineStatus = readFileSync(
      "src/components/academy/OfflineStatus.jsx",
      "utf8",
    );
    expect(offlineStatus).toMatch(/inline sm:hidden/);
    expect(offlineStatus).toMatch(/hidden sm:inline/);
  });
});

describe("student tests navigation", () => {
  it("renders the tests route inside the student dashboard layout", () => {
    const studentLayoutStart = app.indexOf(
      "element={<AcademyStudentLayout />}",
    );
    const teacherRoutesStart = app.indexOf(
      "element={<AcademyTeacherGuard />}",
    );
    const studentRoutes = app.slice(studentLayoutStart, teacherRoutesStart);

    expect(studentRoutes).toMatch(
      /path="\/academy\/exams"\s+element=\{<AcademyExams \/>\}/,
    );
  });
});

describe("the admin leaderboard stays behind the administrator guard", () => {
  it("is declared inside the guarded admin route group", () => {
    const guardIndex = app.indexOf("element={<AcademyAdminGuard />}");
    const leaderboardIndex = app.indexOf('path="/academy/admin/leaderboard"');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(leaderboardIndex).toBeGreaterThan(guardIndex);
  });
});

describe("student-facing course previews", () => {
  it("declares the course preview route inside the administrator guard", () => {
    const guardIndex = app.indexOf("element={<AcademyAdminGuard />}");
    const previewIndex = app.indexOf(
      'path="/academy/admin/previews/:courseSlug"',
    );
    expect(guardIndex).toBeGreaterThan(-1);
    expect(previewIndex).toBeGreaterThan(guardIndex);
    expect(app).toContain("<AcademyAdminCoursePreview />");
  });
});