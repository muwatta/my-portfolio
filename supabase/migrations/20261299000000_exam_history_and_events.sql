-- Students could see a result only while sitting the paper, because the runner
-- is the only thing that called academy_exam_student_result. Once the tab was
-- closed a finished attempt was unreachable: a student could not look up an
-- exam they had already sat, or a released score from last week. This returns
-- their own history in one call.
--
-- The publication rule is applied here, in the same place and the same way as
-- academy_exam_student_result, rather than by the client asking for each attempt
-- and being trusted to hide the numbers it did not want. An unreleased attempt
-- comes back with the score columns null.
create or replace function public.academy_exam_student_history()
returns table (
  attempt_id uuid,
  exam_id uuid,
  exam_title text,
  attempt_number integer,
  started_at timestamptz,
  submitted_at timestamptz,
  submit_reason text,
  status text,
  results_published boolean,
  score numeric,
  total_marks numeric,
  percentage numeric,
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  pass_mark numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.exam_id,
    e.title,
    a.attempt_number,
    a.started_at,
    a.submitted_at,
    a.submit_reason,
    a.status,
    coalesce(e.results_published, false),
    case when e.results_published then a.score end,
    case when e.results_published then a.total_marks end,
    case when e.results_published then a.percentage end,
    case when e.results_published then a.correct_count end,
    case when e.results_published then a.incorrect_count end,
    case when e.results_published then a.unanswered_count end,
    e.pass_mark
  from public.academy_exam_attempts a
  join public.academy_exams e on e.id = a.exam_id
  where a.student_id = auth.uid()
  order by a.started_at desc;
$$;

revoke execute on function public.academy_exam_student_history() from public, anon;
grant execute on function public.academy_exam_student_history() to authenticated;

-- The audit trail behind a disputed mark exists and has never been readable.
-- staff only, and it is read-only: the table is written by the engine functions.
create or replace function public.academy_exam_event_log(p_exam_id uuid, p_limit integer default 100)
returns table (
  id uuid,
  action text,
  attempt_id uuid,
  student_id uuid,
  metadata jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select ev.id, ev.action, ev.attempt_id, ev.student_id, ev.metadata, ev.created_at
  from public.academy_exam_events ev
  where ev.exam_id = p_exam_id
    and public.academy_is_teacher()
  order by ev.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke execute on function public.academy_exam_event_log(uuid, integer) from public, anon;
grant execute on function public.academy_exam_event_log(uuid, integer) to authenticated;
