-- Academy LMS foundation: levels, subjects, enrollment, scheduling, materials,
-- learning sessions, achievements, and live classroom records.

create table if not exists public.academy_levels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  description text not null default '',
  sort_order smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.academy_subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.academy_profiles
  add column if not exists level_id uuid references public.academy_levels(id) on delete set null;

alter table public.academy_courses
  add column if not exists subject_id uuid references public.academy_subjects(id) on delete set null,
  add column if not exists level_id uuid references public.academy_levels(id) on delete set null;

create table if not exists public.academy_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'withdrawn')),
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (student_id, course_id)
);

create table if not exists public.academy_schedules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.academy_courses(id) on delete cascade,
  level_id uuid references public.academy_levels(id) on delete cascade,
  lesson_id uuid references public.academy_lessons(id) on delete cascade,
  activity_type text not null check (activity_type in ('lesson', 'practice', 'assignment', 'project', 'live_class')),
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  published boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.academy_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.academy_courses(id) on delete cascade,
  lesson_id uuid references public.academy_lessons(id) on delete cascade,
  title text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/pdf',
  file_size_bytes integer not null check (file_size_bytes > 0),
  published boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.academy_learning_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  ended_at timestamptz,
  last_route text,
  active_seconds integer not null default 0 check (active_seconds >= 0),
  check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.academy_badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  description text not null default '',
  icon text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.academy_student_badges (
  student_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.academy_badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  awarded_by uuid references auth.users(id),
  primary key (student_id, badge_id)
);

create table if not exists public.academy_live_rooms (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.academy_schedules(id) on delete set null,
  title text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.academy_live_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.academy_live_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.academy_live_attendance (
  room_id uuid not null references public.academy_live_rooms(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (room_id, student_id)
);

create index if not exists academy_courses_level_subject_idx
  on public.academy_courses(level_id, subject_id);
create index if not exists academy_enrollments_student_idx
  on public.academy_enrollments(student_id, status);
create index if not exists academy_schedules_start_idx
  on public.academy_schedules(starts_at, published);
create index if not exists academy_sessions_student_activity_idx
  on public.academy_learning_sessions(student_id, last_heartbeat_at desc);
create index if not exists academy_live_messages_room_created_idx
  on public.academy_live_messages(room_id, created_at desc);

insert into public.academy_levels (slug, name, description, sort_order)
values
  ('lower', 'Lower Level', 'Foundational learning pathway.', 1),
  ('intermediate', 'Intermediate Level', 'Developing technical fluency and independence.', 2)
on conflict (slug) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

insert into public.academy_subjects (slug, name, description)
values
  ('python', 'Python', 'Python programming with a pathway toward AI and machine learning.'),
  ('cpp', 'C++', 'C++ programming for embedded systems and structured problem solving.')
on conflict (slug) do update set name = excluded.name, description = excluded.description;

alter table public.academy_levels enable row level security;
alter table public.academy_subjects enable row level security;
alter table public.academy_enrollments enable row level security;
alter table public.academy_schedules enable row level security;
alter table public.academy_materials enable row level security;
alter table public.academy_learning_sessions enable row level security;
alter table public.academy_badges enable row level security;
alter table public.academy_student_badges enable row level security;
alter table public.academy_live_rooms enable row level security;
alter table public.academy_live_messages enable row level security;
alter table public.academy_live_attendance enable row level security;

create policy academy_levels_read on public.academy_levels
  for select to authenticated using (active or public.academy_is_teacher());
create policy academy_levels_manage on public.academy_levels
  for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());

create policy academy_subjects_read on public.academy_subjects
  for select to authenticated using (active or public.academy_is_teacher());
create policy academy_subjects_manage on public.academy_subjects
  for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());

create policy academy_enrollments_self_read on public.academy_enrollments
  for select to authenticated using (student_id = auth.uid() or public.academy_is_teacher());
create policy academy_enrollments_teacher_manage on public.academy_enrollments
  for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());

