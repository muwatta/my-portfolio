create or replace function public.academy_award_lesson_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed_at is not null
    and (old.completed_at is null or old.completed_at is distinct from new.completed_at)
  then
    perform public.academy_award_verified_activity(
      new.student_id,
      'lesson',
      new.lesson_id,
      5,
      'first-lesson'
    );
  end if;
  return new;
end;
$$;

create or replace function public.academy_award_practice_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.passed > 0
    and not exists (
      select 1
      from public.academy_leaderboard_points points
      where points.student_id = new.student_id
        and points.source_type = 'practice'
        and (
          points.source_id = new.exercise_id
          or exists (
            select 1
            from public.academy_exercise_attempts prior_attempt
            where prior_attempt.id = points.source_id
              and prior_attempt.exercise_id = new.exercise_id
          )
        )
    )
  then
    perform public.academy_award_verified_activity(
      new.student_id,
      'practice',
      new.exercise_id,
      2,
      'first-practice'
    );
  end if;
  return new;
end;
$$;

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
    delete from public.academy_leaderboard_points
    where source_type = 'exam' and source_id = p_exam_id;
    return 0;
  end if;

  select (public.academy_ensure_active_week_period()).id into v_period_id;
  if v_period_id is null then
    return 0;
  end if;

  insert into public.academy_leaderboard_points
    (student_id, period_id, source_type, source_id, source_label, points, verification_status)
  select
    best.student_id,
    v_period_id,
    'exam',
    p_exam_id,
    '',
    greatest(1, round(best.percentage / 10.0))::integer,
    'verified'
  from (
    select distinct on (attempt.student_id)
      attempt.student_id,
      attempt.percentage
    from public.academy_exam_attempts attempt
    where attempt.exam_id = p_exam_id
      and attempt.percentage is not null
      and attempt.status <> 'in_progress'
    order by attempt.student_id, attempt.percentage desc, attempt.started_at
  ) best
  on conflict (student_id, period_id, source_type, source_id)
  do update set
    points = excluded.points,
    verification_status = 'verified';

  get diagnostics awarded = row_count;
  return awarded;
end;
$$;

revoke execute on function public.academy_award_lesson_points()
  from public, anon, authenticated;
revoke execute on function public.academy_award_practice_points()
  from public, anon, authenticated;
revoke execute on function public.academy_exam_sync_leaderboard(uuid)
  from public, anon;
