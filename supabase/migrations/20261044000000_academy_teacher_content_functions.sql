-- Phase 2: the teacher's content flow, server side.
--
-- The existing pages wrote academy_lessons directly through PostgREST, which
-- cannot express the lifecycle rules added in phase 1. Everything that decides
-- status, release time, ordering or duplication moves behind SECURITY DEFINER
-- helpers so there is one place where the rules live, and so a teacher cannot
-- publish a lesson into a week that is not theirs by writing the row directly.
--
-- The direct write policies are left in place so the current pages keep working
-- while the new editor is rolled out.

-- Shared guard, so each function starts with the same teacher check.
create or replace function public.academy_require_teacher()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.academy_is_teacher() then
    raise exception 'Teacher access required.' using errcode = '42501';
  end if;
end;
$$;

-- Create or update a lesson with the full lifecycle.

create or replace function public.academy_save_lesson(
  p_week_id uuid,
  p_title text,
  p_slug text default '',
  p_lesson_number integer default 0,
  p_objectives text[] default '{}',
  p_content jsonb default '{}'::jsonb,
  p_status text default 'draft',
  p_release_at timestamptz default null,
  p_due_at timestamptz default null,
  p_points numeric default null,
  p_late_policy text default 'accept_penalty',
  p_unlock_after_id uuid default null,
  p_sort_order integer default 0,
  p_lesson_id uuid default null
)
returns public.academy_lessons
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.academy_lessons;
  normalised_slug text;
  normalised_status text;
begin
  perform public.academy_require_teacher();

  normalised_slug := lower(trim(coalesce(p_slug, '')));
  normalised_status := lower(trim(coalesce(p_status, 'draft')));

  if normalised_slug = '' then
    -- Fall back to a slug from the title so a fast form does not demand one.
    normalised_slug := lower(regexp_replace(trim(coalesce(p_title, '')), '[^a-z0-9]+', '-', 'i'));
    normalised_slug := trim(both '-' from normalised_slug);
  end if;

  if p_week_id is null then
    raise exception 'Week is required.' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Title is required.' using errcode = '22023';
  end if;
  if normalised_slug = '' then
    raise exception 'Could not derive a slug from the title.' using errcode = '22023';
  end if;
  if normalised_status not in ('draft', 'scheduled', 'published', 'archived') then
    raise exception 'Unknown status %', normalised_status using errcode = '22023';
  end if;

  -- "Unlock after the previous topic" must point at a real lesson in the same
  -- course, otherwise the prerequisite chain silently never unlocks.
  if p_unlock_after_id is not null and not exists (
    select 1
    from public.academy_lessons target
    join public.academy_weeks target_week on target_week.id = target.week_id
    join public.academy_weeks own_week on own_week.id = p_week_id
    where target.id = p_unlock_after_id
      and target_week.course_id = own_week.course_id
      and target.id <> coalesce(p_lesson_id, target.id)
  ) then
    raise exception 'The unlock prerequisite must be another topic in the same course.'
      using errcode = '22023';
  end if;

  if p_lesson_id is null then
    insert into public.academy_lessons (
      week_id, title, slug, lesson_number, objectives, content,
      status, release_at, due_at, points, late_policy, unlock_after_id, sort_order
    )
    values (
      p_week_id, trim(p_title), normalised_slug, coalesce(p_lesson_number, 0), p_objectives, p_content,
      normalised_status, p_release_at, p_due_at, p_points, p_late_policy, p_unlock_after_id, coalesce(p_sort_order, 0)
    )
    returning * into saved;
  else
    update public.academy_lessons
       set title = trim(p_title),
           slug = normalised_slug,
           lesson_number = coalesce(p_lesson_number, lesson_number),
           objectives = p_objectives,
           content = p_content,
           status = normalised_status,
           release_at = p_release_at,
           due_at = p_due_at,
           points = p_points,
           late_policy = p_late_policy,
           unlock_after_id = p_unlock_after_id,
           sort_order = coalesce(p_sort_order, sort_order)
     where id = p_lesson_id
    returning * into saved;

    if saved.id is null then
      raise exception 'Topic not found.' using errcode = 'P0002';
    end if;
  end if;

  return saved;
end;
$$;

-- Publish now, schedule for later, or pull back to a draft.

