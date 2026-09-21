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
