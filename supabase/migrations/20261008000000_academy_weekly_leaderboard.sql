-- Phase 5: weekly leaderboard periods and verified points derived from saved results
create table if not exists public.academy_leaderboard_periods (
  id uuid primary key default gen_random_uuid(),
  period_code text not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.academy_leaderboard_points (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  period_id uuid not null references public.academy_leaderboard_periods(id) on delete cascade,
  source_type text not null check (source_type in ('assignment', 'quiz', 'practice', 'project', 'lesson')),
  source_id uuid,
  source_label text not null default '',
  points integer not null default 0 check (points >= 0),
  earned_at timestamptz not null default now(),
  verification_status text not null default 'verified' check (verification_status in ('verified', 'pending', 'rejected')),
  unique (student_id, period_id, source_type, source_id)
);

create index if not exists academy_leaderboard_points_period_student_idx on public.academy_leaderboard_points (period_id, student_id, points desc);
create index if not exists academy_leaderboard_periods_active_idx on public.academy_leaderboard_periods (status, starts_at desc);

create or replace function public.academy_current_week_period()
returns uuid
language sql
stable
as $$
  select id
  from public.academy_leaderboard_periods
  where status = 'active'
  order by starts_at desc
  limit 1;
$$;

create or replace function public.academy_aggregate_weekly_points(p_student_id uuid, p_period_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(sum(points), 0)::integer
  from public.academy_leaderboard_points
  where student_id = p_student_id
    and period_id = p_period_id
    and verification_status = 'verified';
$$;

drop policy if exists academy_leaderboard_periods_read on public.academy_leaderboard_periods;
create policy academy_leaderboard_periods_read
on public.academy_leaderboard_periods
for select to authenticated
using (true);

drop policy if exists academy_leaderboard_points_read on public.academy_leaderboard_points;
create policy academy_leaderboard_points_read
on public.academy_leaderboard_points
for select to authenticated
using (
  student_id = auth.uid() or public.academy_is_teacher() or public.academy_is_admin()
);

drop policy if exists academy_leaderboard_points_manage on public.academy_leaderboard_points;
create policy academy_leaderboard_points_manage
on public.academy_leaderboard_points
for all to authenticated
using (public.academy_is_teacher() or public.academy_is_admin())
with check (public.academy_is_teacher() or public.academy_is_admin());
