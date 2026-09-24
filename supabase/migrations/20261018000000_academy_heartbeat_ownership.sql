-- Phase 5 hardening: learning-time heartbeats must be server-authoritative.
-- The original academy_heartbeat_learning_session looked up a session by id but
-- never verified that auth.uid() is the session owner. Any authenticated user who
-- guessed/knew a session id could add active_seconds to another student's session.
-- Re-create it with an ownership check, matching academy_record_learning_heartbeat.

create or replace function public.academy_heartbeat_learning_session(
  p_session_id uuid,
  p_route text,
  p_visibility_state text,
  p_active boolean
)
returns public.academy_learning_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.academy_learning_sessions;
begin
  select * into v_session
  from public.academy_learning_sessions
  where id = p_session_id
  for update;

  if v_session.id is null then
    raise exception 'Learning session not found.';
  end if;

  if v_session.student_id <> auth.uid() then
    raise exception 'Learning session ownership required.';
  end if;

  update public.academy_learning_sessions
  set last_heartbeat_at = now(),
      last_route = p_route,
      visibility_state = coalesce(p_visibility_state, visibility_state),
      is_active = coalesce(p_active, is_active),
      active_seconds = coalesce(active_seconds, 0) + case
        when coalesce(p_active, false) and coalesce(p_visibility_state, visibility_state) = 'visible'
          then greatest(0, least(inactivity_threshold_seconds, extract(epoch from (now() - v_session.last_heartbeat_at))::integer))
        else 0
      end,
      updated_at = now()
  where id = p_session_id;

  insert into public.academy_learning_session_events (session_id, student_id, event_type, route, active_seconds)
  values (p_session_id, v_session.student_id, 'heartbeat', p_route, 0);

  select * into v_session
  from public.academy_learning_sessions
  where id = p_session_id;

  return v_session;
end;
$$;

revoke execute on function public.academy_heartbeat_learning_session(uuid, text, text, boolean) from public, anon;
grant execute on function public.academy_heartbeat_learning_session(uuid, text, text, boolean) to authenticated;