import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const inbox = readFileSync("src/components/academy/GradingInbox.jsx", "utf8");
const grading = readFileSync("src/lib/academyGrading.js", "utf8");
const edgeFunction = readFileSync(
  "supabase/functions/academy-ai-grade-submission/index.ts",
  "utf8",
);
const graderQueueMigration = readFileSync(
  "supabase/migrations/20261412000000_academy_grader_queue.sql",
  "utf8",
);
const supabaseConfig = readFileSync("supabase/config.toml", "utf8");

describe("staff file review and AI grade suggestions", () => {
  it("returns the uploaded file path only in the staff grading queue", () => {
    expect(graderQueueMigration).toMatch(/'file_path', s\.file_path/);
    expect(graderQueueMigration).toMatch(/if not public\.academy_can_grade\(\)/);
    expect(grading).toMatch(/createSignedUrl\(path, 60 \* 5\)/);
    expect(inbox).toMatch(/Open submitted file/);
  });

  it("restricts AI grading to the superadmin and appointed graders", () => {
    expect(edgeFunction).toMatch(/academy_can_grade/);
    expect(edgeFunction).toMatch(/if \(graderCheckError \|\| !canGrade\)/);
  });

  it("lets the function handle browser preflight before verifying the user itself", () => {
    expect(supabaseConfig).toMatch(
      /\[functions\.academy-ai-grade-submission\]\s+verify_jwt = false/,
    );
    expect(edgeFunction).toMatch(/Access-Control-Allow-Methods": "POST, OPTIONS"/);
  });

  it("validates AI marks against the assignment maximum and returns a suggestion", () => {
    expect(edgeFunction).toMatch(/score > maxScore/);
    expect(edgeFunction).toMatch(/score: Math\.round\(score \* 100\) \/ 100/);
    expect(grading).toMatch(/academy-ai-grade-submission/);
    expect(inbox).toMatch(/setScore\(String\(data\.score\)\)/);
    expect(inbox).toMatch(/Review the suggestion, then save and publish/);
  });

  it("supports common code, text, PDF and image submissions", () => {
    expect(edgeFunction).toMatch(/supportedText/);
    expect(edgeFunction).toMatch(/supportedImages/);
    expect(edgeFunction).toMatch(/type: "input_file"/);
    expect(edgeFunction).toMatch(/type: "input_image"/);
    expect(edgeFunction).toMatch(/Please review this file manually/);
  });
});
