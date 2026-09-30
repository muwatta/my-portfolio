-- Rewrite academy_exam_paper.
--
-- The previous version raised "column reference question_id is ambiguous" on
-- every call, because its lateral subquery shadowed columns the outer query was
-- already using. The paper could not be loaded at all.
--
-- Simpler now: the order is computed in one CTE from the attempt seed, with the
-- stored position as a tiebreak so two questions can never swap places between
-- reloads, and no lateral join is involved.
--
-- The correct answer is still not in the select list, and the explanation is
-- still stripped, because this is the only function a student's browser reads.

create or replace function public.academy_exam_paper(p_attempt_id uuid)
returns table (
  question_id uuid,
  question_position integer,
  prompt text,
  options jsonb,
  marks numeric,
  is_answered boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  attempt_row public.academy_exam_attempts%rowtype;
  exam_row public.academy_exams%rowtype;
begin
  select * into attempt_row from public.academy_exam_attempts where id = p_attempt_id;
  if attempt_row.id is null then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;
  if attempt_row.student_id <> auth.uid() and not public.academy_is_teacher() then
    raise exception 'That attempt is not yours.' using errcode = '42501';
  end if;
  if attempt_row.status <> 'in_progress' then
    raise exception 'This attempt is already submitted.' using errcode = '42501';
  end if;
  if now() > attempt_row.deadline_at then
    raise exception 'Time is up for this attempt.' using errcode = '22023';
  end if;

  select * into exam_row from public.academy_exams where id = attempt_row.exam_id;

  return query
  with base as (
    select
      link.question_id,
      link.position as seq,
      link.marks,
      link.snapshot,
      case
        when exam_row.randomize_questions
          then abs(hashtextextended(link.question_id::text || attempt_row.random_seed::text, 0))
        else link.position
      end as rank
    from public.academy_exam_question_links link
    where link.exam_id = attempt_row.exam_id
  )
  select
    b.question_id,
    (row_number() over (order by b.rank, b.seq))::integer,
    b.snapshot ->> 'prompt',
    case
      when exam_row.randomize_options then
        (select jsonb_agg(elem order by
           abs(hashtextextended(
             (elem ->> 'key') || attempt_row.random_seed::text || b.question_id::text, 0)))
         from jsonb_array_elements(b.snapshot -> 'options') elem)
      else b.snapshot -> 'options'
    end,
    b.marks,
    exists (
      select 1 from public.academy_exam_answers a
      where a.attempt_id = p_attempt_id and a.question_id = b.question_id
    )
  from base b
  order by b.rank, b.seq;
end;
$$;

revoke execute on function public.academy_exam_paper(uuid) from public, anon;
grant execute on function public.academy_exam_paper(uuid) to authenticated;

notify pgrst, 'reload schema';
