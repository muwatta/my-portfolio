-- Selecting the course you are already on always failed.
--
-- academy_select_course did an upsert, and Postgres runs the BEFORE INSERT
-- trigger speculatively before deciding the row conflicts. That trigger,
-- academy_enforce_one_active_programming_enrollment, excluded the existing row
-- with `e.id <> new.id`, but at that moment new.id is a freshly generated uuid
-- rather than the id of the row already there. So the student's own enrollment
-- counted as a second one and the select was refused:
--
--   A student cannot have more than one active programming-course enrollment at
--   the same time.
--
-- Which is the right rule and the wrong diagnosis. Two fixes, because either
-- alone leaves the other path able to produce it.
--
-- The trigger now compares (student_id, course_id) instead of id. A genuine
-- second enrollment is a different course, so it is still caught, and an upsert
-- on the current course is no longer mistaken for one.
--
-- academy_select_course no longer upserts. It returns the existing enrollment
-- when there already is one, which is what "selecting the course I am on" means,
-- and only inserts when there is nothing to reuse.

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
      -- Compared on the pair, not on id. On an upsert the row about to be
      -- replaced is not yet in the table under its own id, so an id comparison
      -- calls the student's own enrollment a second one.
      and (e.student_id, e.course_id) <> (new.student_id, new.course_id)
  ) then
    raise exception 'A student cannot have more than one active programming-course enrollment at the same time.';
  end if;

  return new;
end;
$$;

create or replace function public.academy_select_course(
  target_student_id uuid,
  target_course_id uuid
)
returns public.academy_enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_enrollment public.academy_enrollments;
  v_active_course_id uuid;
begin
  if auth.uid() <> target_student_id then
    raise exception 'Students may only select a course for themselves.';
  end if;
  if not exists (
    select 1 from public.academy_profiles
    where id = target_student_id and role = 'student'
  ) then
    raise exception 'Only student profiles can select a course.';
  end if;
  if not exists (
    select 1 from public.academy_courses
    where id = target_course_id and published and is_active
  ) then
    raise exception 'Course is not available.';
  end if;

  -- Any active enrollment, not only programming ones, because the partial unique
  -- index academy_enrollments_one_active_per_student_idx is not filtered by
  -- course family. Filtering here and not there is what let a student reach the
  -- index and see a raw duplicate-key error.
  select e.course_id into v_active_course_id
  from public.academy_enrollments e
  where e.student_id = target_student_id
    and e.status = 'active'
  order by e.enrolled_at desc nulls last, e.id desc
  limit 1;

  if v_active_course_id is not null and v_active_course_id <> target_course_id then
    raise exception 'Your current course is locked. Ask your teacher or admin to change it for you.';
  end if;

  -- Already enrolled on this course, or was and is not any more. Reusing the
  -- existing row keeps the enrolment date, and a plain update does not trip the
  -- speculative-insert path that made this fail.
  select * into selected_enrollment
  from public.academy_enrollments
  where student_id = target_student_id and course_id = target_course_id;

  if selected_enrollment.id is not null then
    if selected_enrollment.status <> 'active' then
      update public.academy_enrollments
      set status = 'active'
      where id = selected_enrollment.id
      returning * into selected_enrollment;
    end if;
    return selected_enrollment;
  end if;

  begin
    insert into public.academy_enrollments (student_id, course_id, status)
    values (target_student_id, target_course_id, 'active');
  exception
    when unique_violation then
      -- Two clicks, two requests, one answer. The index settled it and the
      -- student is told what happened in the same words as everywhere else.
      raise exception 'Your current course is locked. Ask your teacher or admin to change it for you.';
  end;

  select * into selected_enrollment from public.academy_enrollments
  where student_id = target_student_id and course_id = target_course_id;
  return selected_enrollment;
end;
$$;

revoke execute on function public.academy_select_course(uuid, uuid) from public, anon;
grant execute on function public.academy_select_course(uuid, uuid) to authenticated;
