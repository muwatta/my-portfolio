-- Phase 2: lesson structure, subtopics, and prerequisite gating
-- This keeps teaching content database-driven and enforces access at the database layer.

alter table public.academy_lessons
  add column if not exists prerequisite_lesson_id uuid references public.academy_lessons(id) on delete set null,
  add column if not exists completion_requirement text not null default 'quiz_or_check' check (completion_requirement in ('read', 'practice', 'quiz_or_check', 'code_run', 'challenge')),
  add column if not exists completion_mode text not null default 'lesson_check' check (completion_mode in ('read', 'lesson_check', 'quiz', 'challenge', 'project_milestone')),
  add column if not exists preview_allowed boolean not null default false;

create table if not exists public.academy_lesson_subtopics (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.academy_lessons(id) on delete cascade,
  title text not null,
  concept text not null,
  explanation text not null,
  example text,
  ordering integer not null default 1,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  unique (lesson_id, ordering)
);

alter table public.academy_lesson_progress
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists completion_status text not null default 'not_started' check (completion_status in ('not_started', 'in_progress', 'completed', 'failed', 'needs_review')),
  add column if not exists attempts integer not null default 0,
  add column if not exists latest_score numeric(5,2) check (latest_score >= 0 and latest_score <= 100);

update public.academy_lesson_progress
set
  started_at = coalesce(started_at, completed_at, now()),
  completion_status = case
    when completed_at is not null then 'completed'
    when started_at is not null then 'in_progress'
    else 'not_started'
  end,
  attempts = coalesce(attempts, 0)
where started_at is null
   or completion_status is null;

create or replace function public.academy_lesson_is_unlocked_for_student(
  p_student_id uuid,
  p_lesson_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_prerequisite_lesson_id uuid;
  v_prereq_completed boolean;
  v_active_enrollment boolean;
begin
  if p_student_id is null or p_lesson_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.academy_admins
    where user_id = p_student_id
  )
  or exists (
    select 1
    from public.academy_profiles
    where id = p_student_id
      and role = 'teacher'
  )
  then
    return true;
  end if;

  select
    w.course_id,
    l.prerequisite_lesson_id
  into
    v_course_id,
    v_prerequisite_lesson_id
  from public.academy_lessons l
  join public.academy_weeks w
    on w.id = l.week_id
  where l.id = p_lesson_id;

  if v_course_id is null then
    return false;
  end if;

  select exists (
    select 1
    from public.academy_enrollments e
    where e.student_id = p_student_id
      and e.course_id = v_course_id
      and e.status = 'active'
  )
  into v_active_enrollment;

  if not v_active_enrollment then
    return false;
  end if;

  if v_prerequisite_lesson_id is null then
    return true;
  end if;

  select exists (
    select 1
    from public.academy_lesson_progress lp
    where lp.student_id = p_student_id
      and lp.lesson_id = v_prerequisite_lesson_id
      and lp.completion_status = 'completed'
  )
  into v_prereq_completed;

  return v_prereq_completed;
end;
$$;

create or replace function public.academy_lesson_access_policy_check()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    if not public.academy_lesson_is_unlocked_for_student(
      auth.uid(),
      new.lesson_id
    )
    and not public.academy_is_teacher()
    and not public.academy_is_admin()
    then
      raise exception 'Lesson is locked. Complete the prerequisite lesson before continuing.';
    end if;

    return new;
  end if;

  if TG_OP = 'UPDATE' then
    if not public.academy_lesson_is_unlocked_for_student(
      auth.uid(),
      new.lesson_id
    )
    and not public.academy_is_teacher()
    and not public.academy_is_admin()
    then
      raise exception 'Lesson is locked. Complete the prerequisite lesson before continuing.';
    end if;

    return new;
  end if;

  return old;
end;
$$;

drop trigger if exists academy_lesson_progress_access_guard
on public.academy_lesson_progress;

create trigger academy_lesson_progress_access_guard
before insert or update on public.academy_lesson_progress
for each row
execute function public.academy_lesson_access_policy_check();

drop policy if exists academy_lessons_student_read on public.academy_lessons;
create policy academy_lessons_student_read
on public.academy_lessons
for select to authenticated
using (
  public.academy_is_teacher()
  or public.academy_is_admin()
  or public.academy_lesson_is_unlocked_for_student(auth.uid(), id)
);

drop policy if exists academy_lesson_progress_student_own_read on public.academy_lesson_progress;
create policy academy_lesson_progress_student_own_read
on public.academy_lesson_progress
for select to authenticated
using (
  student_id = auth.uid()
  or public.academy_is_teacher()
  or public.academy_is_admin()
);

drop policy if exists academy_lesson_progress_student_own_write on public.academy_lesson_progress;
create policy academy_lesson_progress_student_own_write
on public.academy_lesson_progress
for insert to authenticated
with check (
  student_id = auth.uid()
  and public.academy_lesson_is_unlocked_for_student(
    auth.uid(),
    lesson_id
  )
);

drop policy if exists academy_lesson_progress_student_own_update on public.academy_lesson_progress;
create policy academy_lesson_progress_student_own_update
on public.academy_lesson_progress
for update to authenticated
using (
  student_id = auth.uid()
  or public.academy_is_teacher()
  or public.academy_is_admin()
)
with check (
  student_id = auth.uid()
  and public.academy_lesson_is_unlocked_for_student(
    auth.uid(),
    lesson_id
  )
);

create index if not exists academy_lessons_prerequisite_idx
  on public.academy_lessons (prerequisite_lesson_id);

create index if not exists academy_lesson_subtopics_lesson_order_idx
  on public.academy_lesson_subtopics (lesson_id, ordering);

create index if not exists academy_lesson_progress_student_lesson_idx
  on public.academy_lesson_progress (
    student_id,
    lesson_id,
    completion_status
  );