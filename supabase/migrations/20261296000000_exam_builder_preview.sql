-- Let a teacher see the questions in an exam, with the answer key.
--
-- The link table is closed to everyone but staff, so this is the only way in,
-- and it is deliberately staff only: a teacher needs the key to check a paper,
-- a student must never see it before results are published.
create or replace function public.academy_exam_paper_preview(p_exam_id uuid)
returns table (
  question_id uuid,
  question_position integer,
  prompt text,
  options jsonb,
  correct_key text,
  marks numeric,
  question_type text,
  difficulty text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.academy_is_teacher() then
    raise exception 'Only teachers can see the questions in an examination.'
      using errcode = '42501';
  end if;

  return query
  select
    link.question_id,
    link.position,
    link.snapshot ->> 'prompt',
    link.snapshot -> 'options',
    link.snapshot ->> 'correct_key',
    link.marks,
    link.snapshot ->> 'question_type',
    link.snapshot ->> 'difficulty'
  from public.academy_exam_question_links link
  where link.exam_id = p_exam_id
  order by link.position;
end;
$$;

revoke execute on function public.academy_exam_paper_preview(uuid) from public, anon;
grant execute on function public.academy_exam_paper_preview(uuid) to authenticated;

notify pgrst, 'reload schema';
