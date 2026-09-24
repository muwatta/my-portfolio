alter table public.academy_submissions
  add column if not exists client_operation_id text;

drop index if exists public.academy_submissions_client_operation_id_idx;
create unique index if not exists academy_submissions_client_operation_id_idx
  on public.academy_submissions (student_id, client_operation_id)
  where client_operation_id is not null;

alter table public.academy_exercise_attempts
  add column if not exists client_operation_id text;

drop index if exists public.academy_exercise_attempts_client_operation_id_idx;
create unique index if not exists academy_exercise_attempts_client_operation_id_idx
  on public.academy_exercise_attempts (student_id, client_operation_id)
  where client_operation_id is not null;

create or replace function public.academy_submit_objective_answer(
  target_exercise_id uuid,
  submitted_answer text,
  client_operation_key text default null
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
  if client_operation_key is not null then
    select * into attempt_row
    from public.academy_exercise_attempts
    where exercise_id = target_exercise_id
      and student_id = auth.uid()
      and client_operation_id = client_operation_key;
    if attempt_row.id is not null then
      return attempt_row;
    end if;
  end if;

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
    (exercise_id, student_id, code, passed, total, score, max_score, status, client_operation_id)
  values
    (target_exercise_id, auth.uid(), left(coalesce(submitted_answer, ''), 10000),
     case when is_correct then 1 else 0 end, 1,
     case when is_correct then 1 else 0 end, 1, 'graded', client_operation_key)
  returning * into attempt_row;

  return attempt_row;
end;
$$;

revoke execute on function public.academy_submit_objective_answer(uuid, text, text) from public, anon;
grant execute on function public.academy_submit_objective_answer(uuid, text, text) to authenticated;
