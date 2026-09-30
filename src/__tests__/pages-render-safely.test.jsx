import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A page that throws while being imported, or throws on its first render, gives
// a student a blank screen and nothing else. That was reported as "opens some
// pages, shows nothing, throws no error until I refresh it", and it is the kind
// of fault no assertion in the rest of the suite would ever reach.
//
// So this does two things. It loads every page module, which catches a bad
// import or a syntax error in a lazily loaded chunk, and it checks that every
// route in App.jsx actually points at a page that exists, which catches a route
// that would 404 into the app shell.

const pagesDir = "src/pages";
const pageFiles = readdirSync(pagesDir).filter((name) => name.endsWith(".jsx"));

const app = readFileSync("src/App.jsx", "utf8");
const lazyPages = [...app.matchAll(/import\("\.\/pages\/([^"]+)"\)/g)].map(
  (match) => match[1],
);

describe("every page module loads", () => {
  it("there are pages to check", () => {
    expect(pageFiles.length).toBeGreaterThan(50);
  });

  it.each(pageFiles)("%s imports without throwing", async (name) => {
    // The same failure a browser sees: a lazy chunk that cannot be evaluated
    // leaves that route permanently blank, and nothing logs it to the student.
    const module = await import(`../pages/${name}`);
    expect(module.default).toBeTypeOf("function");
  });
});

describe("every route points at something that exists", () => {
  it.each(lazyPages)("/%s is a real page module", (name) => {
    expect(pageFiles).toContain(`${name}.jsx`);
  });

  it("the lazy declarations and the page files agree", () => {
    // A route importing a page that was renamed resolves to undefined at build
    // time and renders an empty element, with no error.
    const missing = lazyPages.filter((name) => !pageFiles.includes(`${name}.jsx`));
    expect(missing).toEqual([]);
  });

  it("no two lazy pages point at the same module by accident", () => {
    const seen = new Set();
    const duplicates = lazyPages.filter((name) => {
      if (seen.has(name)) return true;
      seen.add(name);
      return false;
    });
    expect(duplicates).toEqual([]);
  });
});

describe("a thrown render cannot reach the student as a blank page", () => {
  const boundary = readFileSync("src/components/academy/ErrorBoundary.jsx", "utf8");

  it("the boundary catches render errors", () => {
    expect(boundary).toMatch(/static getDerivedStateFromError/);
    expect(boundary).toMatch(/componentDidCatch/);
  });

  it("it wraps the route outlet, not one page", () => {
    // Around a single page, the next blank page is still blank. It has to be
    // around the outlet so every route is covered by the one boundary.
    const outlet = app.indexOf("<Routes>");
    const open = app.indexOf("<ErrorBoundary");
    const close = app.indexOf("</ErrorBoundary>");
    expect(open).toBeGreaterThan(-1);
    expect(open).toBeLessThan(outlet);
    expect(close).toBeGreaterThan(app.indexOf("</Routes>"));
  });

  it("it explains itself and offers a way out", () => {
    expect(boundary).toMatch(/This page could not be shown/);
    expect(boundary).toMatch(/window\.location\.reload\(\)/);
    expect(boundary).toMatch(/Back to your dashboard/);
  });

  it("it clears itself when the location changes", () => {
    // Otherwise one broken page follows the student around the whole app.
    expect(boundary).toMatch(/resetKey/);
    expect(app).toMatch(/resetKey=/);
  });
});

describe("pages that load several things cannot hang for ever", () => {
  // The other half of the report: not a blank render, but a page whose state
  // never leaves "loading" because one rejected request took the rest with it,
  // and the auto refresh swallows the rejection so nothing ever says otherwise.
  const settle = readFileSync("src/lib/settle.js", "utf8");

  it("there is a shared helper for it", () => {
    expect(settle).toMatch(/export async function settle\(/);
    expect(settle).toMatch(/export async function settleAll\(/);
  });

  it.each(["AcademyExams", "AcademyCourses"])("%s settles its requests", (name) => {
    expect(readFileSync(`src/pages/${name}.jsx`, "utf8")).toMatch(/settle(All)?\(/);
  });

  it("the helper returns an error rather than rethrowing", () => {
    expect(settle).toMatch(/return \{ data: fallback, error: thrown \};/);
  });
});

describe("pages do not read through a join without checking it", () => {
  // academy_weeks and academy_courses are joins. Reading two levels deep
  // without optional chaining throws while rendering, which unmounts the page.
  const deep = /\.academy_weeks\.academy_courses|\.academy_weeks\.week_number|\.academy_subjects\.name/;
  const offenders = pageFiles.filter((name) => {
    const source = readFileSync(`${pagesDir}/${name}`, "utf8");
    return source.split("\n").some((line) => deep.test(line) && !line.includes("?."));
  });

  it("no unguarded nested access remains", () => {
    expect(offenders).toEqual([]);
  });

  it("the lesson page opts in all the way down", () => {
    const lesson = readFileSync("src/pages/AcademyLesson.jsx", "utf8");
    expect(lesson).toMatch(/lesson\.academy_weeks\?\.academy_courses\?\.language/);
    expect(lesson).toMatch(/lesson\.academy_weeks\?\.week_number/);
    expect(lesson).toMatch(/\(lesson\.objectives \?\? \[\]\)\.map/);
  });
});

describe("courses and lessons come back in order", () => {
  const lib = readFileSync("src/lib/academy.js", "utf8");
  const order = readFileSync(
    "supabase/migrations/20261320000000_lesson_order_normalised.sql",
    "utf8",
  );

  it("orders courses by sort_order, not by title", () => {
    // By title was C++, Python, Terminal. By sort_order it is Python, C++,
    // Terminal, which is the order that was chosen. Scoped to the student-facing
    // list, because ordering a course picker by title is fine.
    const list = lib.slice(
      lib.indexOf("export async function getAcademyCourses"),
      lib.indexOf("export async function", lib.indexOf("export async function getAcademyCourses") + 10),
    );
    expect(list).toMatch(/\.order\("sort_order", \{ ascending: true \}\)/);
    expect(list).not.toMatch(/\.order\("title"\)/);
  });

  it("orders lessons by week, then the deliberate order within the week", () => {
    expect(lib).toMatch(/\.order\("academy_weeks\(week_number\)", \{ ascending: true \}\)/);
    expect(lib).toMatch(/\.order\("sort_order", \{ ascending: true \}\)\s*\n\s*\.order\("lesson_number"/);
  });

  it("sets the stored order to match the intended one", () => {
    // sort_order defaulted to 0 and only a few early seeds set it, so a week held
    // a mixture of real numbers and zeros, and the zeros tied with each other.
    // That is the scramble: 0, 0, 0, 0, 4.
    expect(order).toMatch(/set sort_order = l\.lesson_number/);
    expect(order).toMatch(/where l\.sort_order is distinct from l\.lesson_number/);
  });

  it("refuses a sort_order of zero, which means nobody chose it", () => {
    // The state that caused this cannot come back.
    expect(order).toMatch(/academy_lessons_sort_order_positive[\s\S]*check \(sort_order > 0\)/);
    expect(order).toMatch(/academy_weeks_sort_order_positive[\s\S]*check \(sort_order > 0\)/);
  });

  it("checks the result rather than assuming it", () => {
    expect(order).toMatch(/row_number\(\) over/);
    expect(order).toMatch(/raise notice/);
  });
});
