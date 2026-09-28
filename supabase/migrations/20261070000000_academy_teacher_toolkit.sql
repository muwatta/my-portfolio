-- Phase 5: announcements, the gradebook, and a teacher dashboard that answers
-- "what needs me today" in one call.
--
-- Announcements are a notification fan out, not a new messaging system. The
-- notifications table already exists with an 'announcement' type and had no
-- writer at all, which is why students never heard anything.

-- Announce to a whole course, a class, or one student.

create or replace function public.academy_announce(
  p_title text,
  p_message text,
  p_course_id uuid default null,
  p_class_id uuid default null,
  p_student_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recipients integer := 0;
begin
  if not public.academy_is_teacher() then
    raise exception 'Teacher access required.' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_title, '')), '') is null
     or nullif(trim(coalesce(p_message, '')), '') is null then
    raise exception 'An announcement needs a title and a message.' using errcode = '22023';
  end if;
  if p_course_id is null and p_class_id is null and p_student_id is null then
    raise exception 'Choose a course, a class or a student.' using errcode = '22023';
  end if;

  with targets as (
    select e.student_id
      from public.academy_enrollments e
     where p_student_id is not null and e.student_id = p_student_id
    union
    select e.student_id
      from public.academy_enrollments e
     where p_course_id is not null
       and e.course_id = p_course_id
       and e.status = 'active'
    union
    select m.student_id
      from public.academy_class_members m
     where p_class_id is not null
       and m.class_id = p_class_id
       and m.status = 'active'
  ),
  inserted as (
    insert into public.academy_notifications (user_id, type, title, message)
    select t.student_id,
           'announcement',
           left(trim(p_title), 120),
           left(trim(p_message), 1000)
      from targets t
    returning 1
  )
  select count(*) into recipients from inserted;

  insert into public.academy_activity_feed (
    actor_id, actor_name, activity_type, entity_type, entity_label,
    course_id, metadata
  )
  select auth.uid(),
         (select display_name from public.academy_profiles where id = auth.uid()),
         'announcement',
         'notification',
         left(trim(p_title), 120),
         p_course_id,
         jsonb_build_object('recipients', recipients, 'class_id', p_class_id, 'student_id', p_student_id);

  return recipients;
end;
$$;

-- The gradebook. One row per student per assignment with the published mark, so
-- a teacher can see a whole class in one call and export it.

create or replace function public.academy_gradebook(
  p_course_id uuid
)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.academy_is_teacher() then
    raise exception 'Teacher access required.' using errcode = '42501';
  end if;
  if p_course_id is null then
    raise exception 'A course is required.' using errcode = '22023';
  end if;

  return query
  with students as (
    select e.student_id,
           coalesce(nullif(btrim(pr.display_name), ''),
                    split_part(coalesce(u.email, ''), '@', 1), 'Student') as name,
           u.email
      from public.academy_enrollments e
      join auth.users u on u.id = e.student_id
      left join public.academy_profiles pr on pr.id = e.student_id
     where e.course_id = p_course_id
       and e.status = 'active'
  ),
  tasks as (
    select a.id,
           a.title,
           coalesce(a.points, 100) as max_points
      from public.academy_assignments a
     where a.status = 'published'
       and (
         a.course_id = p_course_id
         or a.week_id in (select id from public.academy_weeks where course_id = p_course_id)
       )
  )
  select jsonb_build_object(
    'student_id', s.student_id,
    'student_name', s.name,
    'student_email', s.email,
    'total_earned', coalesce((
      select sum(r.final_score)
        from public.academy_submissions sub
        join public.academy_submission_results r on r.submission_id = sub.id
       where sub.student_id = s.student_id
         and r.review_state = 'published'
         and sub.assignment_id in (select id from tasks)
    ), 0),
    'total_possible', coalesce((select sum(max_points) from tasks), 0),
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
               'assignment_id', t.id,
               'title', t.title,
               'max_points', t.max_points,
               'score', r.final_score,
               'state', coalesce(r.review_state, 'unsubmitted')
             ) order by t.title)
        from tasks t
        left join lateral (
          select res.final_score, res.review_state
            from public.academy_submissions sub
            join public.academy_submission_results res on res.submission_id = sub.id
           where sub.assignment_id = t.id
             and sub.student_id = s.student_id
             and res.review_state = 'published'
           order by sub.attempt_number desc
           limit 1
        ) r on true
    ), '[]'::jsonb)
  )
  from students s
  order by s.name;
end;
$$;

-- Everything the teacher dashboard needs, in one round trip.

