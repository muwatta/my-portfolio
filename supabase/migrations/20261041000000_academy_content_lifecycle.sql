-- Phase 1, step 3: the content model the brief asks for, added on top of the
-- existing tables rather than replacing them.
--
-- Three problems this solves.
--
-- 1. A third course could not be added without a code change, because the client
--    picks the editor by comparing a course slug against a hard coded string.
--    academy_courses.language records the language on the row instead.
--
-- 2. There was no way to schedule anything. published was a boolean, so content
--    either existed for everyone or for nobody. status plus release_at give
--    draft, scheduled, published and archived, and the student policies honour
--    release_at directly, so a scheduled item appears on time even if the
--    housekeeping cron is late or unavailable.
--
-- 3. Activities were not attachable to a lesson as an ordered, gradable set.
--    academy_lesson_activities links practice, assignments and projects to a
--    lesson with points and an order.
--
-- Everything is additive. published and is_draft are left in place and kept in
-- step by the triggers below, so existing client queries that still read them
-- continue to work unchanged.

-- 1. Course language, so the editor no longer depends on a slug comparison.
alter table public.academy_courses
  add column if not exists language text not null default 'python';

comment on column public.academy_courses.language is
  'Runtime used by the in-browser editor. Free text so a new course needs no migration.';

update public.academy_courses
   set language = case
     when slug ilike '%cpp%' or slug ilike '%robot%' or slug ilike '%embedded%' then 'cpp'
     else 'python'
   end
 where language is null or language = 'python';

-- 2. Lesson lifecycle.
alter table public.academy_lessons
  add column if not exists status text not null default 'published',
  add column if not exists release_at timestamptz,
  add column if not exists due_at timestamptz,
  add column if not exists points numeric(8, 2),
  add column if not exists late_policy text not null default 'accept_penalty',
  add column if not exists unlock_after_id uuid references public.academy_lessons(id) on delete set null;

alter table public.academy_lessons
  add constraint academy_lessons_status_check
    check (status in ('draft', 'scheduled', 'published', 'archived'));

alter table public.academy_lessons
  add constraint academy_lessons_late_policy_check
    check (late_policy in ('accept_penalty', 'closed'));

-- Backfill from the boolean the system already used.
update public.academy_lessons
   set status = case when published then 'published' else 'draft' end
 where status = 'published'
   and published is not true;

-- 3. Same lifecycle for practice questions and assignments, so the teacher can
--    schedule either one.
alter table public.academy_exercises
  add column if not exists status text not null default 'published',
  add column if not exists release_at timestamptz,
  add column if not exists due_at timestamptz;

alter table public.academy_exercises
  add constraint academy_exercises_status_check
    check (status in ('draft', 'scheduled', 'published', 'archived'));

update public.academy_exercises
   set status = case when published then 'published' else 'draft' end
 where status = 'published'
   and published is not true;

alter table public.academy_assignments
  add column if not exists status text not null default 'published',
  add column if not exists release_at timestamptz,
  add column if not exists late_policy text not null default 'accept_penalty';

alter table public.academy_assignments
  add constraint academy_assignments_status_check
    check (status in ('draft', 'scheduled', 'published', 'archived'));

alter table public.academy_assignments
  add constraint academy_assignments_late_policy_check
  check (late_policy in ('accept_penalty', 'closed'));

update public.academy_assignments
   set status = case
     when is_draft then 'draft'
     when published then 'published'
     else 'draft'
   end
 where status = 'published';

-- 4. Ordered, gradable activities attached to a lesson.
create table if not exists public.academy_lesson_activities (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.academy_lessons(id) on delete cascade,
  kind text not null check (kind in ('practice', 'assignment', 'project')),
  ref_id uuid not null,
  title text,
  points numeric(8, 2),
  status text not null default 'published'
    check (status in ('draft', 'scheduled', 'published', 'archived')),
  release_at timestamptz,
  due_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, kind, ref_id)
);

create index if not exists academy_lesson_activities_lesson_idx
  on public.academy_lesson_activities (lesson_id, sort_order);

alter table public.academy_lesson_activities enable row level security;

