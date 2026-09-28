-- Close three correctness gaps in objective question grading.
--
-- academy_submit_objective_answer already grades server side as a security
-- definer, and students cannot insert or update academy_exercise_attempts
-- directly, so a mark cannot be forged. These are correctness and access gaps,
-- not forgery gaps.
--
-- 1. No access check. The function took any exercise id and graded it. A
--    student who learned an exercise uuid could be graded on, and earn points
--    for, a topic whose prerequisites they had not reached, which is exactly
--    what the prerequisite system exists to prevent. This reuses
--    academy_lesson_is_unlocked_for_student, which already handles active
--    enrolment, prerequisites, and the staff bypass.
--
-- 2. An empty answer could be marked correct. The comparison is
--      lower(trim(coalesce(submitted, ''))) = lower(trim(coalesce(correct, '')))
--    so an exercise with a null or blank correct_answer marked any empty or
--    null submission as correct, awarding points for nothing. The 105 objective
--    exercises all have an answer, so this was not reachable today, but it
--    silently manufactures a correct mark for any future exercise authored
--    without one.
--
-- 3. A null attempt_limit made the limit check compare against null, which is
--    never true, so attempts became unlimited. Coalesced to the column default
--    of 3.

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

  -- Refuse before scoring, rather than scoring an unanswerable exercise.
  if exercise_row.correct_answer is null or btrim(exercise_row.correct_answer) = '' then
    raise exception 'This exercise has no answer key, so it cannot be auto graded';
  end if;

  -- Reuse the single source of truth for access, so objective grading and the
  -- lesson gates can never disagree about who may attempt what.
  if not public.academy_lesson_is_unlocked_for_student(auth.uid(), exercise_row.lesson_id) then
    raise exception 'This topic is not unlocked for you yet';
  end if;

  select count(*) into attempt_count
  from public.academy_exercise_attempts
  where exercise_id = target_exercise_id and student_id = auth.uid();
  if attempt_count >= coalesce(exercise_row.attempt_limit, 3) then
    raise exception 'Attempt limit reached';
  end if;

  is_correct := lower(trim(submitted_answer)) = lower(trim(exercise_row.correct_answer));

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

notify pgrst, 'reload schema';