create or replace function public.academy_teacher_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.academy_is_teacher() then
    raise exception 'Teacher access required.' using errcode = '42501';
  end if;

  -- Every list is an inner subquery that orders and limits, wrapped in an
  -- aggregate that orders again. Putting order by directly on a subquery that
  -- feeds jsonb_agg makes Postgres read the column as a grouping column and
  -- fail with SQLSTATE 42803, so the shape is kept uniform on purpose.
  return jsonb_build_object(
    'needs_grading', coalesce((
      select jsonb_agg(item order by (item ->> 'submitted_at') desc)
        from (
          select jsonb_build_object(
                   'submission_id', s.id,
                   'assignment_title', a.title,
                   'student_name', coalesce(nullif(btrim(pr.display_name), ''),
                                            split_part(coalesce(u.email, ''), '@', 1), 'Student'),
                   'submitted_at', s.submitted_at,
                   'review_state', coalesce(r.review_state, 'unreviewed')
                 ) as item
            from public.academy_submissions s
            join public.academy_assignments a on a.id = s.assignment_id
            left join public.academy_submission_results r on r.submission_id = s.id
            left join public.academy_profiles pr on pr.id = s.student_id
            left join auth.users u on u.id = s.student_id
           where coalesce(r.review_state, 'unreviewed') in ('unreviewed', 'in_review', 'reviewed')
           order by s.submitted_at
           limit 12
        ) q
    ), '[]'::jsonb),

    'due_this_week', coalesce((
      select jsonb_agg(item order by (item ->> 'due_at'))
        from (
          select jsonb_build_object(
                   'assignment_id', a.id,
                   'title', a.title,
                   'due_at', a.due_at,
                   'submissions', (
                     select count(*) from public.academy_submissions s2
                      where s2.assignment_id = a.id
                   )
                 ) as item
            from public.academy_assignments a
           where a.status = 'published'
             and a.due_at is not null
             and a.due_at between now() and now() + interval '7 days'
           order by a.due_at
        ) q
    ), '[]'::jsonb),

    -- Quiet for ten days or more, which is long enough to cover a weekend.
    'inactive_students', coalesce((
      select jsonb_agg(item order by (item ->> 'days_quiet') desc)
        from (
          select jsonb_build_object(
                   'student_id', e.student_id,
                   'name', coalesce(nullif(btrim(pr.display_name), ''),
                                    split_part(coalesce(u.email, ''), '@', 1), 'Student'),
                   'course_title', c.title,
                   'last_seen', ls.last_heartbeat_at,
                   'days_quiet', coalesce(
                     floor(extract(epoch from (now() - ls.last_heartbeat_at)) / 86400)::int,
                     9999
                   )
                 ) as item
            from public.academy_enrollments e
            join auth.users u on u.id = e.student_id
            left join public.academy_profiles pr on pr.id = e.student_id
            left join public.academy_courses c on c.id = e.course_id
            left join lateral (
              select s2.last_heartbeat_at
                from public.academy_learning_sessions s2
               where s2.student_id = e.student_id
               order by s2.last_heartbeat_at desc nulls last
               limit 1
            ) ls on true
           where e.status = 'active'
           order by ls.last_heartbeat_at asc nulls first
           limit 20
        ) q
       where (q.item ->> 'days_quiet')::int >= 10
    ), '[]'::jsonb),

    'completion', coalesce((
      select jsonb_agg(item order by (item ->> 'course_title'))
        from (
          select jsonb_build_object(
                   'course_id', c.id,
                   'course_title', c.title,
                   'total', (select count(*) from public.academy_lessons l
                               join public.academy_weeks w2 on w2.id = l.week_id
                              where w2.course_id = c.id
                                and l.status = 'published'
                                and (l.release_at is null or l.release_at <= now())),
                   'completed', (select count(*) from public.academy_lesson_progress lp
                                   join public.academy_lessons l3 on l3.id = lp.lesson_id
                                   join public.academy_weeks w3 on w3.id = l3.week_id
                                  where w3.course_id = c.id
                                    and lp.completed_at is not null),
                   'students', (select count(*) from public.academy_enrollments e2
                                  where e2.course_id = c.id and e2.status = 'active')
                 ) as item
            from public.academy_courses c
           where c.published
           order by c.title
        ) q
    ), '[]'::jsonb),

    'recent_activity', coalesce((
      select jsonb_agg(item order by (item ->> 'created_at') desc)
        from (select to_jsonb(f) as item
                from public.academy_activity_feed f
               order by f.created_at desc
               limit 10) q
    ), '[]'::jsonb),

    'totals', jsonb_build_object(
      'students', (select count(*) from public.academy_enrollments where status = 'active'),
      'courses', (select count(*) from public.academy_courses where published),
      'lessons', (select count(*) from public.academy_lessons where status = 'published'),
      'submissions', (select count(*) from public.academy_submissions)
    )
  );
end;
$$;

revoke execute on function public.academy_announce(text, text, uuid, uuid, uuid) from public, anon;
revoke execute on function public.academy_gradebook(uuid) from public, anon;
revoke execute on function public.academy_teacher_dashboard() from public, anon;
grant execute on function public.academy_announce(text, text, uuid, uuid, uuid) to authenticated;
grant execute on function public.academy_gradebook(uuid) to authenticated;
grant execute on function public.academy_teacher_dashboard() to authenticated;

notify pgrst, 'reload schema';
