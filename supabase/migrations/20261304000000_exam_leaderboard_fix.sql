-- academy_ensure_active_week_period() returns the whole academy_leaderboard_periods
-- row, not a uuid, so passing it straight into period_id failed at runtime with
-- a type error. Nothing about it was caught by the migration being applied
-- cleanly: the body only runs when results are released, and the E2E run is what
-- found it.
--
-- The same run also showed the coupling was wrong. academy_exam_publish_results
-- called the award function directly, so this one type error stopped a teacher
-- releasing marks at all. Marks are the important thing; the leaderboard is a
-- display concern built on top of them. So the award is now isolated: if it
-- fails, the marks are still released and the failure is written to the audit
-- log, where a teacher can see that the board is out of step rather than
-- discovering it as a student missing points with no explanation.

create or replace function public.academy_exam_sync_leaderboard(p_exam_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  awarded integer := 0;
  v_period_id uuid;
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

  -- The row type, not the uuid. See the note at the top of this migration.
  select (public.academy_ensure_active_week_period()).id into v_period_id;

  if v_period_id is null then
    return 0;
  end if;

  -- Best attempt per student. percentage is set by the submit function, so only
  -- graded rows are considered and a null percentage is skipped rather than
  -- counted as zero.
  insert into public.academy_leaderboard_points
    (student_id, period_id, source_type, source_id, source_label, points, verification_status)
  select
    best.student_id,
    v_period_id,
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

  -- Isolated on purpose. A fault in the award must not stop marks being
  -- released, so it is caught and recorded rather than allowed to abort.
  begin
    perform public.academy_exam_sync_leaderboard(p_exam_id);
  exception when others then
    insert into public.academy_exam_events (exam_id, actor_id, action, metadata)
    values (p_exam_id, auth.uid(), 'leaderboard_sync_failed',
            jsonb_build_object('at', now(), 'error', sqlerrm));
  end;

  return true;
end;
$$;
