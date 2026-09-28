-- Phase 4 correction.
--
-- academy_record_client_run was applied with objective_status values
-- 'unverified_pass', 'unverified_partial' and 'unverified_failed'. The existing
-- check constraint on objective_status only allows passed, partial, failed,
-- pending and manual_review, so the function applied cleanly and then failed on
-- every first submission with SQLSTATE 23514.
--
-- manual_review is the value that already means exactly this: the server did
-- not verify the run and a human has to look at it. The pass and total counts
-- stay in test_summary rather than widening the enum. 20261060000000 is
-- corrected as well so a fresh database is created right.

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

notify pgrst, 'reload schema';
