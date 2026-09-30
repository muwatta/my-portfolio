-- Three production faults, all of the same kind, all found by driving the live
-- database rather than by a test with a mocked client:
--
-- 1. The question bank could not be used at all. RLS allowed teachers, but the
--    table privilege had been revoked and never granted back. A policy does not
--    grant access on its own; a role needs both. Every list, create, edit and
--    archive call in the admin question bank failed with permission denied.
--
-- 2. The teacher mark sheet could not read the scores it exists to show. The
--    score columns are deliberately not in the student column grant on
--    academy_exam_attempts, so the teacher's select of them was refused.
--
-- 3. The per-attempt Review panel could not read is_correct or marks_awarded,
--    for the same reason on academy_exam_answers.
--
-- The tempting fix for 2 and 3 is to grant the missing columns to authenticated,
-- and that must not be done: a student may read their own attempt row, so
-- granting score, percentage or is_correct would hand every student their own
-- result before a teacher released it. That is the guarantee the column grants
-- exist to protect. So staff read the marked-up data through functions that
-- check academy_is_teacher() and are revoked from anon, and the column grants
-- stay exactly as they were.

grant select, insert, update, delete
  on public.academy_exam_questions to authenticated;

-- The mark sheet, with the student's name resolved in the same query. Previously
-- this was a table select plus a second query for names, because
-- academy_exam_attempts.student_id and academy_profiles.id both point at
-- auth.users rather than at each other and PostgREST has nothing to embed.
create or replace function public.academy_exam_attempt_sheet(p_exam_id uuid)
returns table (
  attempt_id uuid,
  student_id uuid,
  student_name text,
  attempt_number integer,
  started_at timestamptz,
  deadline_at timestamptz,
  submitted_at timestamptz,
  submit_reason text,
  client_submitted_at timestamptz,
  status text,
  score numeric,
  total_marks numeric,
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  percentage numeric,
  graded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.student_id,
    coalesce(nullif(pr.display_name, ''), 'Unknown student'),
    a.attempt_number,
    a.started_at,
    a.deadline_at,
    a.submitted_at,
    a.submit_reason,
    a.client_submitted_at,
    a.status,
    a.score,
    a.total_marks,
    a.correct_count,
    a.incorrect_count,
    a.unanswered_count,
    a.percentage,
    a.graded_at
  from public.academy_exam_attempts a
  left join public.academy_profiles pr on pr.id = a.student_id
  where a.exam_id = p_exam_id
    and public.academy_is_teacher()
  order by a.percentage desc nulls last, a.started_at;
$$;

revoke execute on function public.academy_exam_attempt_sheet(uuid) from public, anon;
grant execute on function public.academy_exam_attempt_sheet(uuid) to authenticated;

-- What one student chose, marked. Deliberately carries no correct_key: a teacher
-- reviewing a disputed answer needs to see the marking, and the key is already on
-- the paper in the builder's preview, so nothing is lost by leaving it out here.
create or replace function public.academy_exam_paper_review(p_attempt_id uuid)
returns table (
  answer_id uuid,
  question_id uuid,
  selected_key text,
  is_correct boolean,
  marks_awarded numeric,
  client_answered_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.question_id,
    a.selected_key,
    a.is_correct,
    a.marks_awarded,
    a.client_answered_at
  from public.academy_exam_answers a
  join public.academy_exam_attempts t on t.id = a.attempt_id
  where a.attempt_id = p_attempt_id
    and public.academy_is_teacher()
  order by a.question_id;
$$;

revoke execute on function public.academy_exam_paper_review(uuid) from public, anon;
grant execute on function public.academy_exam_paper_review(uuid) to authenticated;
