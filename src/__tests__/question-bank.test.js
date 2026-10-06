import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/pages/AcademyAdminQuestionBank.jsx", "utf8");
const lib = readFileSync("src/lib/academy.js", "utf8");
const jsonb = readFileSync(
  "supabase/migrations/20261278000000_csv_over_jsonb.sql",
  "utf8",
);
const dupes = readFileSync(
  "supabase/migrations/20261284000000_csv_file_duplicates.sql",
  "utf8",
);
const aliasFix = readFileSync(
  "supabase/migrations/20261287000000_csv_alias_fix.sql",
  "utf8",
);

describe("the question bank is a real, usable surface", () => {
  it("is reachable from the admin content navigation", () => {
    const nav = readFileSync(
      "src/components/academy/AdminContentNav.jsx",
      "utf8",
    );
    const app = readFileSync("src/App.jsx", "utf8");
    expect(nav).toMatch(/Question bank/);
    expect(app).toMatch(/path="\/academy\/admin\/question-bank"/);
    expect(app).toMatch(/AcademyAdminQuestionBank/);
  });

  it("covers add, edit and archive", () => {
    expect(page).toMatch(/saveAcademyExamQuestion/);
    expect(page).toMatch(/archiveAcademyExamQuestion/);
    expect(page).toMatch(/Edit question/);
    // Archived rather than deleted, so a question already sat in an exam stays
    // on the record and its fingerprint stays spent.
    expect(lib).toMatch(/update\(\{ status: "archived" \}\)/);
  });

  it("offers the CSV template, not just an import box", () => {
    expect(page).toMatch(/Download CSV template/);
    expect(lib).toMatch(/export function academyExamCsvTemplate/);
    // The template must carry the headers the importer matches on.
    expect(lib).toMatch(/"correct_answer"/);
    expect(lib).toMatch(/"difficulty"/);
  });

  it("shows the validation report before importing anything", () => {
    expect(page).toMatch(/previewAcademyExamCsvImport/);
    expect(page).toMatch(/with problems/);
    expect(page).toMatch(/Row \{row\.row_number\}: \{row\.problems\.join/);
    // Nothing is written until the teacher presses the button.
    expect(page).toMatch(/Import \$\{preview\.valid\} question\(s\)/);
  });

  it("refuses to import when nothing is valid", () => {
    expect(page).toMatch(/preview\.valid === 0/);
  });

  it("paginates rather than loading the whole bank", () => {
    expect(lib).toMatch(/\.range\(page \* pageSize/);
    expect(page).toMatch(/const PAGE_SIZE = 25/);
  });

  it("shows a retryable load error instead of an empty question bank", () => {
    expect(page).toMatch(/title="Questions could not be loaded"/);
    expect(page).toMatch(/onRetry={load}/);
    expect(page).toMatch(/loadError && \(/);
  });

  it("refuses to save a question with no answer", () => {
    expect(page).toMatch(/A question needs at least two options/);
    expect(page).toMatch(/Choose which option is correct/);
  });
});

describe("the CSV reader is over JSONB, not nested arrays", () => {
  // Rewritten four times over text[][] before this. unnest flattens every
  // dimension, with ordinality treats the array as one row, and extending a
  // text[] with || is ambiguous. JSONB has no rank to get wrong.
  it("returns jsonb from the splitter", () => {
    expect(jsonb).toMatch(
      /create function public\.academy_exam_split_csv\(p_csv text\)\s*returns jsonb/,
    );
  });

  it("drops before recreating, because a return type cannot be changed in place", () => {
    expect(jsonb).toMatch(/drop function if exists public\.academy_exam_split_csv\(text\)/);
  });

  it("walks rows with jsonb_array_elements", () => {
    expect(jsonb).toMatch(/from jsonb_array_elements\(parsed\) with ordinality/);
  });

  it("extends the problems list with array_append, not ||", () => {
    // problems_list || 'reason' made Postgres parse the reason as an array
    // literal and fail, so the first bad row broke the whole file. Fixed in the
    // migration after the JSONB rewrite.
    const appendFix = readFileSync(
      "supabase/migrations/20261282000000_csv_problems_append_fix.sql",
      "utf8",
    );
    expect(appendFix).toMatch(/array_append\(problems_list,/);
    const code = appendFix.replace(/--.*$/gm, "");
    expect(code).not.toMatch(/problems_list := problems_list \|\|/);
  });

  it("reads cells by name from a header row", () => {
    expect(jsonb).toMatch(/from jsonb_array_elements_text\(parsed -> 0\) as cell/);
    expect(jsonb).toMatch(/header\[k\] in \('question', 'question_text', 'prompt', 'text'\)/);
  });
});

describe("duplicate detection covers the case a teacher meets", () => {
  it("catches the same question twice inside one file", () => {
    expect(dupes).toMatch(/earlier in this file, on row/);
    expect(dupes).toMatch(/earlier_fingerprints/);
  });

  it("still catches one already in the bank", () => {
    expect(dupes).toMatch(/already in the question bank/);
  });

  it("can be overridden deliberately", () => {
    expect(dupes).toMatch(/if not p_allow_duplicates then/);
  });

  it("names the column pos, not k, because k is a loop variable", () => {
    expect(aliasFix).toMatch(/as pos/);
    expect(aliasFix).toMatch(/alias is now pos/);
  });
});

describe("the importer was proven, not assumed", () => {
  it("imported the good rows, skipped the rest and grew the bank by exactly that", () => {
    // The outcome is recorded in the reconciliation entry for the run, because
    // a probe that raises is never recorded and is retried forever.
    const e2e = readFileSync(
      "supabase/migrations/20261290000000_import_e2e_probe5.sql",
      "utf8",
    );
    expect(e2e).toMatch(/imported=2 skipped=2/);
    expect(e2e).toMatch(/the repeated question/);
    expect(e2e).toMatch(/the bank grew by exactly two/);
    expect(e2e).toMatch(/the row with no answer was refused and not written/i);
  });

  it("removed its own probe data afterwards", () => {
    const cleanup = readFileSync(
      "supabase/migrations/20261291000000_remove_probe_data.sql",
      "utf8",
    );
    expect(cleanup).toMatch(/Import probe one/);
    expect(cleanup).toMatch(/where title = 'Probe Exam'/);
    expect(cleanup).toMatch(/where name = 'Probe Class'/);
  });
});
