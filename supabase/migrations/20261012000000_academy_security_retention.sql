-- Security hardening for student writes, grading integrity, point idempotency,
-- signup defaults, retention, and scheduled cleanup.

create or replace function public.academy_create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_school text := nullif(new.raw_user_meta_data ->> 'school_code', '');
begin
  insert into public.academy_profiles (id, display_name, school_id, state, city)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    (select id from public.academy_schools where code = requested_school and is_active),
    nullif(new.raw_user_meta_data ->> 'state', ''),
    nullif(new.raw_user_meta_data ->> 'city', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.academy_start_lesson(target_lesson_id uuid)
returns public.academy_lesson_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  progress_row public.academy_lesson_progress;
begin
  if auth.uid() is null or not public.academy_lesson_is_unlocked_for_student(auth.uid(), target_lesson_id) then
    raise exception 'Lesson is not available.';
  end if;
  insert into public.academy_lesson_progress (lesson_id, student_id, started_at, completion_status)
  values (target_lesson_id, auth.uid(), now(), 'in_progress')
  on conflict (lesson_id, student_id) do update set
    started_at = coalesce(public.academy_lesson_progress.started_at, excluded.started_at),
    completion_status = case when public.academy_lesson_progress.completed_at is null then 'in_progress' else public.academy_lesson_progress.completion_status end
  returning * into progress_row;
  return progress_row;
end;
$$;

create or replace function public.academy_complete_lesson(target_lesson_id uuid)
returns public.academy_lesson_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  progress_row public.academy_lesson_progress;
begin
  if auth.uid() is null or not public.academy_lesson_is_unlocked_for_student(auth.uid(), target_lesson_id) then
    raise exception 'Lesson is not available.';
  end if;
  insert into public.academy_lesson_progress (lesson_id, student_id, started_at, completed_at, completion_status)
  values (target_lesson_id, auth.uid(), coalesce((select started_at from public.academy_lesson_progress where lesson_id = target_lesson_id and student_id = auth.uid()), now()), now(), 'completed')
  on conflict (lesson_id, student_id) do update set
    completed_at = coalesce(public.academy_lesson_progress.completed_at, excluded.completed_at),
    completion_status = 'completed'
  returning * into progress_row;
  return progress_row;
end;
$$;

create or replace function public.academy_complete_project_milestone(target_milestone_id uuid, target_notes text default '')
returns public.academy_project_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  progress_row public.academy_project_progress;
begin
  if auth.uid() is null or not exists (
    select 1 from public.academy_project_milestones m
    join public.academy_projects p on p.id = m.project_id
    where m.id = target_milestone_id
      and exists (select 1 from public.academy_enrollments e where e.student_id = auth.uid() and e.course_id = p.course_id and e.status = 'active')
  ) then
    raise exception 'Project milestone is not available.';
  end if;
  insert into public.academy_project_progress (milestone_id, student_id, completed_at, notes)
  values (target_milestone_id, auth.uid(), now(), left(coalesce(target_notes, ''), 2000))
  on conflict (milestone_id, student_id) do update set
    completed_at = excluded.completed_at,
    notes = excluded.notes
  returning * into progress_row;
  return progress_row;
end;
$$;

create or replace function public.academy_submission_student_guard()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = new.student_id and new.status <> 'submitted' then
    raise exception 'Students cannot set grading status.';
  end if;
  return new;
end;
$$;

drop trigger if exists academy_submission_student_guard on public.academy_submissions;
create trigger academy_submission_student_guard
before insert or update on public.academy_submissions
for each row execute function public.academy_submission_student_guard();

-- Remove legacy broad student write policies before applying RPC-only writes.
drop policy if exists academy_lesson_progress_self on public.academy_lesson_progress;
drop policy if exists academy_lesson_progress_student_own_write on public.academy_lesson_progress;
drop policy if exists academy_lesson_progress_student_own_update on public.academy_lesson_progress;
drop policy if exists academy_project_progress_self on public.academy_project_progress;
drop policy if exists academy_lesson_progress_student_own_read on public.academy_lesson_progress;
drop policy if exists academy_lesson_progress_student_read on public.academy_lesson_progress;
create policy academy_lesson_progress_student_read
on public.academy_lesson_progress for select to authenticated
using (student_id = auth.uid() or public.academy_is_teacher() or public.academy_is_admin());
drop policy if exists academy_project_progress_student_read on public.academy_project_progress;
create policy academy_project_progress_student_read
on public.academy_project_progress for select to authenticated
using (student_id = auth.uid() or public.academy_is_teacher() or public.academy_is_admin());

revoke insert, update, delete on public.academy_lesson_progress from authenticated;
revoke insert, update, delete on public.academy_project_progress from authenticated;
revoke insert, update, delete on public.academy_submission_results from authenticated;
revoke insert, update, delete on public.academy_leaderboard_points from authenticated;
revoke insert, update, delete on public.academy_student_badges from authenticated;
grant select on public.academy_lesson_progress, public.academy_project_progress, public.academy_submission_results, public.academy_leaderboard_points, public.academy_student_badges to authenticated;

grant execute on function public.academy_start_lesson(uuid) to authenticated;
grant execute on function public.academy_complete_lesson(uuid) to authenticated;
grant execute on function public.academy_complete_project_milestone(uuid, text) to authenticated;

-- A point source is an idempotency key even when the legacy column was nullable.
create unique index if not exists academy_leaderboard_points_idempotency_idx
on public.academy_leaderboard_points (
  student_id,
  period_id,
  source_type,
  coalesce(source_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Chat is temporary; attendance remains an academic record.
create or replace function public.academy_cleanup_live_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.academy_live_messages where created_at < now() - interval '60 days';
end;
$$;

-- Schedule cleanup when pg_cron is available; local environments may omit it.
do $$
begin
  if to_regprocedure('cron.schedule(text,text)') is not null then
    execute 'select cron.schedule(''academy-live-retention'', ''15 3 * * *'', ''select public.academy_cleanup_live_data()'')';
  end if;
exception when others then
  null;
end;
$$;

revoke execute on function public.academy_cleanup_live_data() from public, anon, authenticated;
revoke execute on function public.academy_create_profile() from public, anon, authenticated;
