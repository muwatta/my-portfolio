-- Restore objects that the remote database is missing even though their
-- migrations are recorded as applied. Migrations are tracked by version only,
-- so a file edited after it was applied never reaches an existing project.

create or replace function public.academy_start_learning_session(
  target_route text
)
returns public.academy_learning_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  new_session public.academy_learning_sessions;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.academy_learning_sessions (student_id, last_route)
  values (auth.uid(), left(coalesce(target_route, ''), 500))
  returning * into new_session;

  return new_session;
end;
$$;

revoke execute on function public.academy_start_learning_session(text) from public, anon;
grant execute on function public.academy_start_learning_session(text) to authenticated;

-- The practice library revokes table level select and then re-grants only the
-- columns a student may read. tests, solution_code and correct_answer stay out
-- of this list so answer keys are never sent to the browser.
grant select (
  id,
  lesson_id,
  title,
  instructions,
  starter_code,
  difficulty,
  expected_concepts,
  hints,
  explanation,
  question_type,
  choices,
  attempt_limit
) on public.academy_exercises to authenticated;

notify pgrst, 'reload schema';
