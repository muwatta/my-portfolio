import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".jsx")) out.push(full);
  }
  return out;
}

// A component used in JSX but never imported does not fail the build. Rollup
// treats the name as a global, so `npm run build` is green and the page throws
// "X is not defined" the first time somebody opens it. That is exactly what
// happened to the teacher submissions page with GradingInbox, and the only
// reason it was found was a browser console rather than a test.
describe("every component used in JSX is defined somewhere", () => {
  const files = walk("src").filter((f) => !f.includes("__tests__"));
  const offenders = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const body = source.replace(/^import[\s\S]*?from\s+"[^"]+";\s*$/gm, "");

    const imported = new Set();
    for (const match of source.matchAll(/import\s+\{([^}]*)\}\s+from/g)) {
      for (const part of match[1].split(",")) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (name) imported.add(name);
      }
    }
    for (const match of source.matchAll(/import\s+([A-Z][A-Za-z0-9_]*)\s*(?:,|from)/g)) {
      imported.add(match[1]);
    }

    const local = new Set(
      [...body.matchAll(/(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/g)].map(
        (m) => m[1],
      ),
    );
    // Props destructured in a signature are not free identifiers, so
    // { icon: Icon } and friends must not count as uses.
    const destructured = new Set(
      [...body.matchAll(/\{([^}]*)\}\s*(?::|,|\))/g)]
        .flatMap((m) => m[1].split(","))
        .map((part) => part.trim().split(":").pop()?.trim())
        .filter((n) => n && /^[A-Z]/.test(n)),
    );

    for (const match of body.matchAll(/<([A-Z][A-Za-z0-9_]*)[\s/>]/g)) {
      const name = match[1];
      if (name === "React") continue;
      if (imported.has(name) || local.has(name)) continue;
      if (destructured.has(name)) continue;
      offenders.push(`${file} uses <${name}>`);
    }
  }

  it("has no undefined component references", () => {
    expect(offenders).toEqual([]);
  });

  it("actually inspects the pages that broke", () => {
    // A guard that inspects nothing would pass forever.
    expect(files.length).toBeGreaterThan(40);
    expect(files.some((f) => f.includes("AcademyTeacherSubmissions"))).toBe(true);
  });
});
