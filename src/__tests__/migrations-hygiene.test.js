import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATIONS = "supabase/migrations";
const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort();

/**
 * Strips comments and dollar-quoted *function* bodies, so a `raise exception`
 * inside a function definition is not mistaken for a top level one. Postgres
 * functions are allowed to raise; a migration is not.
 *
 * Only function bodies are stripped. A bare `do $$ ... $$` block is left intact
 * on purpose, because that is exactly the shape that wedges db push, and
 * stripping every dollar-quoted block would hide it.
 */
function topLevel(sql) {
  return (
    sql
      .replace(/--.*$/gm, "")
      .replace(/create\s+(or\s+replace\s+)?function[\s\S]*?\$\$[\s\S]*?\$\$/gi, "")
      // An anonymous do block, minus its own body, is still top level.
      .replace(/\bdo\s+\$\$/gi, "do ")
  );
}

describe("migrations cannot wedge db push", () => {
  // This project had accumulated a dozen reconciliation migrations because a
  // probe that ended in raise exception aborted its own migration. The row was
  // never written to schema_migrations, so every later push retried the same
  // failing migration and pipelines stopped being able to apply anything.
  const offenders = files.filter((name) =>
    /raise\s+exception/i.test(topLevel(readFileSync(`${MIGRATIONS}/${name}`, "utf8"))),
  );

  it("has no top level raise exception", () => {
    expect(offenders).toEqual([]);
  });

  it("has a reconciliation entry for every former probe", () => {
    // Each one is now a no-op comment, which is what keeps the chain moving.
    for (const name of files.filter((n) => /probe|verify|reconcil/i.test(n))) {
      const sql = readFileSync(`${MIGRATIONS}/${name}`, "utf8");
      expect(sql, `${name} should be a recorded no-op`).toMatch(
        /Reconciliation entry|Read only/i,
      );
    }
  });
});

describe("every migration is non destructive by default", () => {
  it("never drops a table or a column", () => {
    const offenders = files.filter((name) =>
      /^\s*drop\s+(table|column)\b/im.test(
        readFileSync(`${MIGRATIONS}/${name}`, "utf8").replace(/--.*$/gm, ""),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
