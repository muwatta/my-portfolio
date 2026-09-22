-- Phase 7: admin activity feed for real-time dashboard data

create table if not exists public.academy_activity_feed (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  activity_type text not null check (activity_type in ('student_login', 'lesson_started', 'lesson_completed', 'assignment_submitted', 'assignment_graded', 'leaderboard_updated', 'session_heartbeat', 'admin_view')),
  entity_type text,
  entity_id uuid,
  entity_label text,
  course_id uuid references public.academy_courses(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists academy_activity_feed_recent_idx
  on public.academy_activity_feed (created_at desc, activity_type);

drop policy if exists academy_activity_feed_read on public.academy_activity_feed;
create policy academy_activity_feed_read
on public.academy_activity_feed
for select to authenticated
using (
  public.academy_is_teacher()
  or public.academy_is_admin()
  or actor_id = auth.uid()
);

drop policy if exists academy_activity_feed_write on public.academy_activity_feed;
create policy academy_activity_feed_write
on public.academy_activity_feed
for insert to authenticated
with check (
  public.academy_is_teacher() or public.academy_is_admin() or actor_id = auth.uid()
);

-- Realtime subscriptions should target these tables: academy_activity_feed,
-- academy_submissions, academy_submission_results, academy_learning_sessions,
-- academy_leaderboard_points.
