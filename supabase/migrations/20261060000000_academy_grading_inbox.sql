-- Phase 4: submissions, a single grading queue, and a review gate.
--
-- Three things this adds.
--
-- 1. A review state on the result row, so a grade is never the same thing as a
--    published grade. A teacher marks a submission reviewed, then publishes it,
--    and only then does the student see a mark. That is the gate the brief asks
--    for, and it means a half finished review is never visible.
--
-- 2. One grading queue instead of a flat submissions table, filterable by
--    course, topic and student, with the attempt number and the student's name
--    already joined in.
--
-- 3. An honest place to record tests that ran in the student's browser. Code
--    runs in the browser worker, so a student could report any score they liked.
--    Those results are stored as unverified hints for the teacher and never
--    counted as an authoritative score. Real auto marking still needs the
--    server side executor, which is not configured on this project.

alter table public.academy_submission_results
  add column if not exists review_state text not null default 'unreviewed';

alter table public.academy_submission_results
  add constraint academy_submission_results_review_state_check
  check (review_state in ('unreviewed', 'in_review', 'reviewed', 'published'));

alter table public.academy_submission_results
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references auth.users(id) on delete set null;

create index if not exists academy_submission_results_review_queue_idx
  on public.academy_submission_results (review_state, updated_at desc);

-- The queue. Returns one row per submission awaiting attention, newest first,
-- with everything the grading screen needs and nothing it does not.

