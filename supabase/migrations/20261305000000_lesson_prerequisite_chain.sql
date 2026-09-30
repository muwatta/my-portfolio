-- Sequential lesson prerequisites were declared but never populated.
-- academy_lessons.prerequisite_lesson_id exists, academy_lesson_is_unlocked_for_student
-- reads it, academy_start_lesson and the progress trigger enforce it, and the
-- student lesson list derives a "locked" state from it. But no insert or update
-- anywhere in this project has ever set the column, so the whole chain evaluated
-- to "no prerequisite" and every lesson unlocked immediately. The gating was
-- real; it had nothing to gate.
--
-- Verified against the live database before writing this: 88 Python lessons and
-- 72 C++ lessons, and zero of them had a prerequisite.
--
-- The chain is strictly ordered by week then lesson number within a course, so
-- the first lesson of a course is the only one with nothing before it. It is
-- built by a function rather than written out as literal ids so that content
-- migrations adding lessons later can simply call it again, instead of every
-- future seed having to hand-compute predecessor ids that would silently rot the
-- moment a lesson was renumbered or archived.

create or replace function public.academy_rechain_course_lessons(p_course_id uuid)
returns integer
language plpgsql
as $$
declare
  linked integer := 0;
begin
  if p_course_id is null then
    return 0;
  end if;

  with ordered as (
    select
      l.id,
      lag(l.id) over (
        order by w.week_number, l.lesson_number, l.id
      ) as previous_id
    from public.academy_lessons l
    join public.academy_weeks w on w.id = l.week_id
    where w.course_id = p_course_id
  )
  update public.academy_lessons l
  set prerequisite_lesson_id = o.previous_id
  from ordered o
  where l.id = o.id
    and l.prerequisite_lesson_id is distinct from o.previous_id;

  get diagnostics linked = row_count;
  return linked;
end;
$$;

-- Applies the chain to every published course. Written as a loop over courses
-- rather than three hardcoded calls so a course added by a later migration only
-- needs this one statement to join the chain.
do $$
declare
  course_row record;
begin
  for course_row in select id from public.academy_courses loop
    perform public.academy_rechain_course_lessons(course_row.id);
  end loop;
end;
$$;

-- The unlock function decides what a student may see next, so it should not be
-- callable by just anyone. It had no explicit grant, which means EXECUTE to
-- PUBLIC by default: an anonymous caller could ask it about any student id and
-- any lesson, and learn the shape of somebody else's progress.
revoke execute on function public.academy_lesson_is_unlocked_for_student(uuid, uuid) from public, anon;
grant execute on function public.academy_lesson_is_unlocked_for_student(uuid, uuid) to authenticated;
