-- Keep submission source, grading results, and review events private to each
-- student and to the primary administrator or an explicitly appointed grader.
-- PostgreSQL combines permissive policies with OR, so replace every historical
-- teacher read policy rather than only tightening the latest policy name.

alter table public.academy_submissions enable row level security;
alter table public.academy_submission_results enable row level security;
alter table public.academy_submission_events enable row level security;

drop policy if exists academy_submissions_self
  on public.academy_submissions;
drop policy if exists academy_submissions_teacher
  on public.academy_submissions;
drop policy if exists academy_submissions_student_self_read
  on public.academy_submissions;
create policy academy_submissions_student_self_read
  on public.academy_submissions
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.academy_can_grade()
  );

drop policy if exists academy_submission_results_self
  on public.academy_submission_results;
drop policy if exists academy_submission_results_self_read
  on public.academy_submission_results;
drop policy if exists academy_submission_results_student_read
  on public.academy_submission_results;
drop policy if exists academy_submission_results_teacher
  on public.academy_submission_results;
drop policy if exists academy_submission_results_teacher_read
  on public.academy_submission_results;
create policy academy_submission_results_student_read
  on public.academy_submission_results
  for select to authenticated
  using (
    student_id = auth.uid()
    or public.academy_can_grade()
  );

drop policy if exists academy_submission_events_student_read
  on public.academy_submission_events;
create policy academy_submission_events_student_read
  on public.academy_submission_events
  for select to authenticated
  using (
    public.academy_can_grade()
    or exists (
      select 1
      from public.academy_submissions s
      where s.id = submission_id
        and s.student_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
