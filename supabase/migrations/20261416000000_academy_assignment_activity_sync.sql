-- Keep authored assignments attached to the same lesson activity the learner
-- experience uses for display, completion, and progression.
create or replace function public.academy_sync_assignment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_week_id uuid;
  selected_course_id uuid;
  activity_status text;
begin
  if tg_op = 'DELETE' then
    delete from public.academy_lesson_activities
    where kind = 'assignment' and ref_id = old.id;
    return old;
  end if;

  if new.lesson_id is null then
    delete from public.academy_lesson_activities
    where kind = 'assignment' and ref_id = new.id;
    return new;
  end if;

  select lesson.week_id, week.course_id
    into selected_week_id, selected_course_id
    from public.academy_lessons lesson
    join public.academy_weeks week on week.id = lesson.week_id
   where lesson.id = new.lesson_id;

  if selected_week_id is null then
    raise exception 'Choose a lesson that belongs to an Academy course.'
      using errcode = '22023';
  end if;
  if new.course_id is not null and new.course_id <> selected_course_id then
    raise exception 'The selected lesson does not belong to this course.'
      using errcode = '22023';
  end if;
  if new.week_id is not null and new.week_id <> selected_week_id then
    raise exception 'The selected lesson does not belong to this week.'
      using errcode = '22023';
  end if;

  new.course_id := selected_course_id;
  new.week_id := selected_week_id;

  delete from public.academy_lesson_activities
   where kind = 'assignment'
     and ref_id = new.id
     and lesson_id <> new.lesson_id;

  activity_status := case
    when coalesce(new.is_draft, false) or not coalesce(new.published, false)
      then 'draft'
    when new.status = 'archived' then 'archived'
    when new.status = 'scheduled'
      or (new.release_at is not null and new.release_at > now())
      then 'scheduled'
    else 'published'
  end;

  insert into public.academy_lesson_activities (
    lesson_id, kind, ref_id, title, points, status, release_at, due_at
  )
  values (
    new.lesson_id, 'assignment', new.id, new.title, new.points,
    activity_status, new.release_at, new.due_at
  )
  on conflict (lesson_id, kind, ref_id) do update
    set title = excluded.title,
        points = excluded.points,
        status = excluded.status,
        release_at = excluded.release_at,
        due_at = excluded.due_at,
        updated_at = now();

  return new;
end;
$$;

revoke execute on function public.academy_sync_assignment_activity()
  from public, anon, authenticated;

drop trigger if exists academy_assignments_sync_lesson_activity
  on public.academy_assignments;
create trigger academy_assignments_sync_lesson_activity
  before insert or update or delete on public.academy_assignments
  for each row execute function public.academy_sync_assignment_activity();

-- Repair existing, correctly-linked assignments without moving any that have
-- inconsistent course/lesson associations.
insert into public.academy_lesson_activities (
  lesson_id, kind, ref_id, title, points, status, release_at, due_at
)
select
  assignment.lesson_id,
  'assignment',
  assignment.id,
  assignment.title,
  assignment.points,
  case
    when coalesce(assignment.is_draft, false)
      or not coalesce(assignment.published, false)
      then 'draft'
    when assignment.status = 'archived' then 'archived'
    when assignment.status = 'scheduled'
      or (assignment.release_at is not null and assignment.release_at > now())
      then 'scheduled'
    else 'published'
  end,
  assignment.release_at,
  assignment.due_at
from public.academy_assignments assignment
join public.academy_lessons lesson on lesson.id = assignment.lesson_id
join public.academy_weeks week on week.id = lesson.week_id
where assignment.lesson_id is not null
  and (assignment.course_id is null or assignment.course_id = week.course_id)
  and (assignment.week_id is null or assignment.week_id = week.id)
on conflict (lesson_id, kind, ref_id) do update
  set title = excluded.title,
      points = excluded.points,
      status = excluded.status,
      release_at = excluded.release_at,
      due_at = excluded.due_at,
      updated_at = now();

notify pgrst, 'reload schema';
