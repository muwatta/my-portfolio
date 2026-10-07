-- Serialize learner course selection and reject re-selecting the active course.
-- The same RPC remains usable for legacy enrollment repair when no active
-- enrollment exists, and staff course assignment uses its separate RPC.

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
  v_profile_id uuid;
begin
  if auth.uid() <> target_student_id then
    raise exception 'Students may only select a course for themselves.';
  end if;

  -- Lock the profile so two concurrent course choices cannot both pass the
  -- no-current-course check.
  select id into v_profile_id
    from public.academy_profiles
   where id = target_student_id
     and role = 'student'
   for update;
  if v_profile_id is null then
    raise exception 'Only student profiles can select a course.';
  end if;

  if not exists (
    select 1
      from public.academy_courses
     where id = target_course_id
       and published
       and is_active
  ) then
    raise exception 'Course is not available.';
  end if;

  select course_id into v_active_course_id
    from public.academy_enrollments
   where student_id = target_student_id
     and status = 'active'
   order by enrolled_at desc nulls last, id desc
   limit 1;

  if v_active_course_id = target_course_id then
    raise exception 'This is already your current course.';
  elsif v_active_course_id is not null then
    raise exception 'Your current course is locked. Ask your teacher or admin to change it for you.';
  end if;

  insert into public.academy_enrollments (student_id, course_id, status)
  values (target_student_id, target_course_id, 'active')
  on conflict (student_id, course_id) do update set status = 'active';

  select * into selected_enrollment
    from public.academy_enrollments
   where student_id = target_student_id
     and course_id = target_course_id;
  return selected_enrollment;
end;
$$;

revoke execute on function public.academy_select_course(uuid, uuid)
  from public, anon;
grant execute on function public.academy_select_course(uuid, uuid)
  to authenticated;

notify pgrst, 'reload schema';
