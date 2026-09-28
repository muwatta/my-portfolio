-- Give the voice note classroom something to join.
--
-- The probe that verified the scheduler left a room behind, and a voice
-- classroom with no room is exactly the half built state this whole change
-- exists to remove. Clear the probe's leftovers, then create one properly
-- titled live class per course so a student can actually join, record a note
-- and hear it back.
--
-- The start times are placeholders a teacher can edit from the live class
-- form. The rooms are 'scheduled' rather than 'live', because opening the
-- door is the teacher's decision and not a seed's.

do $$
declare
  owner uuid;
  python_course uuid;
  cpp_course uuid;
  made integer := 0;
  entry record;
begin
  select user_id into owner from public.academy_admins order by created_at limit 1;
  if owner is null then
    raise notice 'no academy_admins row, skipping live class seed';
    return;
  end if;

  -- Remove anything the scheduler probe left, then any duplicate seeded class
  -- so this migration is safe to re-run.
  delete from public.academy_live_messages
   where room_id in (select id from public.academy_live_rooms where title = 'Live Python clinic');
  delete from public.academy_live_rooms where title = 'Live Python clinic';
  delete from public.academy_schedules
   where title in ('Live Python clinic', 'Live Python clinic ')
     and activity_type = 'live_class';

  for entry in
    select * from (values
      ('python-for-ai-machine-learning', 'Python clinic: bring your code'),
      ('cpp-embedded-robotics', 'Robotics clinic: bring your wiring')
    ) as t(slug, title)
  loop
    if not exists (
      select 1 from public.academy_schedules
       where title = entry.title and activity_type = 'live_class'
    ) then
      select id into python_course from public.academy_courses where slug = entry.slug;
      if python_course is not null then
        insert into public.academy_schedules (
          course_id, activity_type, title, description,
          starts_at, ends_at, published, created_by
        )
        values (
          python_course, 'live_class', entry.title,
          'Record a voice note with the question you are stuck on, or the thing you got working. Everyone here is on a phone, so keep it short.',
          date_trunc('hour', now()) + interval '1 day',
          date_trunc('hour', now()) + interval '1 day 1 hour',
          true, owner
        )
        returning id into python_course;

        insert into public.academy_live_rooms (schedule_id, title, status, created_by)
        values (python_course, entry.title, 'scheduled', owner);
        made := made + 1;
      end if;
      python_course := null;
    end if;
  end loop;

  raise notice 'seeded % live class(es)', made;
end;
$$;
