-- Reordering a week was broken, and the constraint added in
-- 20261320000000 is what made it visible.
--
-- academy_reorder_lessons declares `position integer;` and then does
-- `position := position + 1`. In plpgsql an uninitialised integer is NULL, and
-- NULL + 1 is NULL, so the first lesson in every reorder was written with
-- sort_order = NULL. There was no constraint on the column, so it succeeded and
-- the first lesson then sorted unpredictably against everything else. That is
-- part of why the syllabus looked scattered.
--
-- Verified live before writing this: reordering the Terminal course week 1
-- failed with a not-null violation carrying sort_order = 1, because the function
-- tried to write NULL and the new check refused it. The check is right and is
-- staying; the function was wrong.
--
-- The function also did not rebuild the prerequisite chain. sort_order and
-- prerequisite_lesson_id are two independent orderings, and a teacher who
-- swapped two lessons changed only the first, so the unlock order and the
-- displayed order silently disagreed: a lesson could appear before the one that
-- unlocks it. The chain is rebuilt from the new order here rather than leaving
-- the two to drift.

create or replace function public.academy_reorder_lessons(
  p_week_id uuid,
  p_ordered_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  applied integer := 0;
  position integer := 0;
  lesson_id uuid;
  course_id uuid;
begin
  perform public.academy_require_teacher();

  if p_week_id is null or coalesce(array_length(p_ordered_ids, 1), 0) = 0 then
    raise exception 'A week and at least one topic are required.' using errcode = '22023';
  end if;

  select w.course_id into course_id
  from public.academy_weeks w
  where w.id = p_week_id;

  foreach lesson_id in array p_ordered_ids loop
    position := position + 1;
    update public.academy_lessons
       set sort_order = position
     where id = lesson_id
       and week_id = p_week_id;
    applied := applied + 1;
  end loop;

  -- The unlock order has to be the order the teacher just chose, or the syllabus
  -- says one thing and the gating does another.
  if course_id is not null then
    perform public.academy_rechain_course_lessons(course_id);
  end if;

  return applied;
end;
$$;

revoke execute on function public.academy_reorder_lessons(uuid, uuid[]) from public, anon;
grant execute on function public.academy_reorder_lessons(uuid, uuid[]) to authenticated;
