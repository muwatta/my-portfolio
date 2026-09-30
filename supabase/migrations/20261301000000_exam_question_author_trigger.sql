-- The fourth fault in the same family. academy_exam_questions.created_by is
-- not null, and no trigger stamped it, while saveAcademyExamQuestion never sent
-- it. So even with the table privilege restored, creating a question from the
-- admin question bank failed on the not null constraint. The bank could not be
-- written to by the application at all.
--
-- The stamp is forced rather than merely filled in, so a teacher cannot file a
-- question under somebody else's name. Forcing it on insert does not affect
-- editing, because the policy stays as it is: a WITH CHECK of
-- created_by = auth.uid() would have broken a teacher editing another teacher's
-- question, which the staff policy deliberately allows.
--
-- auth.uid() is null for a service role caller, which is how fixtures are seeded,
-- so an explicitly supplied author is respected in that case and only a genuinely
-- absent one is refused.
create or replace function public.academy_exam_question_stamp_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  if new.created_by is null then
    raise exception 'An author is required to add a question.'
      using errcode = '23502';
  end if;
  return new;
end;
$$;

drop trigger if exists academy_exam_questions_stamp_author
  on public.academy_exam_questions;
create trigger academy_exam_questions_stamp_author
  before insert on public.academy_exam_questions
  for each row execute function public.academy_exam_question_stamp_author();
