-- Phase 3: what a student should do next, in one call.
--
-- The dashboard previously assembled its state from four separate queries. On a
-- phone on a slow or unstable connection that is four round trips before the
-- page can say anything useful, and each one can fail on its own. This resolves
-- the whole "next action" in a single round trip, and applies the same rules
-- the rest of the system uses: active enrolment, published content, release
-- time reached, and the prerequisite chain.
--
-- A student can only ever see their own state: the function takes no student
-- argument and always reads auth.uid().

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

revoke execute on function public.academy_student_home() from public, anon;
grant execute on function public.academy_student_home() to authenticated;

-- Tell a student when a topic they can reach goes live. A trigger rather than a
-- line inside academy_set_lesson_status, so publishing through any route, the
-- admin editor or a direct write, still notifies.
create or replace function public.academy_notify_topic_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  week_course uuid;
begin
  if new.status is distinct from 'published' then
    return new;
  end if;
  if coalesce(old.status, '') = 'published' then
    return new;
  end if;

  select w.course_id into week_course
    from public.academy_weeks w
   where w.id = new.week_id;

  if week_course is null then
    return new;
  end if;

  insert into public.academy_notifications (user_id, type, title, message)
  select e.student_id,
         'lesson',
         'New topic: ' || new.title,
         left(
           coalesce(
             nullif(btrim(new.content ->> 'summary'), ''),
             new.title || ' is now available in week ' || w.week_number || '.'
           ),
           240
         )
    from public.academy_enrollments e
    join public.academy_weeks w on w.id = new.week_id
   where e.course_id = week_course
     and e.status = 'active';

  return new;
end;
$$;

drop trigger if exists academy_notify_topic_published on public.academy_lessons;
create trigger academy_notify_topic_published
  after update on public.academy_lessons
  for each row execute function public.academy_notify_topic_published();

revoke execute on function public.academy_notify_topic_published() from public, anon, authenticated;

notify pgrst, 'reload schema';
