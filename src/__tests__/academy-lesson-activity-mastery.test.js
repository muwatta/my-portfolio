import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261342000000_academy_lesson_activity_mastery.sql",
  "utf8",
);
const lessonPage = readFileSync("src/pages/AcademyLesson.jsx", "utf8");
const practicePage = readFileSync("src/pages/AcademyPractice.jsx", "utf8");
const cppPracticeGuard = readFileSync(
  "supabase/migrations/20261420000000_cpp_generated_practice_completion_guard.sql",
  "utf8",
);

describe("lesson activity provisioning", () => {
  it("fills published Python and Embedded lessons to three scored questions", () => {
    expect(migration).toContain("'python-for-ai-machine-learning'");
    expect(migration).toContain("'cpp-embedded-robotics'");
    expect(migration).toMatch(/3 - count\(exercise\.id\)/);
    expect(migration).toMatch(/exercise\.question_type in \('multiple_choice', 'true_false', 'short_answer'\)/);
    expect(migration).toMatch(/missing\.instructions/);
    expect(migration).toMatch(/missing\.correct_answer/);
    expect(migration).toMatch(/99,\s+true,\s+'published'/);
    expect(migration).toMatch(/lessons_below_activity_target > 0/);
    expect(migration).toMatch(/raise warning[\s\S]*fewer than three scored practice questions/);
  });

  it("makes scored practice and published assignment submission prerequisites", () => {
    expect(migration).toMatch(/required_for_completion boolean not null default false/);
    expect(migration).toMatch(/attempt\.passed > 0/);
    expect(migration).toMatch(/submission\.assignment_id = activity\.ref_id/);
    expect(migration).toMatch(/submission\.student_id = target_student_id/);
    expect(migration).toMatch(/return v_prerequisite_completed\s+and public\.academy_lesson_required_activities_complete/);
    expect(migration).toMatch(/create trigger academy_require_lesson_activities/);
  });

  it("awards points for passing practice, published grades, and project milestones", () => {
    expect(migration).toMatch(/'practice',\s+new\.exercise_id,\s+5/);
    expect(migration).toMatch(/new\.review_state <> 'published'/);
    expect(migration).toMatch(/'assignment',\s+new\.assignment_id,\s+points_to_award/);
    expect(migration).toMatch(/'project',\s+new\.milestone_id,\s+10/);
  });

  it("shows practice completion and links students to the current lesson's questions", () => {
    expect(lessonPage).toMatch(/practiceDone=\{practiceDone\}/);
    expect(lessonPage).toMatch(/exercise\.completed/);
    expect(lessonPage).toMatch(/practiceSessionCompleted/);
    expect(lessonPage).toMatch(/practice\?lesson=\$\{encodeURIComponent\(id\)\}/);
    expect(practicePage).toMatch(/exercise\.lesson_id === selectedLessonId/);
    expect(practicePage).toMatch(/prepared question set/i);
    expect(practicePage).toMatch(/step=task/);
  });

  it("keeps C++ lesson practice available after repeated weekly bank copies are archived", () => {
    expect(lessonPage).toMatch(/data\?\.academy_weeks\?\.academy_courses\?\.language === "cpp"/);
    expect(lessonPage).toMatch(/\(practice\.length > 0 \|\| isCppCourse\)/);
    expect(lessonPage).toMatch(/practiceCount=\{[\s\S]*?Math\.max\(scoredPractice\.length, 1\)/);
    expect(lessonPage).toMatch(
      /scoredPractice\.length === 0 \|\|\s*scoredPractice\.every\(\(exercise\) => exercise\.completed\)/,
    );
    expect(lessonPage).toMatch(/!isCppLesson &&/);
    expect(lessonPage).toMatch(/lessonScoredExercises\.every\(\(exercise\) => exercise\.completed\)/);
    expect(lessonPage).toMatch(/Start lesson practice/);
    expect(lessonPage).toMatch(/!isCppCourse &&/);
    expect(lessonPage).toMatch(/Pass the five-question practice set generated from this lesson/);
  });

  it("requires generated C++ practice server-side without retroactively blocking completed lessons", () => {
    expect(cppPracticeGuard).toContain(
      "course.slug = 'cpp-embedded-robotics'",
    );
    expect(cppPracticeGuard).toContain(
      "practice_session.completed_at is not null",
    );
    expect(cppPracticeGuard).toMatch(
      /progress\.completion_status = 'completed'[\s\S]*?progress\.completed_at is not null/,
    );
    expect(cppPracticeGuard).toContain(
      "academy_lesson_required_activities_complete(uuid, uuid)",
    );
  });

  it("restores the student's last lesson step after reopening the lesson", () => {
    expect(lessonPage).toMatch(/lesson:\$\{id\}:step/);
    expect(lessonPage).toMatch(/availableSteps\.includes\(savedStep\?\.step\)/);
    expect(lessonPage).toMatch(/setStep\(target\)/);
  });
});
