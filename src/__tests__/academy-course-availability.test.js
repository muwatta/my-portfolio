import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261334000000_academy_two_available_courses.sql",
  "utf8",
);
const publicCourses = readFileSync("src/pages/PublicCourses.jsx", "utf8");
const homePreview = readFileSync(
  "src/features/home/sections/CoursePreview.jsx",
  "utf8",
);
const lesson = readFileSync("src/pages/AcademyLesson.jsx", "utf8");
const courseDetail = readFileSync("src/pages/CourseDetail.jsx", "utf8");
const prerender = readFileSync("scripts/prerender.mjs", "utf8");
const sitemap = readFileSync("public/sitemap.xml", "utf8");

describe("only the requested Academy courses are available", () => {
  it("keeps the Python AI/ML and C++ embedded courses active and published", () => {
    expect(migration).toMatch(
      /slug in \(\s*'python-for-ai-machine-learning',\s*'cpp-embedded-robotics'\s*\)/,
    );
    expect(migration).toMatch(/published = true,\s*is_active = true/);
    expect(migration).toContain("'Python for AI and ML'");
    expect(migration).toContain("'C++ for Embedded Systems'");
  });

  it("unpublishes and deactivates every other course without deleting records", () => {
    // Asserted as two independent facts. An UPDATE assigns its SET columns
    // before the WHERE clause, so expecting one to follow the other would be
    // asserting the wrong SQL shape rather than the intended behaviour.
    expect(migration).toMatch(
      /slug not in \(\s*'python-for-ai-machine-learning',\s*'cpp-embedded-robotics'\s*\)/,
    );
    expect(migration).toMatch(/published = false,\s*is_active = false/);
    expect(migration).not.toMatch(/\bdelete\s+from\b/i);
  });

  it("shows only published Academy courses in the public course catalogue", () => {
    expect(publicCourses).toContain("fetchPublicCourses()");
    expect(publicCourses).not.toContain("fetchCourses");
    expect(courseDetail).toContain("fetchPublicCourse(slug)");
    expect(courseDetail).not.toContain("fetchCourse(slug)");
  });

  it("advertises both available courses from the home page", () => {
    // Quote-agnostic: the slugs are data, and asserting a particular quote
    // style would fail on a formatting change with no behaviour change.
    for (const slug of [
      "python-for-ai-machine-learning",
      "cpp-embedded-robotics",
    ]) {
      expect(homePreview).toMatch(new RegExp(slug));
    }
    expect(homePreview).toContain("Python for AI and Machine Learning");
    expect(homePreview).toContain("C++ for Embedded Systems");
  });

  it("does not prerender or list retired course pages", () => {
    expect(prerender).not.toContain('vite.ssrLoadModule("/src/data/courses.js")');
    expect(prerender).not.toContain("...courses.map");
    expect(sitemap).not.toContain("terminal-and-command-line");
    expect(sitemap).toContain("/courses/python-for-ai-machine-learning");
    expect(sitemap).toContain("/courses/cpp-embedded-robotics");
  });

  it("renders an in-lesson interactive terminal for C++ course lessons", () => {
    expect(lesson).toMatch(/isCppCourse && content\.starter_code/);
    expect(lesson).toMatch(/<CppEditor starterCode=\{content\.starter_code\}/);
    expect(lesson).toContain("C++ embedded-systems terminal");
  });
});
