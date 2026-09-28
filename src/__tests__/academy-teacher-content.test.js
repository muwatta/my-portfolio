import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATIONS = "supabase/migrations";

const allSql = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(`${MIGRATIONS}/${name}`, "utf8"))
  .join("\n");

const bulkImport = readFileSync(
  `${MIGRATIONS}/20261045000000_academy_bulk_topic_import.sql`,
  "utf8",
);

// The newest definition of each function wins, so mirror that when checking.
function latestDefinition(name) {
  const pattern = new RegExp(
    `create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`,
    "g",
  );
  const matches = [...allSql.matchAll(pattern)];
  expect(matches.length, `${name} should be defined at least once`).toBeGreaterThan(0);
  return matches.at(-1)[0];
}

const CONTENT_FUNCTIONS = [
  "academy_save_lesson",
  "academy_set_lesson_status",
  "academy_duplicate_lesson",
  "academy_reorder_lessons",
  "academy_save_activity",
  "academy_remove_activity",
  "academy_validate_lesson_import",
  "academy_import_lessons",
];

describe("teacher content functions", () => {
  CONTENT_FUNCTIONS.forEach((name) => {
    it(`${name} is security definer with a pinned search path`, () => {
      const definition = latestDefinition(name);
      expect(definition).toMatch(/security definer/i);
      expect(definition).toMatch(/set search_path = public/i);
    });

    it(`${name} refuses callers who are not teachers`, () => {
      const definition = latestDefinition(name);
      expect(definition).toMatch(/academy_require_teacher\(\)|academy_is_teacher\(\)/i);
    });

    it(`${name} is not executable by anon`, () => {
      expect(allSql).toMatch(
        new RegExp(
          `revoke execute on function public\\.${name}\\([^)]*\\) from public, anon`,
        ),
      );
    });

    it(`${name} is executable by a signed in user`, () => {
      expect(allSql).toMatch(
        new RegExp(
          `grant execute on function public\\.${name}\\([^)]*\\) to authenticated`,
        ),
      );
    });
  });
});

describe("topic lifecycle rules live in the database", () => {
  it("derives a slug from the title so a fast form needs no slug field", () => {
    const definition = latestDefinition("academy_save_lesson");
    expect(definition).toMatch(/regexp_replace/);
    expect(definition).toMatch(/trim\(both '-' from/);
  });

  it("rejects an unknown status", () => {
    expect(latestDefinition("academy_save_lesson")).toMatch(
      /Unknown status/,
    );
    expect(latestDefinition("academy_set_lesson_status")).toMatch(
      /Unknown status/,
    );
  });

  it("requires a release time before a topic can be scheduled", () => {
    const definition = latestDefinition("academy_set_lesson_status");
    expect(definition).toMatch(
      /scheduled topic needs a release time/,
    );
  });

  it("only lets a prerequisite come from the same course", () => {
    const definition = latestDefinition("academy_save_lesson");
    expect(definition).toMatch(/same course/);
    expect(definition).toMatch(/academy_weeks/);
  });

  it("clears the release gate when publishing immediately", () => {
    const definition = latestDefinition("academy_set_lesson_status");
    expect(definition).toMatch(
      /when target_status = 'published' then coalesce\(release_at, now\(\)\)/,
    );
  });
});

describe("duplicating a topic", () => {
  const definition = latestDefinition("academy_duplicate_lesson");

  it("always leaves the copy as a draft", () => {
    expect(definition).toMatch(/'draft', null,/);
  });

  it("keeps the slug unique inside the week", () => {
    expect(definition).toMatch(/while exists \(select 1 from public\.academy_lessons/);
  });

  it("copies the subtopics and the attached activities", () => {
    expect(definition).toMatch(/from public\.academy_lesson_subtopics/);
    expect(definition).toMatch(/from public\.academy_lesson_activities/);
  });
});

describe("reordering", () => {
  it("only touches lessons inside the supplied week", () => {
    const definition = latestDefinition("academy_reorder_lessons");
    expect(definition).toMatch(/and week_id = p_week_id/);
  });

  it("needs at least one topic", () => {
    expect(latestDefinition("academy_reorder_lessons")).toMatch(
      /at least one topic are required/,
    );
  });
});

describe("attaching activities", () => {
  const definition = latestDefinition("academy_save_activity");

  it("checks the referenced item actually exists", () => {
    expect(definition).toMatch(/from public\.academy_exercises where id = p_ref_id/);
    expect(definition).toMatch(/from public\.academy_assignments where id = p_ref_id/);
    expect(definition).toMatch(/from public\.academy_projects where id = p_ref_id/);
  });

  it("reuses an existing row rather than creating a duplicate", () => {
    expect(definition).toMatch(/on conflict \(lesson_id, kind, ref_id\)/);
  });
});

describe("bulk import safety", () => {
  it("validates without writing anything", () => {
    expect(bulkImport).toMatch(/returns table \(\s*row_index integer/);
    const validator = latestDefinition("academy_validate_lesson_import");
    expect(validator).toMatch(/stable/);
  });

  it("forces every imported topic to land as a draft", () => {
    const importer = latestDefinition("academy_import_lessons");
    expect(importer).toMatch(/if target_status <> 'draft' then/);
    expect(importer).toMatch(/target_status := 'draft'/);
  });

  it("skips a bad row and reports it instead of aborting the file", () => {
    const importer = latestDefinition("academy_import_lessons");
    expect(importer).toMatch(/continue when check_row\.valid/);
    expect(importer).toMatch(/failure_list/);
  });

  it("caps how much can be imported at once", () => {
    expect(bulkImport).toMatch(/max_rows integer/);
    expect(bulkImport).toMatch(/Import at most % topics at a time/);
  });

  it("rejects a payload that is not an array", () => {
    expect(latestDefinition("academy_validate_lesson_import")).toMatch(
      /Rows must be a JSON array/,
    );
  });

  it("catches a duplicate slug inside the same file, not just against the database", () => {
    const validator = latestDefinition("academy_validate_lesson_import");
    expect(validator).toMatch(/taken_slugs := taken_slugs \|\| candidate_slug/);
  });

  it("qualifies lesson_number so the out parameter cannot shadow the column", () => {
    const validator = latestDefinition("academy_validate_lesson_import");
    expect(validator).toMatch(/max\(l\.lesson_number\)/);
  });

  it("reads objectives from text, not by unwrapping jsonb a second time", () => {
    const importer = latestDefinition("academy_import_lessons");
    expect(importer).toMatch(/from jsonb_array_elements_text/);
    expect(importer).not.toMatch(/array_agg\(btrim\(value #>>/);
  });
});

describe("the topic editor is wired to the server helpers", () => {
  const lib = readFileSync("src/lib/academyContent.js", "utf8");
  const page = readFileSync("src/pages/AcademyTeacherLessons.jsx", "utf8");

  it("routes writes through the rpcs rather than direct table updates", () => {
    expect(lib).toMatch(/supabase\.rpc\("academy_save_lesson"/);
    expect(lib).toMatch(/supabase\.rpc\("academy_set_lesson_status"/);
    expect(lib).toMatch(/supabase\.rpc\("academy_duplicate_lesson"/);
    expect(lib).toMatch(/supabase\.rpc\("academy_reorder_lessons"/);
    expect(page).not.toMatch(/from\("academy_lessons"\)\s*\.update/);
  });

  it("loads the lifecycle columns the editor shows", () => {
    const academy = readFileSync("src/lib/academy.js", "utf8");
    ["status", "release_at", "due_at", "points", "late_policy", "unlock_after_id"].forEach(
      (column) => expect(academy).toContain(column),
    );
  });
});
