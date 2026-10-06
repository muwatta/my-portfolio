-- Draft and unpublished lessons are not shown to students, so they must not
-- become prerequisites in the student-visible lesson sequence.
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
      lesson.id,
      lag(lesson.id) over (
        order by weeks.week_number, lesson.sort_order, lesson.lesson_number, lesson.id
      ) as previous_id
    from public.academy_lessons lesson
    join public.academy_weeks weeks on weeks.id = lesson.week_id
    where weeks.course_id = p_course_id
      and lesson.published
      and lesson.status = 'published'
  )
  update public.academy_lessons lesson
  set prerequisite_lesson_id = ordered.previous_id
  from ordered
  where lesson.id = ordered.id
    and lesson.prerequisite_lesson_id is distinct from ordered.previous_id;

  get diagnostics linked = row_count;
  return linked;
end;
$$;

create or replace function public.academy_rechain_course_lessons_on_change()
returns trigger
language plpgsql
as $$
declare
  old_course_id uuid;
  new_course_id uuid;
begin
  if tg_op <> 'INSERT' then
    select weeks.course_id
      into old_course_id
    from public.academy_weeks weeks
    where weeks.id = old.week_id;
  end if;

  if tg_op <> 'DELETE' then
    select weeks.course_id
      into new_course_id
    from public.academy_weeks weeks
    where weeks.id = new.week_id;
  end if;

  if old_course_id is not null then
    perform public.academy_rechain_course_lessons(old_course_id);
  end if;

  if new_course_id is not null
    and new_course_id is distinct from old_course_id
  then
    perform public.academy_rechain_course_lessons(new_course_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists academy_rechain_lessons_after_change
  on public.academy_lessons;
create trigger academy_rechain_lessons_after_change
after insert or delete or update of
  week_id, lesson_number, sort_order, published, status
on public.academy_lessons
for each row
execute function public.academy_rechain_course_lessons_on_change();

create or replace function public.academy_rechain_course_lessons_after_week_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.academy_rechain_course_lessons(old.course_id);
    return old;
  elsif tg_op = 'INSERT' then
    perform public.academy_rechain_course_lessons(new.course_id);
    return new;
  end if;

  perform public.academy_rechain_course_lessons(old.course_id);
  if new.course_id is distinct from old.course_id then
    perform public.academy_rechain_course_lessons(new.course_id);
  end if;
  return new;
end;
$$;

drop trigger if exists academy_rechain_lessons_after_week_change
  on public.academy_weeks;
create trigger academy_rechain_lessons_after_week_change
after insert or delete or update of course_id, week_number
on public.academy_weeks
for each row
execute function public.academy_rechain_course_lessons_after_week_change();

-- Repair existing courses, including any published lesson that had been chained
-- behind a draft or unpublished topic.
select public.academy_rechain_course_lessons(course.id)
from public.academy_courses course;
