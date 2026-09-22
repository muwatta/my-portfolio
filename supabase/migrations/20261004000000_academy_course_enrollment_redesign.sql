-- Phase 1: course-based enrollment redesign
-- Preserve historical data, replace level-based active logic with a course-driven model,
-- and keep a single source of truth for the student's active programming course.

alter table public.academy_profiles
  add column if not exists current_course_id uuid references public.academy_courses(id) on delete set null;

alter table public.academy_courses
  add column if not exists is_programming_course boolean not null default false,
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists course_family text check (course_family in ('programming', 'robotics', 'general'));

update public.academy_courses
set is_programming_course = true,
    course_family = 'programming',
    is_active = true,
    sort_order = case
      when lower(slug) = 'python-for-ai-machine-learning' then 1
      when lower(slug) = 'python' then 2
      when lower(slug) = 'c++' then 3
      when lower(slug) = 'cpp' then 4
      when lower(slug) = 'pictoblox' then 5
      when lower(slug) = 'picto-blox' then 6
      else sort_order
    end
where lower(slug) in (
  'python-for-ai-machine-learning',
  'python',
  'c++',
  'cpp',
  'pictoblox',
  'picto-blox'
);

create or replace function public.academy_enforce_one_active_programming_enrollment()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'active' and exists (
    select 1
    from public.academy_enrollments e
    join public.academy_courses c on c.id = e.course_id
    where e.student_id = new.student_id
      and e.status = 'active'
      and c.is_programming_course = true
      and e.id <> new.id
  ) then
    raise exception 'A student cannot have more than one active programming-course enrollment at the same time.';
  end if;

  return new;
end;
$$;

drop trigger if exists academy_enrollments_one_active_programming_guard on public.academy_enrollments;
create trigger academy_enrollments_one_active_programming_guard
before insert or update of student_id, course_id, status
on public.academy_enrollments
for each row
execute function public.academy_enforce_one_active_programming_enrollment();

create or replace function public.academy_reconcile_student_current_course()
returns trigger
language plpgsql
as $$
declare
  v_course_id uuid;
begin
  select e.course_id into v_course_id
  from public.academy_enrollments e
  join public.academy_courses c on c.id = e.course_id
  where e.student_id = coalesce(new.student_id, old.student_id)
    and e.status = 'active'
    and c.is_programming_course = true
  order by e.enrolled_at desc nulls last, e.id desc
  limit 1;

  update public.academy_profiles
  set current_course_id = v_course_id
  where id = coalesce(new.student_id, old.student_id);

  return coalesce(new, old);
end;
$$;

drop trigger if exists academy_enrollments_reconcile_current_course on public.academy_enrollments;
create trigger academy_enrollments_reconcile_current_course
after insert or update of student_id, course_id, status or delete
on public.academy_enrollments
for each row
execute function public.academy_reconcile_student_current_course();

update public.academy_profiles p
set current_course_id = (
  select e.course_id
  from public.academy_enrollments e
  join public.academy_courses c on c.id = e.course_id
  where e.student_id = p.id
    and e.status = 'active'
    and c.is_programming_course = true
  order by e.enrolled_at desc, e.id desc
  limit 1
);

create index if not exists academy_courses_programming_active_idx
  on public.academy_courses (is_programming_course, is_active, sort_order);

create index if not exists academy_enrollments_active_student_course_idx
  on public.academy_enrollments (student_id, status, course_id);

-- NOTE:
-- The legacy academy_levels table remains as a compatibility shim to avoid destructive
-- migration risk and to preserve historical data. The active platform logic now moves to
-- course-based current_course_id resolution, not level-based enrollment rules.
