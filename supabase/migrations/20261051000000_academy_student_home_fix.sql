-- Phase 3 correction.
--
-- academy_student_home tested `if not academy_is_teacher()` before returning the
-- empty payload. Since a student is not a teacher, every real student received
-- the blank object and the dashboard had nothing to show. The condition is now
-- positive: staff get the empty payload, students get their real state.
--
-- 20261050000000 is corrected as well so a fresh database is created right.

create or replace function public.academy_student_home()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_student uuid := auth.uid();
  active_course public.academy_courses;
  continue_lesson jsonb;
  next_lesson jsonb;
  due_soon jsonb;
  done_count integer := 0;
  total_count integer := 0;
begin
  if current_student is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  if public.academy_is_teacher() then
    -- A teacher or admin has no student state of their own to continue. Note
    -- the positive check: a student is not a teacher, and returning the empty
    -- payload to students would leave the dashboard permanently blank.
    return jsonb_build_object(
      'course', null,
      'continue_lesson', null,
      'next_lesson', null,
      'due_soon', '[]'::jsonb,
      'completed_count', 0,
      'total_count', 0
    );
  end if;

  select c.* into active_course
    from public.academy_enrollments e
    join public.academy_courses c on c.id = e.course_id
   where e.student_id = current_student
     and e.status = 'active'
   order by e.enrolled_at
   limit 1;

  if active_course.id is null then
    return jsonb_build_object(
      'course', null,
      'continue_lesson', null,
      'next_lesson', null,
      'due_soon', '[]'::jsonb,
      'completed_count', 0,
      'total_count', 0
    );
  end if;

  select count(*) into total_count
    from public.academy_lessons l
    join public.academy_weeks w on w.id = l.week_id
   where w.course_id = active_course.id
     and l.status = 'published'
     and (l.release_at is null or l.release_at <= now());

  select count(*) into done_count
    from public.academy_lesson_progress p
    join public.academy_lessons l on l.id = p.lesson_id
    join public.academy_weeks w on w.id = l.week_id
   where p.student_id = current_student
     and p.completed_at is not null
     and w.course_id = active_course.id;

  -- Resume the topic that was started but not finished, most recent first.
  select jsonb_build_object(
           'lesson_id', l.id,
           'title', l.title,
           'week_number', w.week_number,
           'week_title', w.title,
           'slug', l.slug,
           'completion_status', p.completion_status,
           'started_at', p.started_at,
           'last_seen_at', greatest(coalesce(p.updated_at, p.started_at), p.started_at)
         )
    into continue_lesson
    from public.academy_lesson_progress p
    join public.academy_lessons l on l.id = p.lesson_id
    join public.academy_weeks w on w.id = l.week_id
   where p.student_id = current_student
     and p.completed_at is null
     and w.course_id = active_course.id
     and l.status = 'published'
     and (l.release_at is null or l.release_at <= now())
     and public.academy_lesson_is_unlocked_for_student(current_student, l.id)
   order by greatest(coalesce(p.updated_at, p.started_at), p.started_at) desc
   limit 1;

  -- Otherwise the next topic the student is allowed into.
  if continue_lesson is null then
    select jsonb_build_object(
             'lesson_id', l.id,
             'title', l.title,
             'week_number', w.week_number,
             'week_title', w.title,
             'slug', l.slug
           )
      into next_lesson
      from public.academy_lessons l
      join public.academy_weeks w on w.id = l.week_id
     where w.course_id = active_course.id
       and l.status = 'published'
       and (l.release_at is null or l.release_at <= now())
       and public.academy_lesson_is_unlocked_for_student(current_student, l.id)
       and not exists (
         select 1 from public.academy_lesson_progress p
          where p.lesson_id = l.id
            and p.student_id = current_student
            and p.completed_at is not null
       )
     order by w.week_number, l.sort_order, l.lesson_number
     limit 1;
  end if;

  -- Assignments already released, not yet submitted, soonest deadline first.
  select coalesce(jsonb_agg(entry), '[]'::jsonb)
    into due_soon
    from (
      select jsonb_build_object(
               'assignment_id', a.id,
               'title', a.title,
               'due_at', a.due_at,
               'points', a.points,
               'late_policy', a.late_policy,
               'attempts_used', (
                 select count(*) from public.academy_submissions s
                  where s.assignment_id = a.id
                    and s.student_id = current_student
               ),
               'retry_limit', a.retry_limit
             ) as entry
        from public.academy_assignments a
       where a.status = 'published'
         and (a.release_at is null or a.release_at <= now())
         and (
           a.course_id = active_course.id
           or a.week_id in (
             select w2.id from public.academy_weeks w2
              where w2.course_id = active_course.id
           )
         )
         and not exists (
           select 1 from public.academy_submissions s
            where s.assignment_id = a.id
              and s.student_id = current_student
         )
       order by a.due_at nulls last, a.title
       limit 8
    ) rows;

  return jsonb_build_object(
    'course', jsonb_build_object(
      'id', active_course.id,
      'slug', active_course.slug,
      'title', active_course.title,
      'language', active_course.language,
      'duration_weeks', active_course.duration_weeks
    ),
    'continue_lesson', continue_lesson,
    'next_lesson', next_lesson,
    'due_soon', coalesce(due_soon, '[]'::jsonb),
    'completed_count', done_count,
    'total_count', total_count
  );
end;
$$;
