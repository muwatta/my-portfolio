-- Students must never be able to read exercise answer keys, so the column-level
-- grant on academy_exercises deliberately omits tests, solution_code and
-- correct_answer. That grant also blocked staff from reading the exercises they
-- author, so the admin practice library could not load at all. Expose the full
-- rows through a staff-only security definer function instead.

create or replace function public.academy_staff_exercise_list()
returns table (
  id uuid,
  lesson_id uuid,
  title text,
  instructions text,
  starter_code text,
  difficulty text,
  expected_concepts text[],
  hints text[],
  tests jsonb,
  solution_code text,
  explanation text,
  question_type text,
  choices jsonb,
  correct_answer text,
  attempt_limit smallint,
  published boolean,
  sort_order integer,
  updated_at timestamptz,
  lesson_title text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.academy_is_admin() or public.academy_is_teacher()) then
    raise exception 'Academy staff access required to view exercise answer keys.';
  end if;

  return query
  select
    exercises.id,
    exercises.lesson_id,
    exercises.title,
    exercises.instructions,
    exercises.starter_code,
    exercises.difficulty,
    exercises.expected_concepts,
    exercises.hints,
    exercises.tests,
    exercises.solution_code,
    exercises.explanation,
    exercises.question_type,
    exercises.choices,
    exercises.correct_answer,
    exercises.attempt_limit,
    exercises.published,
    exercises.sort_order,
    exercises.updated_at,
    lessons.title
  from public.academy_exercises as exercises
  left join public.academy_lessons as lessons on lessons.id = exercises.lesson_id
  order by exercises.title;
end;
$$;

revoke execute on function public.academy_staff_exercise_list() from public, anon;
grant execute on function public.academy_staff_exercise_list() to authenticated;

notify pgrst, 'reload schema';