create policy academy_schedules_read on public.academy_schedules
  for select to authenticated using (
    public.academy_is_teacher()
    or (published and (level_id is null or level_id = (select level_id from public.academy_profiles where id = auth.uid())))
  );
create policy academy_schedules_teacher_manage on public.academy_schedules
  for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());

create policy academy_materials_read on public.academy_materials
  for select to authenticated using (published or public.academy_is_teacher());
create policy academy_materials_teacher_manage on public.academy_materials
  for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());

create policy academy_sessions_self_read on public.academy_learning_sessions
  for select to authenticated using (student_id = auth.uid() or public.academy_is_teacher());
create policy academy_sessions_self_insert on public.academy_learning_sessions
  for insert to authenticated with check (student_id = auth.uid());
create policy academy_sessions_self_update on public.academy_learning_sessions
  for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

create policy academy_badges_read on public.academy_badges
  for select to authenticated using (active or public.academy_is_teacher());
create policy academy_badges_teacher_manage on public.academy_badges
  for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());

create policy academy_student_badges_self_read on public.academy_student_badges
  for select to authenticated using (student_id = auth.uid() or public.academy_is_teacher());
create policy academy_student_badges_teacher_manage on public.academy_student_badges
  for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());

create policy academy_live_rooms_read on public.academy_live_rooms
  for select to authenticated using (public.academy_is_teacher() or status <> 'ended');
create policy academy_live_rooms_teacher_manage on public.academy_live_rooms
  for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());

create policy academy_live_messages_read on public.academy_live_messages
  for select to authenticated using (exists (select 1 from public.academy_live_rooms r where r.id = room_id and r.status <> 'ended'));
create policy academy_live_messages_self_insert on public.academy_live_messages
  for insert to authenticated with check (sender_id = auth.uid());
create policy academy_live_messages_teacher_delete on public.academy_live_messages
  for delete to authenticated using (public.academy_is_teacher());

create policy academy_live_attendance_self_read on public.academy_live_attendance
  for select to authenticated using (student_id = auth.uid() or public.academy_is_teacher());
create policy academy_live_attendance_self_insert on public.academy_live_attendance
  for insert to authenticated with check (student_id = auth.uid());
create policy academy_live_attendance_self_update on public.academy_live_attendance
  for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

-- Limit temporary classroom history without touching academic records.
create or replace function public.academy_cleanup_live_messages()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.academy_live_messages
  where created_at < now() - interval '60 days';
$$;

revoke execute on function public.academy_cleanup_live_messages() from public, anon, authenticated;
-- P0 authorization hardening for Academy teacher controls.
-- Teachers may assign levels, but cannot change roles or profile identity fields.

drop policy if exists academy_profiles_teacher_update on public.academy_profiles;
create policy academy_profiles_teacher_level_update
  on public.academy_profiles for update to authenticated
  using (public.academy_is_teacher())
  with check (public.academy_is_teacher());

revoke update on public.academy_profiles from authenticated;
grant update (level_id) on public.academy_profiles to authenticated;

create or replace function public.academy_assign_student_level(
  target_student_id uuid,
  target_level_id uuid
)
returns public.academy_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.academy_profiles;
begin
  if not public.academy_is_teacher() then
    raise exception 'Academy teacher access required';
  end if;

  update public.academy_profiles
  set level_id = target_level_id,
      updated_at = now()
  where id = target_student_id
    and role = 'student'
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Student profile not found';
  end if;

  return updated_profile;
end;
$$;

revoke execute on function public.academy_assign_student_level(uuid, uuid) from public, anon;
grant execute on function public.academy_assign_student_level(uuid, uuid) to authenticated;
-- Separate trusted Academy administrators from ordinary teachers.
create table if not exists public.academy_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.academy_admins enable row level security;

create or replace function public.academy_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.academy_admins
    where user_id = auth.uid()
  );
$$;

create policy academy_admins_self_read on public.academy_admins
  for select to authenticated using (user_id = auth.uid() or public.academy_is_admin());

create policy academy_admins_admin_manage on public.academy_admins
  for all to authenticated using (public.academy_is_admin()) with check (public.academy_is_admin());

