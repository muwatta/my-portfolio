-- Phase 6: server-authoritative learning time tracking and heartbeat lifecycle

alter table public.academy_learning_sessions
  add column if not exists visibility_state text not null default 'visible' check (visibility_state in ('visible', 'hidden', 'pruned')),
  add column if not exists inactivity_threshold_seconds integer not null default 180,
  add column if not exists is_active boolean not null default true,
  add column if not exists last_route text,
  add column if not exists active_course_id uuid references public.academy_courses(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.academy_learning_session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.academy_learning_sessions(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('started', 'heartbeat', 'page_hidden', 'page_visible', 'route_changed', 'inactive', 'active', 'ended')),
  route text,
  active_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists academy_learning_sessions_student_active_idx on public.academy_learning_sessions (student_id, is_active, last_heartbeat_at desc);
create index if not exists academy_learning_session_events_session_idx on public.academy_learning_session_events (session_id, created_at desc);

create or replace function public.academy_heartbeat_learning_session(p_session_id uuid, p_route text, p_visibility_state text, p_active boolean)
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

drop policy if exists academy_learning_sessions_self_read on public.academy_learning_sessions;
create policy academy_learning_sessions_self_read
on public.academy_learning_sessions
for select to authenticated
using (
  student_id = auth.uid() or public.academy_is_teacher() or public.academy_is_admin()
);

drop policy if exists academy_learning_session_events_self_read on public.academy_learning_session_events;
create policy academy_learning_session_events_self_read
on public.academy_learning_session_events
for select to authenticated
using (
  student_id = auth.uid() or public.academy_is_teacher() or public.academy_is_admin()
);