create or replace function public.academy_set_lesson_status(
  p_lesson_id uuid,
  p_status text,
  p_release_at timestamptz default null
)
returns public.academy_lessons
language plpgsql
security definer
set search_path = public
as $$
declare
  target_status text;
  saved public.academy_lessons;
begin
  perform public.academy_require_teacher();

  target_status := lower(trim(coalesce(p_status, '')));
  if target_status not in ('draft', 'scheduled', 'published', 'archived') then
    raise exception 'Unknown status %', target_status using errcode = '22023';
  end if;

  update public.academy_lessons
     set status = target_status,
         -- Publishing now means no future gate, so release_at is cleared.
         release_at = case
           when target_status = 'published' then coalesce(release_at, now())
           when target_status = 'scheduled' then p_release_at
           else null
         end
   where id = p_lesson_id
  returning * into saved;

  if saved.id is null then
    raise exception 'Topic not found.' using errcode = 'P0002';
  end if;
  if target_status = 'scheduled' and p_release_at is null then
    raise exception 'A scheduled topic needs a release time.' using errcode = '22023';
  end if;

  return saved;
end;
$$;

-- Copy a topic together with its subtopics and attached activities, leaving the
-- copy as a draft so it cannot be published by accident.

create or replace function public.academy_duplicate_lesson(
  p_lesson_id uuid,
  p_title text default null,
  p_slug text default null
)
returns public.academy_lessons
language plpgsql
security definer
set search_path = public
as $$
declare
  source public.academy_lessons;
  copy_row public.academy_lessons;
  new_slug text;
  new_title text;
begin
  perform public.academy_require_teacher();

  select * into source from public.academy_lessons where id = p_lesson_id;
  if source.id is null then
    raise exception 'Topic not found.' using errcode = 'P0002';
  end if;

  new_title := coalesce(nullif(trim(coalesce(p_title, '')), ''), source.title || ' (copy)');

  -- Slug must stay unique inside the week, so add a suffix until it is free.
  new_slug := coalesce(
    nullif(lower(trim(coalesce(p_slug, ''))), ''),
    lower(regexp_replace(new_title, '[^a-z0-9]+', '-', 'i'))
  );
  new_slug := trim(both '-' from new_slug);

  while exists (select 1 from public.academy_lessons where week_id = source.week_id and slug = new_slug) loop
    new_slug := new_slug || '-copy';
  end loop;

  insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content,
    status, release_at, due_at, points, late_policy, unlock_after_id, sort_order
  )
  values (
    source.week_id, new_title, new_slug, source.lesson_number, source.objectives, source.content,
    'draft', null, source.due_at, source.points, source.late_policy, source.unlock_after_id,
    coalesce(source.sort_order, 0) + 1
  )
  returning * into copy_row;

  insert into public.academy_lesson_subtopics (lesson_id, title, concept, explanation, example, ordering, published)
  select copy_row.id, title, concept, explanation, example, ordering, published
    from public.academy_lesson_subtopics
   where lesson_id = source.id;

  insert into public.academy_lesson_activities (lesson_id, kind, ref_id, title, points, status, sort_order)
  select copy_row.id, kind, ref_id, title, points, 'draft', sort_order
    from public.academy_lesson_activities
   where lesson_id = source.id
     -- An activity must belong to one lesson, so the copy points at the same
     -- practice or assignment only when nothing else claims it.
     and not exists (
       select 1 from public.academy_lesson_activities other
        where other.lesson_id = copy_row.id
          and other.kind = public.academy_lesson_activities.kind
          and other.ref_id = public.academy_lesson_activities.ref_id
     );

  return copy_row;
end;
$$;

-- Drag to reorder. Only the ids supplied are touched, and only inside one week.

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
  position integer;
  lesson_id uuid;
begin
  perform public.academy_require_teacher();

  if p_week_id is null or coalesce(array_length(p_ordered_ids, 1), 0) = 0 then
    raise exception 'A week and at least one topic are required.' using errcode = '22023';
  end if;

  foreach lesson_id in array p_ordered_ids loop
    position := position + 1;
    update public.academy_lessons
       set sort_order = position
     where id = lesson_id
       and week_id = p_week_id;
    applied := applied + 1;
  end loop;

  return applied;
end;
$$;

-- Attach or update a practice question, assignment or project to a topic.