create or replace function public.academy_set_user_role(
  target_user_id uuid,
  target_role public.academy_role
)
returns public.academy_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.academy_profiles;
begin
  if not public.academy_is_admin() then
    raise exception 'Academy administrator access required';
  end if;

  update public.academy_profiles
  set role = target_role,
      updated_at = now()
  where id = target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Academy profile not found';
  end if;

  return updated_profile;
end;
$$;

revoke execute on function public.academy_is_admin() from public, anon;
grant execute on function public.academy_is_admin() to authenticated;
revoke execute on function public.academy_set_user_role(uuid, public.academy_role) from public, anon;
grant execute on function public.academy_set_user_role(uuid, public.academy_role) to authenticated;
-- Server-timestamped learning heartbeat. Clients cannot choose arbitrary active duration.
alter table public.academy_lesson_progress
  add column if not exists started_at timestamptz;

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
-- Objective practice scoring owned by the database.
alter table public.academy_exercises
  add column if not exists question_type text not null default 'programming'
    check (question_type in ('multiple_choice', 'true_false', 'short_answer', 'programming')),
  add column if not exists choices jsonb not null default '[]'::jsonb,
  add column if not exists correct_answer text,
  add column if not exists attempt_limit smallint not null default 3
    check (attempt_limit >= 0);

alter table public.academy_exercise_attempts
  add column if not exists score numeric(5, 2) not null default 0
    check (score >= 0),
  add column if not exists max_score numeric(5, 2) not null default 1
    check (max_score > 0),
  add column if not exists status text not null default 'graded'
    check (status in ('graded', 'rejected'));

-- Hidden answers and tests must never be selectable by browser clients.
revoke select on public.academy_exercises from anon, authenticated;
grant select (
  id, lesson_id, title, instructions, starter_code, difficulty,
  expected_concepts, hints, explanation, question_type, choices, attempt_limit
) on public.academy_exercises to authenticated;

revoke insert, update, delete on public.academy_exercise_attempts from authenticated;
grant select on public.academy_exercise_attempts to authenticated;

drop policy if exists academy_exercise_attempts_self on public.academy_exercise_attempts;
create policy academy_exercise_attempts_self_read on public.academy_exercise_attempts
  for select to authenticated using (student_id = auth.uid());

create or replace function public.academy_submit_objective_answer(
  target_exercise_id uuid,
  submitted_answer text
)
returns public.academy_exercise_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  exercise_row public.academy_exercises;
  attempt_count integer;
  is_correct boolean;
  attempt_row public.academy_exercise_attempts;
begin
  select * into exercise_row
  from public.academy_exercises
  where id = target_exercise_id;

  if exercise_row.id is null then
    raise exception 'Exercise not found';
  end if;
  if exercise_row.question_type = 'programming' then
    raise exception 'Programming exercises require the isolated grader';
  end if;

  select count(*) into attempt_count
  from public.academy_exercise_attempts
  where exercise_id = target_exercise_id and student_id = auth.uid();
  if attempt_count >= exercise_row.attempt_limit then
    raise exception 'Attempt limit reached';
  end if;

  is_correct := lower(trim(coalesce(submitted_answer, ''))) = lower(trim(coalesce(exercise_row.correct_answer, '')));

  insert into public.academy_exercise_attempts
    (exercise_id, student_id, code, passed, total, score, max_score, status)
  values
    (target_exercise_id, auth.uid(), left(coalesce(submitted_answer, ''), 10000),
     case when is_correct then 1 else 0 end, 1,
     case when is_correct then 1 else 0 end, 1, 'graded')
  returning * into attempt_row;

  return attempt_row;
end;
$$;

revoke execute on function public.academy_submit_objective_answer(uuid, text) from public, anon;
grant execute on function public.academy_submit_objective_answer(uuid, text) to authenticated;
-- P3 verified progression and private notifications.
create table if not exists public.academy_points (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  points integer not null check (points > 0),
  source_type text not null check (source_type in ('lesson', 'practice', 'assignment', 'project')),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  unique (student_id, source_type, source_id)
);

