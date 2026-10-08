create or replace function public.academy_practice_session_attempt_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session_id uuid;
  target_lesson_id uuid;
  question_count integer;
begin
  select exercise.practice_session_id, exercise.lesson_id
    into target_session_id, target_lesson_id
  from public.academy_exercises exercise
  where exercise.id = new.exercise_id;

  if target_session_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.academy_practice_sessions practice_session
    where practice_session.id = target_session_id
      and practice_session.student_id = new.student_id
      and practice_session.lesson_id = target_lesson_id
  ) then
    raise exception 'This practice question does not belong to your session.';
  end if;

  if new.passed > 0 then
    select count(*) into question_count
    from public.academy_exercises question
    where question.practice_session_id = target_session_id;

    if question_count = 0 then
      return new;
    end if;

    update public.academy_practice_sessions practice_session
    set completed_at = now()
    where practice_session.id = target_session_id
      and practice_session.student_id = new.student_id
      and practice_session.completed_at is null
      and not exists (
        select 1
        from public.academy_exercises question
        where question.practice_session_id = target_session_id
          and not exists (
            select 1
            from public.academy_exercise_attempts attempt
            where attempt.exercise_id = question.id
              and attempt.student_id = new.student_id
              and attempt.passed > 0
          )
      );
  end if;

  return new;
end;
$$;

revoke execute on function public.academy_practice_session_attempt_guard()
  from public, anon, authenticated;
