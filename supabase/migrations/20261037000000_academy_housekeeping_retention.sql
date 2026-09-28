-- Phase 1, step 1: make housekeeping actually run.
--
-- 20261012000000 guarded its cron.schedule call with
--   if to_regprocedure('cron.schedule(text,text)') is not null
-- which silently does nothing when pg_cron is absent. On this project pg_cron
-- was not installed, so the daily live-data cleanup was never registered and
-- live messages, learning sessions and heartbeat events have been growing
-- without bound. The extension is now present, so schedule the job for real,
-- and make the job's retention window explicit rather than hard coded.
--
-- This is additive and destroys no live data: it only removes rows that are
-- already older than the retention window.

create extension if not exists pg_cron;

-- 14 days for chat, as requested. Voice notes will live in the same table
-- family and inherit this window.
create or replace function public.academy_cleanup_live_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.academy_live_messages
    where created_at < now() - interval '14 days';

  -- Time tracking is only useful while the session is recent. Closed sessions
  -- older than the window are dead weight; active ones are never touched.
  delete from public.academy_learning_sessions
    where is_active is false
      and coalesce(ended_at, last_heartbeat_at, started_at) < now() - interval '14 days';

  -- The event log is append only and grows fastest of all, one row per
  -- heartbeat per student. Keep the trail for the same window.
  delete from public.academy_learning_session_events
    where created_at < now() - interval '14 days';
end;
$$;

revoke execute on function public.academy_cleanup_live_data()
  from public, anon, authenticated;

-- Register once. unschedule first so re-running this migration cannot stack up
-- duplicate jobs.
do $$
begin
  if to_regprocedure('cron.schedule(text,text)') is null then
    raise notice 'pg_cron is unavailable, academy housekeeping will not run';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'academy-live-retention') then
    perform cron.unschedule('academy-live-retention');
  end if;

  perform cron.schedule(
    'academy-live-retention',
    '17 3 * * *',
    'select public.academy_cleanup_live_data()'
  );
exception when others then
  raise warning 'could not schedule academy-live-retention: %', sqlerrm;
end;
$$;
