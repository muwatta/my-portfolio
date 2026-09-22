-- Phase 3: admin content management and assignment authoring
-- This keeps course content editable in the database and exposes assignment visibility
-- by course enrollment rather than manual per-student assignment records.

alter table public.academy_courses
  add column if not exists course_type text not null default 'programming' check (course_type in ('programming', 'robotics', 'general')),
  add column if not exists featured_image_url text,
  add column if not exists short_description text,
  add column if not exists curriculum jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.academy_weeks
  add column if not exists description text not null default '',
  add column if not exists published boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table public.academy_lessons
  add column if not exists published boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table public.academy_exercises
  add column if not exists published boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  add column if not exists updated_at timestamptz not null default now();

alter table public.academy_assignments
  add column if not exists week_id uuid references public.academy_weeks(id) on delete set null,
  add column if not exists lesson_id uuid references public.academy_lessons(id) on delete set null,
  add column if not exists title text,
  add column if not exists instructions text not null default '',
  add column if not exists objectives jsonb not null default '[]'::jsonb,
  add column if not exists due_at timestamptz,
  add column if not exists total_points integer not null default 100 check (total_points > 0),
  add column if not exists difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  add column if not exists allowed_file_types text[] not null default array['.py', '.ipynb', '.txt', '.md', '.csv', '.pdf', '.docx'],
  add column if not exists max_file_size_bytes integer not null default 10485760 check (max_file_size_bytes > 0),
  add column if not exists retry_limit integer not null default 1 check (retry_limit >= 0),
  add column if not exists ai_marking_enabled boolean not null default true,
  add column if not exists is_draft boolean not null default true,
  add column if not exists published_at timestamptz,
  add column if not exists rubric jsonb not null default '[]'::jsonb,
  add column if not exists starter_code text,
  add column if not exists automated_tests jsonb,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.academy_assignment_visibility (
  assignment_id uuid not null references public.academy_assignments(id) on delete cascade,
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (assignment_id, course_id)
);

create table if not exists public.academy_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.academy_assignments(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  attempt_number integer not null default 1 check (attempt_number > 0),
  status text not null default 'submitted' check (status in ('submitted', 'processing', 'graded', 'returned', 'needs_review')),
  source_code text,
  file_path text,
  original_filename text,
  mime_type text,
  file_size_bytes integer check (file_size_bytes >= 0),
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id, attempt_number)
);

create index if not exists academy_assignments_course_week_idx on public.academy_assignments (course_id, week_id, lesson_id);
create index if not exists academy_assignment_visibility_course_idx on public.academy_assignment_visibility (course_id, assignment_id);
create index if not exists academy_assignments_publish_idx on public.academy_assignments (course_id, is_draft, published_at desc);

create or replace function public.academy_assignment_visible_to_student(p_student_id uuid, p_assignment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment_course_id uuid;
  v_active_enrollment boolean;
begin
  if p_student_id is null or p_assignment_id is null then
    return false;
  end if;

  select course_id into v_assignment_course_id
  from public.academy_assignments
  where id = p_assignment_id;

  if v_assignment_course_id is null then
    return false;
  end if;

  select exists (
    select 1
    from public.academy_enrollments e
    where e.student_id = p_student_id
      and e.course_id = v_assignment_course_id
      and e.status = 'active'
  ) into v_active_enrollment;

  return v_active_enrollment;
end;
$$;

drop policy if exists academy_assignments_course_read on public.academy_assignments;
create policy academy_assignments_course_read
on public.academy_assignments
for select to authenticated
using (
  public.academy_is_teacher()
  or public.academy_is_admin()
  or (not is_draft and exists (
      select 1
      from public.academy_enrollments e
      where e.student_id = auth.uid()
        and e.course_id = academy_assignments.course_id
        and e.status = 'active'
    ))
);

drop policy if exists academy_submissions_student_self_write on public.academy_submissions;
create policy academy_submissions_student_self_write
on public.academy_submissions
for insert to authenticated
with check (
  student_id = auth.uid() and public.academy_assignment_visible_to_student(auth.uid(), assignment_id)
);

drop policy if exists academy_submissions_student_self_read on public.academy_submissions;
create policy academy_submissions_student_self_read
on public.academy_submissions
for select to authenticated
using (
  student_id = auth.uid()
  or public.academy_is_teacher()
  or public.academy_is_admin()
);

create or replace function public.academy_broadcast_assignment_to_course()
returns trigger
language plpgsql
as $$
begin
  if new.is_draft = false and new.published_at is not null then
    insert into public.academy_assignment_visibility (assignment_id, course_id)
    values (new.id, new.course_id)
    on conflict (assignment_id, course_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists academy_assignment_visibility_broadcast on public.academy_assignments;
create trigger academy_assignment_visibility_broadcast
after insert or update of is_draft, published_at, course_id
on public.academy_assignments
for each row
execute function public.academy_broadcast_assignment_to_course();
