-- An exam was the one substantial thing a student could do that never reached
-- their progress page or the leaderboard. A student could score 80% on a paper
-- and it was visible in exactly one place: the examinations screen.
--
-- Two parts, because they are different decisions.
--
-- Progress is the student's own record, so adding exam results there is simply
-- correct and needs no policy argument. It is served by the existing
-- academy_exam_student_history, so no new read path was needed.
--
-- The leaderboard is a public ranking, so this is more than a display change and
-- the shape of the award matters. The existing awards are deliberately small and
-- first-time only: 10 for a first lesson, 5 for a first practice. Following that
-- intent, an exam awards points once per paper, on the student's best attempt,
-- so re-sitting or sitting many easy papers cannot farm the board. Points scale
-- with the score and are removed again if a teacher withholds the results, so
-- releasing marks is the only thing that puts a student on the board and taking
-- them back takes them off.

-- The source_type check predates the exam engine and has no 'exam' value, so
-- exam points were rejected by the table itself.
alter table public.academy_leaderboard_points
  drop constraint if exists academy_leaderboard_points_source_type_check;
alter table public.academy_leaderboard_points
  add constraint academy_leaderboard_points_source_type_check
  check (source_type in ('assignment', 'quiz', 'practice', 'project', 'lesson', 'exam'));

-- Recomputes an exam's leaderboard contribution from the graded attempts, using
-- each student's best attempt. Safe to call repeatedly: the award upserts on
-- (student, period, source_type, source_id), and withholding deletes.
create or replace function public.academy_exam_sync_leaderboard(p_exam_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  awarded integer := 0;
  is_published boolean;
begin
  select results_published into is_published
  from public.academy_exams
  where id = p_exam_id;

  if is_published is not true then
    -- Withholding has to take the points off, otherwise marks a teacher has
    -- chosen not to release would still be visible as a ranking.
    delete from public.academy_leaderboard_points
    where source_type = 'exam' and source_id = p_exam_id;
    return 0;
  end if;

  -- Best attempt per student. percentage is set by the submit function, so only
  -- graded rows are considered and a null percentage is skipped rather than
  -- counted as zero.
  insert into public.academy_leaderboard_points
    (student_id, period_id, source_type, source_id, source_label, points, verification_status)
  select
    best.student_id,
    public.academy_ensure_active_week_period(),
    'exam',
    p_exam_id,
    '',
    greatest(1, round(best.percentage / 5.0))::integer,
    'verified'
  from (
    select distinct on (a.student_id) a.student_id, a.percentage
    from public.academy_exam_attempts a
    where a.exam_id = p_exam_id
      and a.percentage is not null
      and a.status <> 'in_progress'
    order by a.student_id, a.percentage desc, a.started_at
  ) best
  on conflict (student_id, period_id, source_type, source_id)
  do update set
    points = excluded.points,
    verification_status = 'verified';

  get diagnostics awarded = row_count;
  return awarded;
end;
$$;

revoke execute on function public.academy_exam_sync_leaderboard(uuid) from public, anon;

create or replace function public.academy_exam_publish_results(p_exam_id uuid, p_publish boolean default true)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.academy_is_teacher() then
    raise exception 'Only teachers can publish examination results.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.academy_exams where id = p_exam_id) then
    raise exception 'Examination not found.' using errcode = 'P0002';
  end if;

  update public.academy_exams
  set results_published = coalesce(p_publish, false),
      status = case when coalesce(p_publish, false) then 'results_published'
                    when status = 'results_published' then 'graded'
                    else status end,
      updated_at = now()
  where id = p_exam_id;

  insert into public.academy_exam_events (exam_id, actor_id, action, metadata)
  values (p_exam_id, auth.uid(),
          case when coalesce(p_publish, false) then 'results_published' else 'results_unpublished' end,
          jsonb_build_object('at', now()));

  perform public.academy_exam_sync_leaderboard(p_exam_id);

  return true;
end;
$$;
