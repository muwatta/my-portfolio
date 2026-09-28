-- Phase 5: let the activity feed record an announcement.
--
-- The feed was created with a fixed list of eight activity types and nothing
-- ever wrote to it, so the dashboard's recent activity list was permanently
-- empty. Announcing a lesson is a real event and belongs in the same trail.
--
-- Widening a check constraint is safe here: it only adds a permitted value, it
-- does not change or delete any existing row. The constraint is recreated by
-- name so this is the only definition of it.

alter table public.academy_activity_feed
  drop constraint if exists academy_activity_feed_activity_type_check;

alter table public.academy_activity_feed
  add constraint academy_activity_feed_activity_type_check
  check (activity_type in (
    'student_login',
    'lesson_started',
    'lesson_completed',
    'assignment_submitted',
    'assignment_graded',
    'leaderboard_updated',
    'session_heartbeat',
    'admin_view',
    'announcement'
  ));
