import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261408000000_cpp_week_one_lesson_specific_practice.sql",
  "utf8",
);
const questionJson = migration.match(/\$questions\$([\s\S]*?)\$questions\$/)?.[1];
const questions = JSON.parse(questionJson);

describe("C++ Week 1 lesson-specific practice", () => {
  it("seeds separate question sets for each of the five lessons", () => {
    for (const lessonNumber of [1, 2, 3, 4, 5]) {
      const lessonQuestions = questions.filter(
        (question) => question.lesson_number === lessonNumber,
      );
      expect(lessonQuestions).toHaveLength(3);
      expect(lessonQuestions.map((question) => question.question_number)).toEqual([
        1, 2, 3,
      ]);
      expect(new Set(lessonQuestions.map((question) => question.title)).size).toBe(3);
    }
    expect(new Set(questions.map((question) => question.instructions)).size).toBe(15);
    expect(migration).toContain("course.slug = 'cpp-embedded-robotics'");
    expect(migration).toContain("weeks.week_number = 1");
  });

  it("archives the copied week-wide bank but preserves per-session history", () => {
    expect(migration).toContain("set published = false");
    expect(migration).toContain("set status = 'archived'");
    expect(migration).toContain("exercise.practice_session_id is null");
    expect(migration).toContain("saved_question.practice_question_number = question.question_number");
    expect(migration).toContain("and attempt.student_id = practice_session.student_id");
    expect(migration).toContain("saved_question.practice_question_number > 3");
    expect(migration).toContain("practice_session.completed_at is null");
  });

  it("keeps new lesson questions attached as required scored activities", () => {
    expect(migration).toContain("'practice'");
    expect(migration).toContain("required_for_completion");
    expect(migration).toContain("on conflict (lesson_id, kind, ref_id)");
  });
});
