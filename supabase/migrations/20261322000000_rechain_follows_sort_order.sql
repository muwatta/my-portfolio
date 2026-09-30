-- The rechain built the unlock order from lesson_number, so a teacher who
-- reordered a week changed what students see without changing what unlocks
-- them. Verified live: swapping lessons 3 and 4 of Terminal week 1 put lesson 4
-- on screen before lesson 3, while lesson 4 still required lesson 3, so a
-- student would be told to finish something that appears further down the page.
--
-- sort_order is the order the syllabus is displayed in, so it is the order the
-- chain has to follow. It equals lesson_number for every lesson today, because
-- 20261320000000 normalised it, so this changes nothing now and is correct after
-- a teacher reorders. lesson_number stays as the final tie-break so the result
-- is total and the same input always gives the same chain.

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
        order by w.week_number, l.sort_order, l.lesson_number, l.id
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

-- Rebuilt now so the stored chain matches the rule that will keep it true.
select public.academy_rechain_course_lessons(id)
from public.academy_courses;
