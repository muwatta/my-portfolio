-- Two related gaps in the course lock.
--
-- The partial unique index
--   academy_enrollments_one_active_per_student_idx (student_id) where status = 'active'
-- is the real rule, and it does not care what kind of course it is. But
-- academy_select_course looked for an existing active enrollment only among
-- courses with is_programming_course = true. A student holding an active
-- enrollment in any other kind of course therefore passed the friendly lock
-- check and then hit the index, and the message they got was a raw
-- "duplicate key value violates unique constraint" instead of being told their
-- course is locked. The check now matches the index.
--
-- The index is also the only thing standing between two clicks and two
-- enrollments, because two requests can both pass the check before either
-- inserts. A unique violation is now caught and reported as the same friendly
-- message, so the race produces the right answer rather than a database error.
--
-- Selecting the course you already have stays idempotent: the upsert on
-- (student_id, course_id) means asking again returns the same enrollment rather
-- than a second row or an error. Verified against the live database.

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

  -- Any active enrollment, not only programming ones, because the unique index
  -- above is not filtered by course family. Filtering here and not there is what
  -- let a student reach the index and see a database error.
  select e.course_id into v_active_course_id
  from public.academy_enrollments e
  where e.student_id = target_student_id
    and e.status = 'active'
  order by e.enrolled_at desc nulls last, e.id desc
  limit 1;

  if v_active_course_id is not null and v_active_course_id <> target_course_id then
    raise exception 'Your current course is locked. Ask your teacher or admin to change it for you.';
  end if;

  begin
    insert into public.academy_enrollments (student_id, course_id, status)
    values (target_student_id, target_course_id, 'active')
    on conflict (student_id, course_id) do update set status = 'active';
  exception
    when unique_violation then
      -- Two clicks, two requests, one answer. The index settled it, and the
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
