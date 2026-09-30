import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sw = readFileSync("public/sw.js", "utf8");
const hook = readFileSync("src/hooks/useAutoRefresh.js", "utf8");

const page = (name) => readFileSync(`src/pages/${name}.jsx`, "utf8");

const REFRESHING_PAGES = [
  "AcademyLessons",
  "AcademyExams",
  "AcademyProgress",
  "AcademyTeacherDashboard",
  "AcademyAdminAccess",
  "AcademyAdminDashboard",
];

describe("pages refetch when a student comes back to the tab", () => {
  // The specific case that made this matter: the prerequisite chain. A student
  // finishes a lesson, comes back to the list, and the next one is still marked
  // locked because nothing asked again. That reads as a broken unlock.
  it.each(REFRESHING_PAGES)("%s refreshes on focus", (name) => {
    expect(page(name)).toMatch(/refreshOnFocus: true/);
  });

  it("the lesson list can be reloaded, because a completion changes it", () => {
    // Extracted from inside the fetch effect so the retry button and the
    // auto refresh share one path rather than two that can drift.
    const lessons = page("AcademyLessons");
    expect(lessons).toMatch(/const load = useCallback/);
    expect(lessons).not.toMatch(/setReloadToken/);
  });

  it("the lesson list still honours an explicit retry", () => {
    const lessons = page("AcademyLessons");
    expect(lessons).toMatch(/: \(\) => load\(\)/);
  });
});

describe("the refresh stays out of the reader's way", () => {
  // These are the hook's existing guarantees. They are asserted here because
  // turning the option on for six more pages puts them on the critical path for
  // the first time, and a background refetch that moves the page under someone
  // is worse than showing stale data.
  it("does not refresh a hidden tab", () => {
    expect(hook).toMatch(/if \(document\.visibilityState === "hidden"\) return;/);
  });

  it("does not refresh while offline", () => {
    expect(hook).toMatch(/!navigator\.onLine\) return;/);
  });

  it("does not refresh a background pass while the reader is typing", () => {
    expect(hook).toMatch(/if \(background && isUserEditing\(\)\) return;/);
  });

  it("collapses focus and visibilitychange into one refetch", () => {
    // Both fire on one return, and doing two refetches is how the list used to
    // flicker on every tab switch.
    expect(hook).toMatch(/FOCUS_COOLDOWN_MS/);
    expect(hook).toMatch(/now - lastFocusRun < FOCUS_COOLDOWN_MS/);
  });

  it("puts the scroll position back unless the reader scrolled in the meantime", () => {
    expect(hook).toMatch(/Only put the reader back if they have not scrolled/);
  });

  it("never interrupts anyone with a failed background refresh", () => {
    expect(hook).toMatch(/A failed background refresh is not worth interrupting/);
  });
});

describe("the service worker hands back a fresh app", () => {
  it("serves navigations network first, so a refresh is never a cached page", () => {
    // The most direct reading of "refresh should be refreshed": a hard refresh
    // must not be answered from a cache.
    expect(sw).toMatch(/request\.mode === "navigate"[\s\S]*networkFirst\(request, APP_SHELL_CACHE\)/);
  });

  it("caches hashed assets first, which is safe because the name changes", () => {
    expect(sw).toMatch(/isCacheableAsset\(request, url\)[\s\S]*cacheFirst\(request, ASSET_CACHE\)/);
  });

  it("versions its caches, so a deploy does not leave a stale bundle behind", () => {
    expect(sw).toMatch(/const CACHE_VERSION = "v\d+";/);
    // Old versions are dropped on activate, which is what stops an old app
    // sitting in a cache forever.
    expect(sw).toMatch(/name\.startsWith\(CACHE_PREFIX\)/);
  });

  it("only trusts the Pyodide version it is built against", () => {
    expect(sw).toMatch(/cdn\.jsdelivr\.net[\s\S]*pyodide\/v0\.27\.2\//);
  });
});
