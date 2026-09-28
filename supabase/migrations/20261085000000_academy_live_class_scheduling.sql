-- Make a live class actually creatable.
--
-- academy_schedules already allowed activity_type 'live_class' and
-- academy_live_rooms already existed with policies and a working student page,
-- but nothing could create a room, and the only scheduling helper hard coded
-- activity_type = 'lesson'. A live class was therefore impossible to set up
-- through the application, which is why the voice note classroom had nothing to
-- join.
--
-- One function creates the schedule and its room together, because a published
-- live class with no room is exactly the half built state that caused this.

create or replace function public.academy_schedule_live_class(
  p_course_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_description text default '',
  p_ends_at timestamptz default null,
  p_published boolean default true
)
returns table (
  schedule_id uuid,
  room_id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  published boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_schedule uuid;
  created_room uuid;
  trimmed_title text;
begin
  if not public.academy_is_teacher() then
    raise exception 'Teacher access required.' using errcode = '42501';
  end if;

  trimmed_title := nullif(trim(coalesce(p_title, '')), '');
  if trimmed_title is null then
    raise exception 'A live class needs a title.' using errcode = '22023';
  end if;
  if p_course_id is null then
    raise exception 'A live class needs a course.' using errcode = '22023';
  end if;
  if p_starts_at is null then
    raise exception 'A live class needs a start time.' using errcode = '22023';
  end if;
  if p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'The end time must be after the start time.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.academy_courses where id = p_course_id) then
    raise exception 'Course not found.' using errcode = 'P0002';
  end if;

  insert into public.academy_schedules (
    course_id, activity_type, title, description,
    starts_at, ends_at, published, created_by
  )
  values (
    p_course_id, 'live_class', trimmed_title, coalesce(p_description, ''),
    p_starts_at, p_ends_at, coalesce(p_published, true), auth.uid()
  )
  returning id into created_schedule;

  insert into public.academy_live_rooms (schedule_id, title, status, created_by)
  values (created_schedule, trimmed_title, 'scheduled', auth.uid())
  returning id into created_room;

  insert into public.academy_activity_feed (
    actor_id, actor_name, activity_type, entity_type, entity_id,
    entity_label, course_id
  )
  values (
    auth.uid(),
    (select display_name from public.academy_profiles where id = auth.uid()),
    'admin_view',
    'live_class',
    created_room,
    trimmed_title,
    p_course_id
  );

  schedule_id := created_schedule;
  room_id := created_room;
  title := trimmed_title;
  starts_at := p_starts_at;
  ends_at := p_ends_at;
  published := coalesce(p_published, true);
  return next;
end;
$$;

-- Open or close an existing live class without editing the schedule row.
create or replace function public.academy_set_live_room_status(
  p_room_id uuid,
  p_status text
)
returns table (room_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target text;
  updated uuid;
begin
  if not public.academy_is_teacher() then
    raise exception 'Teacher access required.' using errcode = '42501';
  end if;

  target := lower(trim(coalesce(p_status, '')));
  if target not in ('scheduled', 'live', 'ended') then
    raise exception 'Unknown room status %', target using errcode = '22023';
  end if;

  update public.academy_live_rooms
     set status = target
   where id = p_room_id
  returning id into updated;

  if updated is null then
    raise exception 'Room not found.' using errcode = 'P0002';
  end if;

  room_id := updated;
  status := target;
  return next;
end;
$$;

revoke execute on function public.academy_schedule_live_class(uuid, text, timestamptz, text, timestamptz, boolean) from public, anon;
revoke execute on function public.academy_set_live_room_status(uuid, text) from public, anon;
grant execute on function public.academy_schedule_live_class(uuid, text, timestamptz, text, timestamptz, boolean) to authenticated;
grant execute on function public.academy_set_live_room_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';
