-- Phase 5 correction, dashboard aggregation.
--
-- The needs_grading and due_this_week blocks put order by and limit directly on
-- a subquery that feeds a scalar jsonb_agg, so Postgres read the ordered column
-- as a grouping column and refused with SQLSTATE 42803. Every list is now an
-- inner subquery that orders and limits, wrapped in an aggregate that orders
-- again, so the shape is uniform across the whole function.
-- 20261070000000 is corrected as well so a fresh database is created right.

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