create table if not exists public.academy_notifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('lesson', 'assignment', 'feedback', 'badge', 'live_class', 'announcement')),
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists academy_points_leaderboard_idx
  on public.academy_points(student_id, created_at desc);
create index if not exists academy_notifications_student_idx
  on public.academy_notifications(student_id, created_at desc);

alter table public.academy_points enable row level security;
alter table public.academy_notifications enable row level security;

create policy academy_points_public_read on public.academy_points
  for select to authenticated using (true);
create policy academy_points_teacher_manage on public.academy_points
  for all to authenticated using (public.academy_is_teacher()) with check (public.academy_is_teacher());
create policy academy_notifications_self_read on public.academy_notifications
  for select to authenticated using (student_id = auth.uid() or public.academy_is_teacher());
create policy academy_notifications_self_update on public.academy_notifications
  for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy academy_notifications_teacher_insert on public.academy_notifications
  for insert to authenticated with check (public.academy_is_teacher());

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
declare badge_id uuid;
begin
  if auth.uid() is null or (auth.uid() <> target_student_id and not public.academy_is_teacher()) then
    raise exception 'Academy authorization required';
  end if;
  insert into public.academy_points(student_id, points, source_type, source_id)
  values (target_student_id, target_points, target_source_type, target_source_id)
  on conflict (student_id, source_type, source_id) do nothing;
  if target_badge_slug is not null then
    select id into badge_id from public.academy_badges where slug = target_badge_slug and active;
    if badge_id is not null then
      insert into public.academy_student_badges(student_id, badge_id)
      values (target_student_id, badge_id)
      on conflict do nothing;
    end if;
  end if;
end;
$$;

create or replace function public.academy_leaderboard()
returns table (student_id uuid, display_name text, level_name text, points bigint, rank bigint)
language sql
security definer
set search_path = public
as $$
  select p.id, p.display_name, l.name,
    coalesce(sum(ap.points), 0)::bigint,
    dense_rank() over (order by coalesce(sum(ap.points), 0) desc)
  from public.academy_profiles p
  left join public.academy_levels l on l.id = p.level_id
  left join public.academy_points ap on ap.student_id = p.id
  where p.role = 'student'
  group by p.id, p.display_name, l.name
  order by points desc, p.display_name;
$$;

revoke execute on function public.academy_award_verified_activity(uuid, text, uuid, integer, text) from public, anon;
grant execute on function public.academy_award_verified_activity(uuid, text, uuid, integer, text) to authenticated;
revoke execute on function public.academy_leaderboard() from public, anon;
grant execute on function public.academy_leaderboard() to authenticated;
-- Award progression only from database-recorded activity.
create or replace function public.academy_award_lesson_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed_at is not null and (old.completed_at is null or old.completed_at is distinct from new.completed_at) then
    perform public.academy_award_verified_activity(new.student_id, 'lesson', new.lesson_id, 10, 'first-lesson');
  end if;
  return new;
end;
$$;

drop trigger if exists academy_lesson_points on public.academy_lesson_progress;
create trigger academy_lesson_points
after insert or update on public.academy_lesson_progress
for each row execute procedure public.academy_award_lesson_points();

create or replace function public.academy_award_practice_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.passed > 0 then
    perform public.academy_award_verified_activity(new.student_id, 'practice', new.id, 5, 'first-practice');
  end if;
  return new;
end;
$$;

drop trigger if exists academy_practice_points on public.academy_exercise_attempts;
create trigger academy_practice_points
after insert on public.academy_exercise_attempts
for each row execute procedure public.academy_award_practice_points();
-- Enable Realtime for temporary classroom messages and attendance.
do $$
begin
  alter publication supabase_realtime add table public.academy_live_messages;
  alter publication supabase_realtime add table public.academy_live_attendance;
exception when duplicate_object then null;
end $$;

create or replace function public.academy_cleanup_live_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.academy_live_messages where created_at < now() - interval '60 days';
  delete from public.academy_live_attendance where joined_at < now() - interval '60 days';
end;
$$;

revoke execute on function public.academy_cleanup_live_data() from public, anon, authenticated;
