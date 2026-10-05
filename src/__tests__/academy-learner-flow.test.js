import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATIONS = "supabase/migrations";
const allSql = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(`${MIGRATIONS}/${name}`, "utf8"))
  .join("\n");

const homeMigration = readFileSync(
  `${MIGRATIONS}/20261050000000_academy_student_home_and_notifications.sql`,
  "utf8",
);

function latestDefinition(name) {
  const matches = [
    ...allSql.matchAll(
      new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`, "g"),
    ),
  ];
  expect(matches.length, `${name} should exist`).toBeGreaterThan(0);
  return matches.at(-1)[0];
}

const home = latestDefinition("academy_student_home");

describe("academy_student_home", () => {
  it("is a single round trip the dashboard can rely on", () => {
    expect(home).toMatch(/returns jsonb/);
    expect(home).toMatch(/security definer/i);
    expect(home).toMatch(/set search_path = public/i);
  });

  it("reads the student from the token, never from an argument", () => {
    // If it took a student id, a caller could read someone else's state.
    expect(home).toMatch(/current_student uuid := auth\.uid\(\)/);
    expect(home).not.toMatch(/p_student/);
  });

  it("returns real state for a student, and only the empty payload for staff", () => {
    // The check must be positive. Inverted, every student received the blank
    // object because a student is not a teacher.
    expect(home).toMatch(/if public\.academy_is_teacher\(\) then/);
    expect(home).not.toMatch(/if not public\.academy_is_teacher\(\) then/);
  });

  it("requires a signed in user", () => {
    expect(home).toMatch(/Authentication required/);
  });

  it("only offers content the student is allowed to reach", () => {
    expect(home).toMatch(
      /l\.status = 'published'\s+and \(l\.release_at is null or l\.release_at <= now\(\)\)/,
    );
    expect(home).toMatch(/academy_lesson_is_unlocked_for_student/);
    expect(home).toMatch(/e\.status = 'active'/);
  });

  it("prefers a started topic over the next one", () => {
    const continueIndex = home.indexOf("continue_lesson");
    const nextIndex = home.indexOf("next_lesson");
    expect(continueIndex).toBeGreaterThan(-1);
    expect(nextIndex).toBeGreaterThan(-1);
    expect(home).toMatch(/if continue_lesson is null then/);
  });

  it("excludes assignments the student has already handed in", () => {
    expect(home).toMatch(
      /not exists \(\s*select 1 from public\.academy_submissions s\s*where s\.assignment_id = a\.id\s*and s\.student_id = current_student/,
    );
  });

  it("counts attempts so the dashboard can show them", () => {
    expect(home).toMatch(/'attempts_used'/);
  });

  it("is revoked from anon and granted to a signed in user", () => {
    expect(homeMigration).toMatch(
      /revoke execute on function public\.academy_student_home\(\) from public, anon/,
    );
    expect(homeMigration).toMatch(
      /grant execute on function public\.academy_student_home\(\) to authenticated/,
    );
  });
});

describe("notifying students when a topic goes live", () => {
  const notifier = latestDefinition("academy_notify_topic_published");

  it("fires on the transition to published, not on every write", () => {
    expect(homeMigration).toMatch(
      /create trigger academy_notify_topic_published\s+after update on public\.academy_lessons/,
    );
    expect(notifier).toMatch(/if new\.status is distinct from 'published' then/);
    expect(notifier).toMatch(
      /if coalesce\(old\.status, ''\) = 'published' then/,
    );
  });

  it("tells enrolled students only, in the right course", () => {
    expect(notifier).toMatch(/academy_enrollments e/);
    expect(notifier).toMatch(/e\.status = 'active'/);
    expect(notifier).toMatch(/e\.course_id = week_course/);
  });

  it("keeps the message short enough for the notifications list", () => {
    expect(notifier).toMatch(/left\(/);
    expect(notifier).toMatch(/240/);
  });
});

describe("the learner pages use the server answer", () => {
  const dashboard = readFileSync("src/pages/AcademyDashboard.jsx", "utf8");
  const lesson = readFileSync("src/pages/AcademyLesson.jsx", "utf8");
  const academy = readFileSync("src/lib/academy.js", "utf8");

  it("stops guessing the next topic in the browser", () => {
    expect(dashboard).toContain("getAcademyStudentHome");
    expect(dashboard).toContain("resumeLesson");
    expect(dashboard).not.toMatch(
      /lessons\.find\(\(lesson\) => !lesson\.progress\?\.completed_at\)/,
    );
  });

  it("shows a direct quest action, due soon tasks and the next topic", () => {
    expect(dashboard).toMatch(/Continue your quest/);
    expect(dashboard).toMatch(/resumeLesson\.lesson_id/);
    expect(dashboard).toMatch(/Due soon/);
    expect(dashboard).toMatch(/home\?\.nextLesson/);
    expect(dashboard).not.toMatch(/All topics/);
    expect(dashboard).not.toMatch(/Open lesson/);
  });

  it("uses existing progress and earned badges for the student journey UI", () => {
    expect(dashboard).toMatch(/Your learning journey/);
    expect(dashboard).toMatch(/overview\?\.badges\?\.length/);
    expect(dashboard).toMatch(/getAcademyProgress/);
    expect(dashboard).not.toMatch(/getAcademyLessons/);
  });

  it("uses the home query's own offline snapshot rather than wrapping it in another cache", () => {
    expect(dashboard).toMatch(/getAcademyStudentHome\(user\.id\)/);
    expect(dashboard).toMatch(/setHomeOffline\(Boolean\(result\.offline\)\)/);
    expect(dashboard).not.toMatch(/loadSection\("home"/);
  });

  it("surfaces the task step with its submission state", () => {
    expect(lesson).toMatch(/topic-step-task/);
    expect(lesson).toMatch(/task\.submission/);
    expect(lesson).toMatch(/View or resubmit/);
  });

  it("loads the task step from the activities table", () => {
    expect(academy).toMatch(/academy_lesson_activities/);
    expect(academy).toMatch(/academy_assignments!inner/);
  });

  it("keeps the three step flow in order", () => {
    const stepper = readFileSync(
      "src/components/academy/TopicStepper.jsx",
      "utf8",
    );
    expect(stepper).toMatch(/learn/);
    expect(stepper).toMatch(/practice/);
    expect(stepper).toMatch(/task/);
    expect(stepper.indexOf('"learn"')).toBeLessThan(stepper.indexOf('"practice"'));
    expect(stepper.indexOf('"practice"')).toBeLessThan(stepper.indexOf('"task"'));
  });

  it("hides a step the topic has no content for", () => {
    const stepper = readFileSync(
      "src/components/academy/TopicStepper.jsx",
      "utf8",
    );
    expect(stepper).toMatch(/if \(step\.id === "practice"\) return practiceCount > 0/);
    expect(stepper).toMatch(/if \(step\.id === "task"\) return taskCount > 0/);
  });

  it("never shows a hidden test to a student", () => {
    // tests, solution_code and correct_answer must never appear in a select a
    // browser can run.
    const selects = [
      ...academy.matchAll(/from\("academy_exercises"\)[\s\S]{0,80}?select\(([\s\S]*?)\)/g),
    ];
    expect(selects.length).toBeGreaterThan(0);
    selects.forEach((match) => {
      expect(match[1]).not.toMatch(/\btests\b/);
      expect(match[1]).not.toMatch(/solution_code/);
      expect(match[1]).not.toMatch(/correct_answer/);
    });
  });
});

describe("the learner home survives a bad connection", () => {
  const academy = readFileSync("src/lib/academy.js", "utf8");
  const home = academy.slice(
    academy.indexOf("export async function getAcademyStudentHome"),
    academy.indexOf("export async function getAcademyStudentOverview"),
  );

  it("is cached to IndexedDB, not only to memory", () => {
    // A student on a phone is regularly offline. If this is only in the memory
    // cache a reload with no connection shows an empty home screen.
    expect(home).toMatch(/fetchWithOfflineFallback/);
    expect(home).toMatch(/OFFLINE_STORES\.metadata/);
  });

  it("is keyed per student so one student never sees another's snapshot", () => {
    expect(home).toMatch(/userId,/);
  });
});
