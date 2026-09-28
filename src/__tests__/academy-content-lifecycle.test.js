import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATIONS = "supabase/migrations";

function migration(name) {
  return readFileSync(`${MIGRATIONS}/${name}`, "utf8");
}

const CONTENT_LIFECYCLE = migration(
  "20261041000000_academy_content_lifecycle.sql",
);
const AUTHORISATION = migration(
  "20261039000000_academy_authorisation_hardening.sql",
);
const PROFILE_CLEANUP = migration(
  "20261040000000_academy_profile_policy_cleanup.sql",
);
const HOUSEKEEPING = migration(
  "20261037000000_academy_housekeeping_retention.sql",
);

const allMigrations = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => migration(name));

const academy = readFileSync("src/lib/academy.js", "utf8");
const lessonPage = readFileSync("src/pages/AcademyLesson.jsx", "utf8");

describe("course language, so a third course needs no code change", () => {
  it("adds a language column and backfills it from the existing courses", () => {
    expect(CONTENT_LIFECYCLE).toMatch(
      /alter table public\.academy_courses\s+add column if not exists language text/,
    );
    expect(CONTENT_LIFECYCLE).toMatch(/update public\.academy_courses/);
    expect(CONTENT_LIFECYCLE).toMatch(/'cpp'/);
  });

  it("stops the client choosing a runtime from a course slug", () => {
    expect(academy).not.toContain("cpp-embedded-robotics");
    expect(lessonPage).not.toContain("cpp-embedded-robotics");
  });

  it("reads the runtime from the course row instead", () => {
    expect(academy).toMatch(/academy_courses!inner\([^)]*language/);
    expect(academy).toMatch(/academy_courses\?\.language/);
    expect(lessonPage).toMatch(/academy_courses\?\.language/);
  });
});

describe("scheduled publishing", () => {
  it("gives lessons a full lifecycle", () => {
    for (const column of [
      "status",
      "release_at",
      "due_at",
      "points",
      "late_policy",
      "unlock_after_id",
    ]) {
      expect(CONTENT_LIFECYCLE).toContain(column);
    }
    expect(CONTENT_LIFECYCLE).toMatch(
      /status in \('draft', 'scheduled', 'published', 'archived'\)/,
    );
    expect(CONTENT_LIFECYCLE).toMatch(
      /late_policy in \('accept_penalty', 'closed'\)/,
    );
  });

  it("gives practice questions and assignments the same lifecycle", () => {
    expect(CONTENT_LIFECYCLE).toMatch(
      /alter table public\.academy_exercises\s+add column if not exists status/,
    );
    expect(CONTENT_LIFECYCLE).toMatch(
      /alter table public\.academy_assignments\s+add column if not exists status/,
    );
  });

  it("hides a scheduled lesson from students without relying on cron", () => {
    expect(CONTENT_LIFECYCLE).toMatch(
      /create policy academy_lessons_read[\s\S]*release_at is null or release_at <= now\(\)/,
    );
    expect(CONTENT_LIFECYCLE).toMatch(
      /create policy academy_exercises_read[\s\S]*release_at is null or release_at <= now\(\)/,
    );
  });

  it("keeps the legacy published flag in step so old queries still agree", () => {
    expect(CONTENT_LIFECYCLE).toMatch(
      /academy_sync_lesson_publish_flags/,
    );
    expect(CONTENT_LIFECYCLE).toMatch(
      /new\.published := \(new\.status = 'published'\)/,
    );
    expect(CONTENT_LIFECYCLE).toMatch(/academy_sync_assignment_publish_flags/);
  });
});

describe("activities attached to a lesson", () => {
  it("creates the table with row level security", () => {
    expect(CONTENT_LIFECYCLE).toMatch(
      /create table if not exists public\.academy_lesson_activities/,
    );
    expect(CONTENT_LIFECYCLE).toMatch(
      /alter table public\.academy_lesson_activities enable row level security/,
    );
    expect(CONTENT_LIFECYCLE).toMatch(
      /kind in \('practice', 'assignment', 'project'\)/,
    );
  });

  it("refuses duplicate activities for the same lesson and reference", () => {
    expect(CONTENT_LIFECYCLE).toMatch(
      /unique \(lesson_id, kind, ref_id\)/,
    );
  });

  it("backfills practice and assignments from existing content", () => {
    expect(CONTENT_LIFECYCLE).toMatch(/from public\.academy_exercises e/);
    expect(CONTENT_LIFECYCLE).toMatch(/from public\.academy_assignments a/);
  });

  it("only shows a student activities on a lesson they can reach", () => {
    expect(CONTENT_LIFECYCLE).toMatch(
      /create policy academy_lesson_activities_read[\s\S]*academy_lesson_is_unlocked_for_student/,
    );
  });
});