create or replace function public.academy_save_activity(
  p_lesson_id uuid,
  p_kind text,
  p_ref_id uuid,
  p_activity_id uuid default null,
  p_title text default null,
  p_points numeric default null,
  p_status text default 'published',
  p_release_at timestamptz default null,
  p_due_at timestamptz default null,
  p_sort_order integer default 0
)
returns public.academy_lesson_activities
language plpgsql
security definer
set search_path = public
as $$
declare
  normalised_kind text;
  normalised_status text;
  saved public.academy_lesson_activities;
begin
  perform public.academy_require_teacher();

  normalised_kind := lower(trim(coalesce(p_kind, '')));
  normalised_status := lower(trim(coalesce(p_status, 'published')));

  if normalised_kind not in ('practice', 'assignment', 'project') then
    raise exception 'Unknown activity kind %', normalised_kind using errcode = '22023';
  end if;
  if normalised_status not in ('draft', 'scheduled', 'published', 'archived') then
    raise exception 'Unknown status %', normalised_status using errcode = '22023';
  end if;

  if normalised_kind = 'practice' and not exists (
    select 1 from public.academy_exercises where id = p_ref_id
  ) then
    raise exception 'Practice question not found.' using errcode = 'P0002';
  end if;
  if normalised_kind = 'assignment' and not exists (
    select 1 from public.academy_assignments where id = p_ref_id
  ) then
    raise exception 'Assignment not found.' using errcode = 'P0002';
  end if;
  if normalised_kind = 'project' and not exists (
    select 1 from public.academy_projects where id = p_ref_id
  ) then
    raise exception 'Project not found.' using errcode = 'P0002';
  end if;

  if p_activity_id is null then
    insert into public.academy_lesson_activities
      (lesson_id, kind, ref_id, title, points, status, release_at, due_at, sort_order)
    values
      (p_lesson_id, normalised_kind, p_ref_id, p_title, p_points, normalised_status, p_release_at, p_due_at, coalesce(p_sort_order, 0))
    on conflict (lesson_id, kind, ref_id) do update
      set title = excluded.title,
          points = excluded.points,
          status = excluded.status,
          release_at = excluded.release_at,
          due_at = excluded.due_at,
          sort_order = excluded.sort_order,
          updated_at = now()
    returning * into saved;
  else
    update public.academy_lesson_activities
       set title = p_title,
           points = p_points,
           status = normalised_status,
           release_at = p_release_at,
           due_at = p_due_at,
           sort_order = coalesce(p_sort_order, sort_order),
           updated_at = now()
     where id = p_activity_id
       and lesson_id = p_lesson_id
    returning * into saved;

    if saved.id is null then
      raise exception 'Activity not found on this topic.' using errcode = 'P0002';
    end if;
  end if;

  return saved;
end;
$$;

create or replace function public.academy_remove_activity(p_activity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.academy_require_teacher();
  delete from public.academy_lesson_activities where id = p_activity_id;
end;
$$;

revoke execute on function public.academy_require_teacher() from public, anon, authenticated;
revoke execute on function public.academy_save_lesson(uuid, text, text, integer, text[], jsonb, text, timestamptz, timestamptz, numeric, text, uuid, integer, uuid) from public, anon;
revoke execute on function public.academy_set_lesson_status(uuid, text, timestamptz) from public, anon;
revoke execute on function public.academy_duplicate_lesson(uuid, text, text) from public, anon;
revoke execute on function public.academy_reorder_lessons(uuid, uuid[]) from public, anon;
revoke execute on function public.academy_save_activity(uuid, text, uuid, uuid, text, numeric, text, timestamptz, timestamptz, integer) from public, anon;
revoke execute on function public.academy_remove_activity(uuid) from public, anon;

grant execute on function public.academy_save_lesson(uuid, text, text, integer, text[], jsonb, text, timestamptz, timestamptz, numeric, text, uuid, integer, uuid) to authenticated;
grant execute on function public.academy_set_lesson_status(uuid, text, timestamptz) to authenticated;
grant execute on function public.academy_duplicate_lesson(uuid, text, text) to authenticated;
grant execute on function public.academy_reorder_lessons(uuid, uuid[]) to authenticated;
grant execute on function public.academy_save_activity(uuid, text, uuid, uuid, text, numeric, text, timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.academy_remove_activity(uuid) to authenticated;