-- Students read activities on lessons they can actually reach.
drop policy if exists academy_lesson_activities_read on public.academy_lesson_activities;
create policy academy_lesson_activities_read on public.academy_lesson_activities
  for select to authenticated using (
    public.academy_is_teacher()
    or (
      status = 'published'
      and (release_at is null or release_at <= now())
      and exists (
        select 1 from public.academy_lessons l
        where l.id = lesson_id
          and l.status = 'published'
          and (l.release_at is null or l.release_at <= now())
          and public.academy_lesson_is_unlocked_for_student(auth.uid(), l.id)
      )
    )
  );

drop policy if exists academy_lesson_activities_manage on public.academy_lesson_activities;
create policy academy_lesson_activities_manage on public.academy_lesson_activities
  for all to authenticated using (public.academy_is_teacher())
  with check (public.academy_is_teacher());

-- Backfill: every existing exercise and assignment becomes an activity of its
-- lesson, so the new table is useful from the moment it exists.
insert into public.academy_lesson_activities (lesson_id, kind, ref_id, title, points, status, sort_order)
select e.lesson_id,
       'practice',
       e.id,
       e.title,
       null,
       case when e.status = 'published' then 'published' else 'draft' end,
       coalesce(e.sort_order, 0)
  from public.academy_exercises e
 where e.lesson_id is not null
on conflict (lesson_id, kind, ref_id) do nothing;

insert into public.academy_lesson_activities (lesson_id, kind, ref_id, title, points, status, sort_order)
select a.lesson_id,
       'assignment',
       a.id,
       a.title,
       a.points,
       case when a.status = 'published' then 'published' else 'draft' end,
       0
  from public.academy_assignments a
 where a.lesson_id is not null
on conflict (lesson_id, kind, ref_id) do nothing;

-- 5. Keep the legacy booleans in step with status, so old queries that read
--    published or is_draft do not disagree with the new model.

create or replace function public.academy_sync_lesson_publish_flags()
returns trigger
language plpgsql
as $$
begin
  if new.published is distinct from (new.status = 'published') then
    new.published := (new.status = 'published');
  end if;
  if new.status = 'published' and new.release_at is null then
    new.release_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.academy_sync_activity_publish_flags()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and new.release_at is null then
    new.release_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists academy_sync_lesson_publish_flags on public.academy_lessons;
create trigger academy_sync_lesson_publish_flags
  before insert or update on public.academy_lessons
  for each row execute function public.academy_sync_lesson_publish_flags();

drop trigger if exists academy_sync_activity_publish_flags on public.academy_lesson_activities;
create trigger academy_sync_activity_publish_flags
  before insert or update on public.academy_lesson_activities
  for each row execute function public.academy_sync_activity_publish_flags();

create or replace function public.academy_sync_assignment_publish_flags()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and new.is_draft then
    new.is_draft := false;
  end if;
  if new.status = 'draft' then
    new.is_draft := true;
  end if;
  return new;
end;
$$;

drop trigger if exists academy_sync_assignment_publish_flags on public.academy_assignments;
create trigger academy_sync_assignment_publish_flags
  before insert or update on public.academy_assignments
  for each row execute function public.academy_sync_assignment_publish_flags();

revoke execute on function public.academy_sync_lesson_publish_flags() from public, anon, authenticated;
revoke execute on function public.academy_sync_activity_publish_flags() from public, anon, authenticated;
revoke execute on function public.academy_sync_assignment_publish_flags() from public, anon, authenticated;

-- 6. Students must not see a lesson until its release time, independently of
--    any scheduled job.
drop policy if exists academy_lessons_read on public.academy_lessons;
create policy academy_lessons_read on public.academy_lessons
  for select to authenticated using (
    public.academy_is_teacher()
    or (
      status = 'published'
      and (release_at is null or release_at <= now())
    )
  );

drop policy if exists academy_exercises_read on public.academy_exercises;
create policy academy_exercises_read on public.academy_exercises
  for select to authenticated using (
    public.academy_is_teacher()
    or (
      status = 'published'
      and (release_at is null or release_at <= now())
      and exists (
        select 1 from public.academy_lessons l
        where l.id = lesson_id
          and l.status = 'published'
          and (l.release_at is null or l.release_at <= now())
          and public.academy_lesson_is_unlocked_for_student(auth.uid(), l.id)
      )
    )
  );

notify pgrst, 'reload schema';