describe("authorisation gaps closed in phase one", () => {
  it("turns on row level security for the five unprotected tables", () => {
    for (const table of [
      "academy_lesson_subtopics",
      "academy_assignment_visibility",
      "academy_leaderboard_periods",
      "academy_learning_session_events",
      "academy_activity_feed",
    ]) {
      expect(AUTHORISATION).toMatch(
        new RegExp(
          `alter table public\\.${table} enable row level security`,
        ),
      );
    }
  });

  it("removes the write grant that let any student edit blog posts", () => {
    expect(AUTHORISATION).toMatch(
      /revoke insert, update, delete on public\.blog_posts from anon, authenticated/,
    );
  });

  it("scopes projects and milestones to enrolled students", () => {
    expect(AUTHORISATION).toMatch(
      /create policy academy_projects_read[\s\S]*academy_enrollments/,
    );
    expect(AUTHORISATION).toMatch(
      /create policy academy_milestones_read[\s\S]*academy_enrollments/,
    );
  });

  it("stops a teacher renaming a student", () => {
    expect(PROFILE_CLEANUP).toMatch(
      /drop policy if exists academy_profiles_teacher_update/,
    );
    expect(AUTHORISATION).toMatch(
      /revoke update \(level_id\) on public\.academy_profiles from authenticated/,
    );
  });

  it("keeps the student self service profile update working", () => {
    expect(AUTHORISATION).not.toMatch(
      /drop policy if exists academy_profiles_student_update/,
    );
    expect(PROFILE_CLEANUP).not.toMatch(
      /drop policy if exists academy_profiles_student_update/,
    );
  });

  it("lets the offline queue retry an upload that already exists", () => {
    expect(AUTHORISATION).toMatch(
      /create policy academy_submission_files_self_update on storage\.objects/,
    );
    expect(AUTHORISATION).toMatch(/for update to authenticated/);
  });

  it("gates exercises behind the lesson unlock chain", () => {
    expect(CONTENT_LIFECYCLE).toMatch(
      /create policy academy_exercises_read[\s\S]*academy_lesson_is_unlocked_for_student/,
    );
  });
});

describe("housekeeping", () => {
  it("installs pg_cron instead of silently skipping the schedule", () => {
    expect(HOUSEKEEPING).toMatch(
      /create extension if not exists pg_cron/,
    );
    expect(HOUSEKEEPING).toMatch(/cron\.schedule\(/);
  });

  it("replaces the job rather than stacking duplicates", () => {
    expect(HOUSEKEEPING).toMatch(/cron\.unschedule\('academy-live-retention'\)/);
  });

  it("keeps fourteen days of chat and heartbeat history", () => {
    expect(HOUSEKEEPING).toMatch(/academy_live_messages[\s\S]*'14 days'/);
    expect(HOUSEKEEPING).toMatch(
      /academy_learning_session_events[\s\S]*'14 days'/,
    );
  });

  it("never touches an active learning session", () => {
    expect(HOUSEKEEPING).toMatch(/where is_active is false/);
  });
});

describe("seed scaffolding", () => {
  const seed = migration("20261043000000_academy_seed_assignments.sql");

  it("creates the example assignments as drafts so students cannot see them", () => {
    expect(seed).toMatch(/'draft'/);
    expect(seed).toMatch(/false,\s*\n\s*true,\s*\n\s*'draft'/);
  });

  it("covers both an auto-graded task and a hardware evidence task", () => {
    expect(seed).toMatch(/auto-graded Python function task/);
    expect(seed).toMatch(/C\+\+ hardware evidence task/);
    expect(seed).toMatch(/allowed_file_types/);
  });

  it("resolves an author from the admin allow list, not a hard coded email", () => {
    expect(seed).toMatch(/academy_seed_author/);
    // Compare against executable SQL only. The file explains in a comment why
    // the hard coded address is unusable, and that must not fail the check.
    const sqlOnly = seed
      .replace(/--[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(sqlOnly).not.toMatch(
      /abdullahimusliudeen@gmail\.com/,
    );
    expect(sqlOnly).toMatch(/from public\.academy_admins/);
  });

  it("exposes a grading health check for the admin dashboard", () => {
    const health = migration("20261042000000_academy_seed_and_health.sql");
    expect(health).toMatch(/create or replace function public\.academy_grading_health/);
    expect(health).toMatch(/'grading_unavailable'/);
    expect(health).toMatch(/'results_awaiting_review'/);
  });
});

describe("migrations are additive and safe to re-run", () => {
  it("never drops a table that holds student content", () => {
    const destructive = allMigrations.filter((sql) =>
      /drop\s+table/i.test(sql),
    );
    expect(destructive).toEqual([]);
  });

  it("uses if not exists or drop policy if exists for the objects it adds", () => {
    expect(CONTENT_LIFECYCLE).toMatch(
      /add column if not exists status text/,
    );
    expect(CONTENT_LIFECYCLE).toMatch(
      /create table if not exists public\.academy_lesson_activities/,
    );
    expect(CONTENT_LIFECYCLE).toMatch(/drop policy if exists academy_lessons_read/);
  });
});