create or replace function public.academy_grading_queue(
  p_course_id uuid default null,
  p_topic_id uuid default null,
  p_student_id uuid default null,
  p_review_state text default null
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

  -- One JSON object per submission rather than a wide table return. A RETURNS
  -- TABLE function must match every column type exactly, and one wrong type
  -- makes the whole queue fail to call with SQLSTATE 42804, which is how the
  -- first version of this function behaved. jsonb keeps the shape flexible as
  -- the queue grows, and matches academy_student_home.
  return query
  select jsonb_build_object(
    'submission_id', s.id,
    'assignment_id', s.assignment_id,
    'assignment_title', a.title,
    'lesson_id', a.lesson_id,
    'lesson_title', l.title,
    'course_id', coalesce(a.course_id, w.course_id),
    'course_title', c.title,
    'student_id', s.student_id,
    'student_name', coalesce(
      nullif(btrim(p.display_name), ''),
      split_part(coalesce(u.email, ''), '@', 1),
      'Student'
    ),
    'student_email', u.email,
    'attempt_number', s.attempt_number,
    'submission_status', s.status,
    'submitted_at', s.submitted_at,
    'source_code', s.source_code,
    'original_filename', s.original_filename,
    'file_size_bytes', s.file_size_bytes,
    'grading_error', s.grading_error,
    'objective_score', r.objective_score,
    'objective_status', r.objective_status,
    'client_ran_tests', r.deterministic_source = 'client_reported',
    'client_passed', case
      when r.deterministic_source = 'client_reported' and r.test_summary is not null
        then (r.test_summary ->> 'passed')::integer
      else null
    end,
    'client_total', case
      when r.deterministic_source = 'client_reported' and r.test_summary is not null
        then (r.test_summary ->> 'total')::integer
      else null
    end,
    'teacher_score', r.teacher_score,
    'final_score', r.final_score,
    'max_score', coalesce(nullif(r.max_score, 0), a.points, 100),
    'rubric', a.rubric,
    'teacher_feedback', r.teacher_feedback,
    'rubric_feedback', r.rubric_feedback,
    'ai_feedback_status', r.ai_feedback_status,
    'review_state', coalesce(r.review_state, 'unreviewed'),
    'updated_at', greatest(coalesce(r.updated_at, r.created_at), s.submitted_at)
  )
  from public.academy_submissions s
  join public.academy_assignments a on a.id = s.assignment_id
  left join public.academy_lessons l on l.id = a.lesson_id
  left join public.academy_weeks w on w.id = l.week_id
  left join public.academy_courses c on c.id = coalesce(a.course_id, w.course_id)
  left join public.academy_submission_results r on r.submission_id = s.id
  left join public.academy_profiles p on p.id = s.student_id
  left join auth.users u on u.id = s.student_id
  where (p_course_id is null or coalesce(a.course_id, w.course_id) = p_course_id)
    and (p_topic_id is null or a.lesson_id = p_topic_id)
    and (p_student_id is null or s.student_id = p_student_id)
    and (
      p_review_state is null
      or coalesce(r.review_state, 'unreviewed') = p_review_state
    )
  order by greatest(coalesce(r.updated_at, r.created_at), s.submitted_at) desc;
end;
$$;

-- Record tests the student ran in their own browser. Deliberately labelled
-- client_reported and never used as an authoritative score.

create or replace function public.academy_record_client_run(
  p_assignment_id uuid,
  p_source_code text,
  p_passed integer,
  p_total integer,
  p_failed_names text[] default '{}',
  p_client_operation_id text default null,
  p_max_score numeric default null
)
returns public.academy_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  student uuid := auth.uid();
  created public.academy_submissions;
  next_attempt integer;
begin
  if student is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  if p_total is null or p_total <= 0 then
    raise exception 'A run needs at least one test.' using errcode = '22023';
  end if;
  if p_passed is null or p_passed < 0 or p_passed > p_total then
    raise exception 'Passed count must be between zero and the total.' using errcode = '22023';
  end if;

  if p_client_operation_id is not null then
    select * into created
      from public.academy_submissions
     where student_id = student
       and client_operation_id = p_client_operation_id;
    if created.id is not null then
      return created;
    end if;
  end if;

  select coalesce(max(attempt_number), 0) + 1 into next_attempt
    from public.academy_submissions
   where assignment_id = p_assignment_id
     and student_id = student;

  insert into public.academy_submissions (
    assignment_id, student_id, attempt_number, source_code,
    status, client_operation_id
  )
  values (
    p_assignment_id, student, next_attempt, p_source_code,
    'submitted', p_client_operation_id
  )
  returning * into created;

  insert into public.academy_submission_results (
    submission_id, assignment_id, student_id,
    objective_score, objective_status, score, max_score,
    tests_passed, tests_total, passed_tests, failed_tests,
    test_summary, deterministic_feedback, deterministic_source, review_state
  )
  values (
    created.id,
    created.assignment_id,
    student,
    -- A hint for the teacher only. Not authoritative, and never published as a
    -- student mark without a teacher pressing publish.
    round(100.0 * p_passed / p_total, 2),
    -- manual_review is the existing enum value for exactly this case: the
    -- server did not verify the run, so a human has to look at it. The passed
    -- and total counts live in test_summary rather than inventing new statuses.
    'manual_review',
    round(100.0 * p_passed / p_total, 2),
    coalesce(p_max_score, 100),
    p_passed, p_total, p_passed, p_total,
    jsonb_build_object('passed', p_passed, 'total', p_total, 'source', 'browser'),
    jsonb_build_object(
      'note', 'Run in the student browser and not verified by the server.',
      'failed', to_jsonb(coalesce(p_failed_names, '{}'::text[]))
    ),
    'client_reported',
    'unreviewed'
  )
  on conflict (submission_id) do update
    set objective_score = excluded.objective_score,
        objective_status = excluded.objective_status,
        tests_passed = excluded.tests_passed,
        tests_total = excluded.tests_total,
        passed_tests = excluded.passed_tests,
        failed_tests = excluded.failed_tests,
        test_summary = excluded.test_summary,
        deterministic_feedback = excluded.deterministic_feedback,
        deterministic_source = 'client_reported',
        updated_at = now();

  insert into public.academy_submission_events (submission_id, event_type, payload)
  values (
    created.id,
    'tests_run',
    jsonb_build_object(
      'passed', p_passed,
      'total', p_total,
      'source', 'browser',
      'verified', false
    )
  );

  return created;
end;
$$;

-- Mark a submission reviewed: rubric, written feedback, and the mark. This does
-- not tell the student anything yet.

create or replace function public.academy_review_submission(
  p_submission_id uuid,
  p_teacher_score numeric,
  p_teacher_feedback text default null,
  p_rubric_feedback jsonb default null
)
returns public.academy_submission_results
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_points numeric;
  saved public.academy_submission_results;
begin
  if not public.academy_is_teacher() then
    raise exception 'Teacher access required.' using errcode = '42501';
  end if;

  select coalesce(points, 100) into assignment_points
    from public.academy_assignments
   where id = (select assignment_id from public.academy_submissions where id = p_submission_id);

  if assignment_points is null then
    raise exception 'Submission not found.' using errcode = 'P0002';
  end if;
  if p_teacher_score is null or p_teacher_score < 0 or p_teacher_score > assignment_points then
    raise exception 'The mark must be between 0 and %.', assignment_points using errcode = '22023';
  end if;

  insert into public.academy_submission_results (
    submission_id, assignment_id, student_id,
    teacher_score, final_score, score, max_score,
    teacher_feedback, rubric_feedback,
    reviewed_at, reviewed_by, review_state
  )
  select s.id, s.assignment_id, s.student_id,
         p_teacher_score, p_teacher_score, p_teacher_score, assignment_points,
         nullif(btrim(coalesce(p_teacher_feedback, '')), ''), p_rubric_feedback,
         now(), auth.uid(), 'reviewed'
    from public.academy_submissions s
   where s.id = p_submission_id
  on conflict (submission_id) do update
    set teacher_score = excluded.teacher_score,
        final_score = excluded.final_score,
        score = excluded.score,
        max_score = excluded.max_score,
        teacher_feedback = excluded.teacher_feedback,
        rubric_feedback = excluded.rubric_feedback,
        reviewed_at = now(),
        reviewed_by = auth.uid(),
        review_state = 'reviewed',
        updated_at = now()
  returning * into saved;

  insert into public.academy_submission_events (submission_id, event_type, payload)
  values (
    p_submission_id,
    'teacher_reviewed',
    jsonb_build_object('score', p_teacher_score, 'max', assignment_points)
  );

  return saved;
end;
$$;

-- Publish a reviewed mark. Only this makes it visible to the student.

create or replace function public.academy_publish_result(p_submission_id uuid)
returns public.academy_submission_results
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.academy_submission_results;
  student uuid;
  assignment_title text;
  scored numeric;
  maximum numeric;
  found_row boolean := false;
begin
  if not public.academy_is_teacher() then
    raise exception 'Teacher access required.' using errcode = '42501';
  end if;

  select r.student_id, r.final_score, r.max_score, a.title
    into student, scored, maximum, assignment_title
    from public.academy_submission_results r
    join public.academy_submissions s on s.id = r.submission_id
    join public.academy_assignments a on a.id = s.assignment_id
   where r.submission_id = p_submission_id
     for update of r;

  found_row := student is not null;
  if not found_row then
    raise exception 'Submission not found.' using errcode = 'P0002';
  end if;

  -- Refuse to publish a grade that was never reviewed, so nothing reaches a
  -- student by accident.
  if not exists (
    select 1 from public.academy_submission_results
     where submission_id = p_submission_id and review_state in ('reviewed', 'published')
  ) then
    raise exception 'Review this submission before publishing it.' using errcode = '22023';
  end if;

  update public.academy_submission_results
     set review_state = 'published',
         published_at = now(),
         published_by = auth.uid(),
         updated_at = now()
   where submission_id = p_submission_id
  returning * into saved;

  update public.academy_submissions
     set status = 'graded'
   where id = p_submission_id;

  insert into public.academy_submission_events (submission_id, event_type, payload)
  values (p_submission_id, 'scored', jsonb_build_object('published', true, 'score', scored));

  insert into public.academy_notifications (user_id, type, title, message)
  values (
    student,
    'feedback',
    'Your mark for ' || assignment_title,
    'You scored ' || coalesce(scored::text, 'a mark') ||
      ' out of ' || coalesce(maximum::text, 'the maximum') || '. Open the task to read the feedback.'
  );

  return saved;
end;
$$;

revoke execute on function public.academy_grading_queue(uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.academy_record_client_run(uuid, text, integer, integer, text[], text, numeric) from public, anon;
revoke execute on function public.academy_review_submission(uuid, numeric, text, jsonb) from public, anon;
revoke execute on function public.academy_publish_result(uuid) from public, anon;
grant execute on function public.academy_grading_queue(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.academy_record_client_run(uuid, text, integer, integer, text[], text, numeric) to authenticated;
grant execute on function public.academy_review_submission(uuid, numeric, text, jsonb) to authenticated;
grant execute on function public.academy_publish_result(uuid) to authenticated;

notify pgrst, 'reload schema';
