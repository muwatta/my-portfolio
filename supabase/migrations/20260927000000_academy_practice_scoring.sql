-- Objective practice scoring owned by the database.
alter table public.academy_exercises
  add column if not exists question_type text not null default 'programming'
    check (question_type in ('multiple_choice', 'true_false', 'short_answer', 'programming')),
  add column if not exists choices jsonb not null default '[]'::jsonb,
  add column if not exists correct_answer text,
  add column if not exists attempt_limit smallint not null default 3
    check (attempt_limit >= 0);

alter table public.academy_exercise_attempts
  add column if not exists score numeric(5, 2) not null default 0
    check (score >= 0),
  add column if not exists max_score numeric(5, 2) not null default 1
    check (max_score > 0),
  add column if not exists status text not null default 'graded'
    check (status in ('graded', 'rejected'));

-- Hidden answers and tests must never be selectable by browser clients.
revoke select on public.academy_exercises from anon, authenticated;
grant select (
  id, lesson_id, title, instructions, starter_code, difficulty,
  expected_concepts, hints, explanation, question_type, choices, attempt_limit
) on public.academy_exercises to authenticated;

revoke insert, update, delete on public.academy_exercise_attempts from authenticated;
grant select on public.academy_exercise_attempts to authenticated;

drop policy if exists academy_exercise_attempts_self on public.academy_exercise_attempts;
create policy academy_exercise_attempts_self_read on public.academy_exercise_attempts
  for select to authenticated using (student_id = auth.uid());

create or replace function public.academy_submit_objective_answer(
  target_exercise_id uuid,
  submitted_answer text
)
returns public.academy_exercise_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  exercise_row public.academy_exercises;
  attempt_count integer;
  is_correct boolean;
  attempt_row public.academy_exercise_attempts;
begin
  select * into exercise_row
  from public.academy_exercises
  where id = target_exercise_id;

  if exercise_row.id is null then
    raise exception 'Exercise not found';
  end if;
  if exercise_row.question_type = 'programming' then
    raise exception 'Programming exercises require the isolated grader';
  end if;

  select count(*) into attempt_count
  from public.academy_exercise_attempts
  where exercise_id = target_exercise_id and student_id = auth.uid();
  if attempt_count >= exercise_row.attempt_limit then
    raise exception 'Attempt limit reached';
  end if;

  is_correct := lower(trim(coalesce(submitted_answer, ''))) = lower(trim(coalesce(exercise_row.correct_answer, '')));

  insert into public.academy_exercise_attempts
    (exercise_id, student_id, code, passed, total, score, max_score, status)
  values
    (target_exercise_id, auth.uid(), left(coalesce(submitted_answer, ''), 10000),
     case when is_correct then 1 else 0 end, 1,
     case when is_correct then 1 else 0 end, 1, 'graded')
  returning * into attempt_row;

  return attempt_row;
end;
$$;

revoke execute on function public.academy_submit_objective_answer(uuid, text) from public, anon;
grant execute on function public.academy_submit_objective_answer(uuid, text) to authenticated;
