-- Real-time leaderboard standings.
--
-- Realtime postgres_changes only delivers rows a subscriber can SELECT (RLS).
-- academy_leaderboard_points keeps strict per-row policy (student own /
-- teacher / admin) so a student would never receive other students' point
-- changes. This migration adds a public aggregate snapshot that the award
-- trigger refreshes, giving every authenticated student a live leaderboard
-- signal. It carries only leaderboard-facing data (name, points, rank), never
-- the per-source provenance.

create table if not exists public.academy_leaderboard_standings (
  period_id uuid not null references public.academy_leaderboard_periods(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  points bigint not null default 0,
  rank integer not null,
  primary key (period_id, student_id),
  unique (period_id, rank),
  check (rank >= 1)
);

create or replace function public.academy_refresh_leaderboard_standings(p_period_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.academy_leaderboard_standings where period_id = p_period_id;

  insert into public.academy_leaderboard_standings (period_id, student_id, display_name, points, rank)
  select
    points.period_id,
    points.student_id,
    profiles.display_name,
    sum(points.points)::bigint as points,
    row_number() over (
      order by sum(points.points) desc, points.student_id
    )::integer as rank
  from public.academy_leaderboard_points points
  join public.academy_profiles profiles on profiles.id = points.student_id
  where points.verification_status = 'verified'
    and points.period_id = p_period_id
    and profiles.role = 'student'
  group by points.period_id, points.student_id, profiles.display_name
  order by points desc, points.student_id;
end;
$$;

-- Keep standings in lockstep with any verified-point change, so realtime events
-- always follow the points the leaderboard actually shows.
create or replace function public.academy_leaderboard_standings_refresh_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.verification_status = 'verified' then
      perform public.academy_refresh_leaderboard_standings(old.period_id);
    end if;
    return old;
  end if;
  if new.verification_status = 'verified' then
    perform public.academy_refresh_leaderboard_standings(new.period_id);
  end if;
  return new;
end;
$$;

drop trigger if exists academy_leaderboard_standings_refresh on public.academy_leaderboard_points;
create trigger academy_leaderboard_standings_refresh
after insert or update or delete on public.academy_leaderboard_points
for each row execute function public.academy_leaderboard_standings_refresh_trigger();

-- Standings are public to authenticated learners (leaderboard-facing data only).
alter table public.academy_leaderboard_standings enable row level security;
drop policy if exists academy_leaderboard_standings_read on public.academy_leaderboard_standings;
create policy academy_leaderboard_standings_read
on public.academy_leaderboard_standings
for select to authenticated
using (true);

revoke insert, update, delete on public.academy_leaderboard_standings from authenticated;

-- Seed and broadcast.
do $$
declare
  v_period uuid;
begin
  select id into v_period
  from public.academy_leaderboard_periods
  where status = 'active'
  order by starts_at desc
  limit 1;
  if v_period is not null then
    perform public.academy_refresh_leaderboard_standings(v_period);
  end if;
end;
$$;

do $$
begin
  begin alter publication supabase_realtime add table public.academy_leaderboard_standings; exception when duplicate_object then null; end;
end;
$$;

revoke execute on function public.academy_refresh_leaderboard_standings(uuid) from public, anon, authenticated;
revoke execute on function public.academy_leaderboard_standings_refresh_trigger() from public, anon, authenticated;