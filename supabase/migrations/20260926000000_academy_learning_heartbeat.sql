-- Server-timestamped learning heartbeat. Clients cannot choose arbitrary active duration.
alter table public.academy_lesson_progress
  add column if not exists started_at timestamptz;

create or replace function public.academy_start_learning_session(
  target_route text
)
returns public.academy_learning_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  new_session public.academy_learning_sessions;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.academy_learning_sessions (student_id, last_route)
  values (auth.uid(), left(coalesce(target_route, ''), 500))
  returning * into new_session;

  return new_session;
end;
$$;

revoke execute on function public.academy_start_learning_session(text) from public, anon;
grant execute on function public.academy_start_learning_session(text) to authenticated;

create or replace function public.academy_record_learning_heartbeat(
  target_session_id uuid,
  target_route text
)
returns public.academy_learning_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  current_session public.academy_learning_sessions;
  heartbeat_delta integer;
begin
  select * into current_session
  from public.academy_learning_sessions
  where id = target_session_id
    and student_id = auth.uid()
  for update;

  if current_session.id is null then
    raise exception 'Learning session not found';
  end if;

  heartbeat_delta := greatest(
    0,
    least(60, extract(epoch from (now() - current_session.last_heartbeat_at))::integer)
  );

  update public.academy_learning_sessions
  set last_heartbeat_at = now(),
      last_route = left(coalesce(target_route, ''), 500),
      active_seconds = current_session.active_seconds + heartbeat_delta
  where id = target_session_id
  returning * into current_session;

  return current_session;
end;
$$;

revoke execute on function public.academy_record_learning_heartbeat(uuid, text) from public, anon;
grant execute on function public.academy_record_learning_heartbeat(uuid, text) to authenticated;

drop policy if exists academy_sessions_self_insert on public.academy_learning_sessions;
drop policy if exists academy_sessions_self_update on public.academy_learning_sessions;
