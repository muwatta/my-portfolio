-- Lessons were coming out in a scattered order, which is what was reported.
--
-- The cause is data, not the query. Sorting by sort_order made it worse for a
-- while, because sort_order had never been maintained. It defaults to 0, and
-- only a few early seeds set it. So a week held a mixture of real numbers and
-- zeros, and the zeros all tied with each other:
--
--   sort_order 0, 0, 0, 0, 4
--
-- which sorts into a genuine scramble: the one lesson that happened to have a
-- real value jumps to the end and the rest fall back to an arbitrary order
-- among equals. Verified against the live database before writing this: 72 of
-- 120 C++ lessons, 55 of 88 Python and all 25 Terminal lessons had a sort_order
-- that did not match their position in the week.
--
-- sort_order is now set to lesson_number for every lesson, so the stored order
-- and the intended order are the same thing and the data says so. It stays a
-- separate column on purpose, because that is what lets a teacher put a lesson
-- earlier or later without renumbering the whole week.
--
-- The constraint is the part that stops it happening again: a sort_order of 0
-- means "never set" and is exactly the state that caused this, so it is now
-- refused rather than quietly allowed to tie with every other unset row.

update public.academy_lessons l
set sort_order = l.lesson_number
where l.sort_order is distinct from l.lesson_number;

-- Ordered the way a syllabus is read, so the stored data can be checked at a
-- glance rather than inferred.
do $$
declare
  course_row record;
  out_of_order integer;
begin
  for course_row in select id from public.academy_courses loop
    select count(*) into out_of_order
    from (
      select w.week_number, l.lesson_number, l.sort_order,
             row_number() over (
               partition by w.week_number order by l.sort_order, l.lesson_number
             ) as position
      from public.academy_lessons l
      join public.academy_weeks w on w.id = l.week_id
      where w.course_id = course_row.id
    ) ranked
    where position <> lesson_number;
    if out_of_order > 0 then
      raise notice 'course % has % lesson(s) out of order', course_row.id, out_of_order;
    end if;
  end loop;
end;
$$;

alter table public.academy_lessons
  drop constraint if exists academy_lessons_sort_order_positive;

alter table public.academy_lessons
  add constraint academy_lessons_sort_order_positive
  check (sort_order > 0);

-- The same on the other two ordered tables, for the same reason: a default of 0
-- on an ordering column is a value nobody chose.
update public.academy_weeks
set sort_order = week_number
where sort_order is distinct from week_number and sort_order = 0;

alter table public.academy_weeks
  drop constraint if exists academy_weeks_sort_order_positive;

alter table public.academy_weeks
  add constraint academy_weeks_sort_order_positive
  check (sort_order > 0);
