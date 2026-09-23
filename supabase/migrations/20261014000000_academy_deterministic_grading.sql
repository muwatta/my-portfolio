-- Deterministic grading job state and auditable executor results.

alter table public.academy_submissions
  drop constraint if exists academy_submissions_status_check;

alter table public.academy_submissions
  add constraint academy_submissions_status_check
  check (status in ('submitted', 'grading', 'graded', 'returned', 'needs_review', 'grading_failed', 'grading_unavailable'));

alter table public.academy_submissions
  add column if not exists grading_error text,
  add column if not exists grading_attempted_at timestamptz;

alter table public.academy_submission_results
  add column if not exists executor_name text,
  add column if not exists executor_version text;

create or replace function public.academy_set_grading_state(
  target_submission_id uuid,
  target_status text,
  target_error text default null
)
returns public.academy_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  submission_row public.academy_submissions;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  if not exists (
    select 1 from public.academy_submissions s
    where s.id = target_submission_id
      and (s.student_id = auth.uid() or public.academy_is_teacher() or public.academy_is_admin())
  ) then
    raise exception 'Submission access denied.';
  end if;
  update public.academy_submissions
  set status = target_status,
      grading_error = target_error,
      grading_attempted_at = now()
  where id = target_submission_id
  returning * into submission_row;
  return submission_row;
end;
$$;

revoke execute on function public.academy_set_grading_state(uuid, text, text) from public, anon;
grant execute on function public.academy_set_grading_state(uuid, text, text) to authenticated;

-- The service-side grading function uses the service role to persist the
-- executor result; browser clients can only request state transitions.

create or replace function public.academy_grade_submission(
  target_submission_id uuid,
  target_objective_score numeric,
  target_final_score numeric,
  target_teacher_feedback text,
  target_ai_feedback text,
  target_ai_feedback_status text
)
returns public.academy_submission_results
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.academy_submission_results;
  submission_row public.academy_submissions;
  authoritative_objective numeric;
begin
  if not public.academy_is_teacher() and not public.academy_is_admin() then
    raise exception 'Only teachers and admins can grade submissions.';
  end if;
  select * into submission_row from public.academy_submissions where id = target_submission_id;
  if submission_row.id is null then raise exception 'Submission not found.'; end if;

  select objective_score into authoritative_objective
  from public.academy_submission_results
  where submission_id = target_submission_id;
  authoritative_objective := coalesce(authoritative_objective, target_objective_score);

  insert into public.academy_submission_results (
    submission_id, assignment_id, student_id, objective_score, objective_status,
    final_score, score, max_score, teacher_score, teacher_feedback, ai_feedback, ai_feedback_status
  ) values (
    submission_row.id, submission_row.assignment_id, submission_row.student_id,
    authoritative_objective,
    case when authoritative_objective >= 70 then 'passed'
         when authoritative_objective > 0 then 'partial'
         else 'failed' end,
    target_final_score, target_final_score, 100, target_final_score,
    target_teacher_feedback,
    case when target_ai_feedback is null then null else to_jsonb(target_ai_feedback) end,
    target_ai_feedback_status
  ) on conflict (submission_id) do update set
    final_score = excluded.final_score,
    score = excluded.score,
    teacher_score = excluded.teacher_score,
    teacher_feedback = excluded.teacher_feedback,
    ai_feedback = excluded.ai_feedback,
    ai_feedback_status = excluded.ai_feedback_status,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  returning * into result_row;

  update public.academy_submissions set status = 'graded' where id = submission_row.id;
  insert into public.academy_submission_events (submission_id, event_type, payload)
  values (
    submission_row.id,
    'teacher_reviewed',
    jsonb_build_object('final_score', target_final_score, 'objective_score', authoritative_objective)
  );
  return result_row;
end;
$$;
