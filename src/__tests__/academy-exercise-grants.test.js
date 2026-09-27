import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATIONS = "supabase/migrations";

// Postgres column privileges accumulate, and a table level revoke does not
// remove privileges granted on individual columns, so the effective grant set has
// to be replayed statement by statement in migration order rather than read off
// any single file. getAcademyExercises filters on published, and Postgres needs
// SELECT privilege for columns used in WHERE, not only in the select list, so a
// missing grant made every student exercise query fail with 403 permission
// denied for table academy_exercises.
function replaySelectPrivileges() {
  const statements = [];
  readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .forEach((name) => {
      const sql = readFileSync(`${MIGRATIONS}/${name}`, "utf8");
      const pattern =
        /(grant|revoke)\s+select\s*\(([^)]*)\)\s*on\s+public\.academy_exercises\s+(?:to|from)\s+([^;]+);/gi;
      let match;
      while ((match = pattern.exec(sql)) !== null) {
        const columns = match[2]
          .toLowerCase()
          .split(/[,\s]+/)
          .map((column) => column.trim())
          .filter(Boolean);
        statements.push({
          file: name,
          action: match[1].toLowerCase(),
          columns,
          roles: match[3].toLowerCase(),
        });
      }
    });
  return statements;
}

function effectiveGrants(roles) {
  const granted = new Set();
  replaySelectPrivileges()
    .filter((statement) =>
      roles.some((role) => statement.roles.includes(role)),
    )
    .forEach((statement) => {
      statement.columns.forEach((column) => {
        if (statement.action === "grant") granted.add(column);
        else granted.delete(column);
      });
    });
  return granted;
}

const browserGrants = effectiveGrants(["authenticated", "anon", "public"]);

describe("academy_exercises browser select privileges", () => {
  it("grants published, which every student query filters on", () => {
    expect(browserGrants.has("published")).toBe(true);
  });

  it("does not leave the hidden test cases readable by the browser", () => {
    expect(browserGrants.has("tests")).toBe(false);
  });

  it("keeps the solution and the correct answer server side", () => {
    expect(browserGrants.has("solution_code")).toBe(false);
    expect(browserGrants.has("correct_answer")).toBe(false);
  });

  it("records a revoke of tests rather than relying on a table level revoke", () => {
    const revokesTests = replaySelectPrivileges().filter(
      (statement) =>
        statement.action === "revoke" && statement.columns.includes("tests"),
    );
    expect(revokesTests.length).toBeGreaterThan(0);
    expect(revokesTests.some((s) => s.roles.includes("authenticated"))).toBe(
      true,
    );
  });
});

describe("the student exercise queries", () => {
  const academy = readFileSync("src/lib/academy.js", "utf8");

  // The select argument is a single quoted string, and everything after the
  // first embedded relation belongs to that other table rather than to
  // academy_exercises, so stop as soon as an embed is reached. Splits only happen
  // at paren depth zero so nested embed arguments are left alone.
  function selectedColumns() {
    return [
      ...academy.matchAll(
        /from\("academy_exercises"\)\s*\.select\(\s*"([\s\S]*?)"/g,
      ),
    ]
      .map((match) => {
        const tokens = [];
        let depth = 0;
        let current = "";
        for (const character of match[1]) {
          if (character === "(") depth += 1;
          if (character === ")") depth -= 1;
          if (character === "," && depth === 0) {
            tokens.push(current);
            current = "";
          } else {
            current += character;
          }
        }
        tokens.push(current);
        return tokens;
      })
      .flat()
      .map((token) => token.trim())
      .filter(Boolean)
      .filter((token) => !token.includes("!"))
      .map((token) => token.split(/\s+as\s+/)[0].trim())
      .filter((token) => !token.includes("("));
  }

  it("finds every direct exercise query", () => {
    expect(selectedColumns().length).toBeGreaterThan(0);
  });

  it("only selects columns the browser is granted", () => {
    selectedColumns().forEach((column) => {
      expect(browserGrants.has(column.toLowerCase())).toBe(true);
    });
  });

  it("never asks the browser to read the answer key", () => {
    selectedColumns().forEach((column) => {
      expect(["tests", "solution_code", "correct_answer"]).not.toContain(
        column.toLowerCase(),
      );
    });
  });
});
