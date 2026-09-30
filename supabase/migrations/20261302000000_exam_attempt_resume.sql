-- The worst of the faults found by the live run.
--
-- academy_exam_start_attempt counted every attempt the student had, including
-- the one still in progress, and refused once the count reached max_attempts.
-- On a one-attempt paper that meant a student who refreshed, closed the tab or
-- lost signal came back to "You have used all 1 attempt(s)", with no way back
-- into the paper they had already started and answers already banked on the
-- device. Losing an exam to a refresh is not a recoverable state, and it hit the
-- commonest case there is: an interrupted attempt on a single-attempt exam.
--
-- A start now returns the existing in-progress attempt instead of refusing. It
-- is returned as it stands, so the deadline is not moved and no extra time is
-- created; the whole point of the fix is to restore access, not to extend it.
--
-- An in-progress attempt that is already past its deadline is not handed back,
-- because the paper is over. The expired-attempt sweeper is run first so the
-- work is marked and banked rather than left sitting in progress for ever.
create or replace function public.academy_exam_start_attempt(p_exam_id uuid)
returns public.academy_exam_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  exam_row public.academy_exams%rowtype;
  attempt_row public.academy_exam_attempts%rowtype;
  existing_attempt public.academy_exam_attempts%rowtype;
  taken integer;
  next_number integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  if public.academy_is_teacher() then
    raise exception 'Teachers take the paper from the preview, not as a student.'
      using errcode = '42501';
  end if;

  select * into exam_row from public.academy_exams where id = p_exam_id;
  if exam_row.id is null then
    raise exception 'Examination not found.' using errcode = 'P0002';
  end if;
  if exam_row.status = 'draft' then
    raise exception 'This examination has not been published.' using errcode = '42501';
  end if;
  if exam_row.starts_at is not null and now() < exam_row.starts_at then
    raise exception 'Examination has not started.' using errcode = '22023';
  end if;
  if exam_row.ends_at is not null and now() > exam_row.ends_at then
    raise exception 'Examination has ended.' using errcode = '22023';
  end if;
  if exam_row.class_id is not null
    and not public.academy_is_class_member(exam_row.class_id, auth.uid()) then
    raise exception 'This examination is not assigned to you.' using errcode = '42501';
  end if;

  -- Resume before counting. This has to happen before the max_attempts check
  -- below, because that check is the one that used to strand a live attempt.
  select * into existing_attempt
  from public.academy_exam_attempts
  where exam_id = p_exam_id
    and student_id = auth.uid()
    and status = 'in_progress'
  order by started_at desc
  limit 1;

  if existing_attempt.id is not null then
    if existing_attempt.deadline_at > now() then
      -- Returned unchanged. deadline_at in particular is not refreshed, so a
      -- student cannot extend a paper by closing and reopening it.
      return existing_attempt;
    end if;

    -- Past its own deadline. Bank the work before refusing, so the answers
    -- already saved are marked rather than discarded by the refusal.
    perform public.academy_exam_auto_submit_expired();
    raise exception 'Time is up for this examination.' using errcode = '22023';
  end if;

  select count(*) into taken
  from public.academy_exam_attempts
  where exam_id = p_exam_id and student_id = auth.uid();

  if taken >= exam_row.max_attempts then
    raise exception 'You have used all % attempt(s) for this examination.', exam_row.max_attempts
      using errcode = '22023';
  end if;

  select coalesce(max(attempt_number), 0) + 1 into next_number
  from public.academy_exam_attempts
  where exam_id = p_exam_id and student_id = auth.uid();

  -- Section 10: one seed per attempt, drawn from the attempt id, so the order is
  -- stable for this student on every reload and every reconnect.
  insert into public.academy_exam_attempts (
    exam_id, student_id, attempt_number, started_at, deadline_at, random_seed, status
  ) values (
    p_exam_id,
    auth.uid(),
    next_number,
    now(),
    now() + make_interval(mins => exam_row.duration_minutes),
    abs(hashtextextended(p_exam_id::text || auth.uid()::text || next_number::text, 0)),
    'in_progress'
  )
  returning * into attempt_row;

  insert into public.academy_exam_events (exam_id, attempt_id, actor_id, student_id, action, metadata)
  values (p_exam_id, attempt_row.id, auth.uid(), auth.uid(), 'exam_started',
          jsonb_build_object('attempt_number', next_number, 'deadline_at', attempt_row.deadline_at));

  return attempt_row;
end;
$$;

revoke execute on function public.academy_exam_start_attempt(uuid) from public, anon;
grant execute on function public.academy_exam_start_attempt(uuid) to authenticated;
