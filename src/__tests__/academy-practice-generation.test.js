import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const generator = readFileSync(
  "supabase/functions/academy-generate-practice/index.ts",
  "utf8",
);
const practiceMigration = readFileSync(
  "supabase/migrations/20261406000000_academy_practice_bank_session_completion.sql",
  "utf8",
);
const terminalPracticeMigration = readFileSync(
  "supabase/migrations/20261407000000_terminal_lesson_practice_bank.sql",
  "utf8",
);
const supabaseConfig = readFileSync("supabase/config.toml", "utf8");

describe("prepared practice session generation", () => {
  it("uses prepared questions first and grounds generated practice in the selected lesson", () => {
    expect(generator).toContain('.eq("published", true)');
    expect(generator).toContain('.eq("status", "published")');
    expect(generator).toContain(".is(\"practice_session_id\", null)");
    expect(generator).toContain(
      '["multiple_choice", "true_false", "short_answer"]',
    );
    expect(generator).toContain("if (selectedQuestions.length)");
    expect(generator).toContain("if (!providerKey)");
    expect(generator).toContain("if (objectives.length === 0 && !hasLessonContent)");
    expect(generator).toContain("learn_content: lessonContent");
    expect(generator).toContain(
      "Every question and its correct answer must be directly supported by the selected lesson's objectives or Learn content.",
    );
    expect(generator).toContain("Use no other source.");
    expect(generator).not.toContain("academy_materials");
    expect(generator).not.toContain("input_file");
  });

  it("creates sessions with the function's own authenticated user check", () => {
    expect(supabaseConfig).toMatch(
      /\[functions\.academy-generate-practice\]\s+verify_jwt = false/,
    );
    expect(generator).toContain('request.method === "OPTIONS"');
    expect(generator).toContain('"Access-Control-Allow-Methods": "POST, OPTIONS"');
    expect(generator).toContain("userClient.auth.getUser()");
  });

  it("completes sessions based on their actual question count, not a fixed five", () => {
    expect(practiceMigration).toContain("if question_count = 0 then");
    expect(practiceMigration).not.toContain("question_count <> 5");
    expect(practiceMigration).toContain("and not exists (");
    expect(practiceMigration).toContain("attempt.passed > 0");
  });

  it("provides scored practice for every published Terminal lesson", () => {
    expect(terminalPracticeMigration).toContain(
      "course.slug = 'terminal-and-command-line'",
    );
    expect(terminalPracticeMigration).toContain("join question_bank question");
    expect(terminalPracticeMigration).toContain(
      "question.week_number = lesson.week_number",
    );
    expect(terminalPracticeMigration).toContain(
      "required_for_completion",
    );
    expect(terminalPracticeMigration).toContain(
      "fewer than three scored questions",
    );
    expect(terminalPracticeMigration).toContain("'grep error notes.txt'");
    expect(terminalPracticeMigration).toContain("'history'");
  });
});
