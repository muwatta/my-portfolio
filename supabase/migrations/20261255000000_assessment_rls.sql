-- Assessment engine: access control.
--
-- Without this, a signed in student could read the answer key straight out of
-- academy_exam_question_links, because the snapshot column carries correct_key.
-- Verified: a student read both keys before this migration existed. The paper
-- function was already safe, but the table underneath it was not, and one
-- readable table is enough to lose the whole paper.
--
-- Two layers, because one is not enough here. RLS decides which rows a student
-- may see at all, and column grants decide which columns. The key is protected
-- twice: the question bank and the link table are unreadable to students
-- entirely, and the answer table withholds is_correct and marks_awarded at the
-- column level so a student cannot see a mark before results are published.

alter table public.academy_exam_questions enable row level security;
alter table public.academy_exam_question_links enable row level security;
alter table public.academy_exams enable row level security;
alter table public.academy_exam_attempts enable row level security;
alter table public.academy_exam_answers enable row level security;
alter table public.academy_exam_events enable row level security;

-- ------------------------------------------------------- question bank: staff
-- Holds correct_key, so students get nothing from it. They reach questions only
-- through academy_exam_paper, which selects the safe columns itself.
drop policy if exists academy_exam_questions_staff on public.academy_exam_questions;
create policy academy_exam_questions_staff
  on public.academy_exam_questions
  for all to authenticated
  using (public.academy_is_teacher())
  with check (public.academy_is_teacher());

-- The snapshot holds correct_key, so this table is staff only as well. This is
-- the table that leaked the key before this migration.
drop policy if exists academy_exam_links_staff on public.academy_exam_question_links;
create policy academy_exam_links_staff
  on public.academy_exam_question_links
  for all to authenticated
  using (public.academy_is_teacher())
  with check (public.academy_is_teacher());

-- ------------------------------------------------------------------ the exam
-- A student may see that an exam exists for their class, which is what lets the
-- runner say "has not started" rather than "not found". They see no scores and
-- no question content from here.
drop policy if exists academy_exams_staff on public.academy_exams;
create policy academy_exams_staff
  on public.academy_exams
  for all to authenticated
  using (public.academy_is_teacher())
  with check (public.academy_is_teacher());

drop policy if exists academy_exams_student_read on public.academy_exams;
create policy academy_exams_student_read
  on public.academy_exams
  for select to authenticated
  using (
    public.academy_is_teacher()
    or (class_id is not null and public.academy_is_class_member(class_id))
  );

-- ------------------------------------------------------------------ attempts
drop policy if exists academy_exam_attempts_staff on public.academy_exam_attempts;
create policy academy_exam_attempts_staff
  on public.academy_exam_attempts
  for all to authenticated
  using (public.academy_is_teacher())
  with check (public.academy_is_teacher());

drop policy if exists academy_exam_attempts_own on public.academy_exam_attempts;
create policy academy_exam_attempts_own
  on public.academy_exam_attempts
  for select to authenticated
  using (student_id = auth.uid());

-- Deliberately no insert or update policy for students. An attempt is only ever
-- created by academy_exam_start_attempt, which computes the deadline, so a
-- student cannot mint an attempt with a deadline of next year.

-- ------------------------------------------------------------------- answers
drop policy if exists academy_exam_answers_staff on public.academy_exam_answers;
create policy academy_exam_answers_staff
  on public.academy_exam_answers
  for all to authenticated
  using (public.academy_is_teacher())
  with check (public.academy_is_teacher());

drop policy if exists academy_exam_answers_own on public.academy_exam_answers;
-- The answer row has no student_id of its own; ownership comes from the attempt.
create policy academy_exam_answers_own
  on public.academy_exam_answers
  for select to authenticated
  using (
    exists (
      select 1 from public.academy_exam_attempts a
      where a.id = attempt_id and a.student_id = auth.uid()
    )
  );

-- Students write nothing here either. Answer saving goes through
-- academy_exam_save_answer, so the option must be a real one and the deadline
-- must still be open when the answer lands.

-- ------------------------------------------------------------------- events
drop policy if exists academy_exam_events_staff on public.academy_exam_events;
create policy academy_exam_events_staff
  on public.academy_exam_events
  for select to authenticated
  using (public.academy_is_teacher());

-- Events are written by the engine functions only.

-- ------------------------------------------------------------- column grants
-- is_correct and marks_awarded are the whole of section 12. Withholding them at
-- the column level means a student's own answer rows cannot show a mark even
-- though RLS lets them read the row. The grading functions are security
-- definer, so they still see both columns.
revoke select on public.academy_exam_answers from anon, authenticated;
grant select (
  id, attempt_id, question_id, selected_key, client_answered_at, updated_at
) on public.academy_exam_answers to authenticated;

-- The graded totals on an attempt are the other half of section 12. A student
-- may read their own attempt to know it exists and when it was submitted, but
-- not the score, so those columns are withheld too.
revoke select on public.academy_exam_attempts from anon, authenticated;
grant select (
  id, exam_id, student_id, attempt_number, started_at, deadline_at,
  submitted_at, submit_reason, client_submitted_at, status
) on public.academy_exam_attempts to authenticated;

revoke select on public.academy_exam_questions from anon, authenticated;
revoke select on public.academy_exam_question_links from anon, authenticated;
revoke all on public.academy_exam_events from anon, authenticated;
grant select on public.academy_exam_events to authenticated;

-- The student facing reads go through academy_exam_student_result, which
-- returns nothing at all while results_published is false.

notify pgrst, 'reload schema';
