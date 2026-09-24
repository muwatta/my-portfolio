-- Phase 6: Real verified leaderboard.
-- Replaces the no-op academy_award_verified_activity placeholder (20260928000000)
-- with a real writer into academy_leaderboard_points (20261008000000), and adds a
-- security-definer standings RPC so students can view the full leaderboard without
-- their per-row RLS hiding other students' points.
--
-- Property 1: points are only ever written by database triggers from recorded
-- activity (lesson completion / practice pass). No client can insert points directly
-- (academy_leaderboard_points_manage is teacher/admin only).
-- Property 2: the same source activity cannot be double-counted (partial unique
-- index on (student_id, period_id, source_type, source_id)).
-- Property 3: badge awards are derived from the same real activity (lesson /
-- practice), never from arbitrary client calls.

-- 1. Ensure an active period exists for the current ISO week. Idempotent and
--    self-healing: closes expired active periods and (re)opens the current week.
create or replace function public.academy_ensure_active_week_period()
returns public.academy_leaderboard_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.academy_leaderboard_periods;
  v_start timestamptz;
  v_end timestamptz;
  v_code text;
begin
  v_start := date_trunc('week', now());
  v_end := v_start + interval '7 days';
  v_code := to_char(v_start, 'IYYY-IW');

  update public.academy_leaderboard_periods
  set status = 'closed'
  where status = 'active' and ends_at <= now();

  insert into public.academy_leaderboard_periods (period_code, starts_at, ends_at, status)
  values (v_code, v_start, v_end, 'active')
  on conflict (period_code) do update
    set starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        status = 'active'
  returning * into v_period;

  return v_period;
end;
$$;

revoke execute on function public.academy_ensure_active_week_period() from public, anon;

-- 2. Real verified-activity award. Called by the lesson/practice triggers.
create or replace function public.academy_award_verified_activity(
  target_student_id uuid,
  target_source_type text,
  target_source_id uuid,
  target_points integer,
  target_badge_slug text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.academy_leaderboard_periods;
  v_badge_id uuid;
begin
  if target_student_id is null or target_points is null or target_points <= 0 then
    return;
  end if;

  v_period := public.academy_ensure_active_week_period();

  insert into public.academy_leaderboard_points
    (student_id, period_id, source_type, source_id, source_label, points, verification_status)
  values
    (target_student_id, v_period.id, target_source_type, target_source_id, '', target_points, 'verified')
  on conflict (student_id, period_id, source_type, source_id)
  do update set
    points = excluded.points,
    verification_status = 'verified';

  if target_badge_slug is not null then
    select id into v_badge_id
    from public.academy_badges
    where slug = target_badge_slug and active;

    if v_badge_id is not null then
      insert into public.academy_student_badges (student_id, badge_id)
      values (target_student_id, v_badge_id)
      on conflict (student_id, badge_id) do nothing;
    end if;
  end if;
end;
$$;

revoke execute
on function public.academy_award_verified_activity(uuid, text, uuid, integer, text)
from public, anon;
grant execute
on function public.academy_award_verified_activity(uuid, text, uuid, integer, text)
to authenticated;

-- 3. Non-no-op compatibility leaderboard (the old academy_leaderboard() stub).
create or replace function public.academy_leaderboard()
returns table (
  student_id uuid,
  display_name text,
  level_name text,
  points bigint,
  rank bigint
)
language sql
security definer
set search_path = public
as $$
  with standings as (
    select
      points.student_id,
      profiles.display_name,
      sum(points.points) as points
    from public.academy_leaderboard_points points
    join public.academy_profiles profiles on profiles.id = points.student_id
    where points.verification_status = 'verified'
      and points.period_id = (select id from public.academy_leaderboard_periods where status = 'active' order by starts_at desc limit 1)
      and profiles.role = 'student'
    group by points.student_id, profiles.display_name
  )
  select
    standings.student_id,
    standings.display_name,
    null::text as level_name,
    standings.points::bigint,
    row_number() over (order by standings.points desc, standings.student_id)::bigint as rank
  from standings
  order by standings.points desc, standings.student_id;
$$;

revoke execute on function public.academy_leaderboard() from public, anon;
grant execute on function public.academy_leaderboard() to authenticated;

-- 4. Standings RPC for the student-facing leaderboard. Security definer so every
--    authenticated student can see aggregated verified points without RLS hiding
--    other students' rows. Returns rank within the current (or given) period.
create or replace function public.academy_weekly_leaderboard(p_period_id uuid default null)
returns table (
  student_id uuid,
  display_name text,
  points bigint,
  rank bigint
)
language sql
security definer
set search_path = public
as $$
  with standings as (
    select
      points.student_id,
      profiles.display_name,
      sum(points.points) as points
    from public.academy_leaderboard_points points
    join public.academy_profiles profiles on profiles.id = points.student_id
    where points.verification_status = 'verified'
      and points.period_id = coalesce(
        p_period_id,
        (select id from public.academy_leaderboard_periods where status = 'active' order by starts_at desc limit 1)
      )
      and profiles.role = 'student'
    group by points.student_id, profiles.display_name
  )
  select
    standings.student_id,
    standings.display_name,
    standings.points::bigint,
    row_number() over (order by standings.points desc, standings.student_id)::bigint as rank
  from standings
  order by standings.points desc, standings.student_id;
$$;

revoke execute on function public.academy_weekly_leaderboard(uuid) from public, anon;
grant execute on function public.academy_weekly_leaderboard(uuid) to authenticated;

-- 5. Seed the badge catalog referenced by the verified-activity triggers so real
--    activity produces real badges. Idempotent upserts.
insert into public.academy_badges (slug, name, description, icon, active)
values
  ('first-lesson', 'First Steps', 'Completed your first lesson.', 'star', true),
  ('first-practice', 'Early Practice', 'Passed your first practice exercise.', 'check', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  active = excluded.active;

-- 6. Seed/repair the current active period and ensure points table is readable.
select public.academy_ensure_active_week_period();

do $$
begin
  begin alter publication supabase_realtime add table public.academy_leaderboard_points; exception when duplicate_object then null; end;
end;
$$;