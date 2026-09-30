-- Assessment engine: attempt lifecycle and grading.
--
-- Every rule in section 17 is enforced here rather than in the browser:
-- timing, attempt limits, submission validity, result visibility and the
-- correct answers. The client is told a deadline and counts down from it, but
-- nothing it sends can change whether a submission counts.
--
-- Section 8: an offline answer syncing late is recorded with the student's own
-- clock for the audit trail, but validity is decided by the server deadline. A
-- queue that arrives after the deadline is still accepted into the record as a
-- timeout submission, which is what stops a flaky network from being mistaken
-- for cheating.

-- Is this exam open to this student right now? Server time only.
create or replace function public.academy_exam_window_is_open(p_exam_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.academy_exams e
    where e.id = p_exam_id
      and e.status in ('scheduled', 'active')
      and now() >= e.starts_at
      and (e.ends_at is null or now() <= e.ends_at)
      and (
        e.class_id is null
        or public.academy_is_class_member(e.class_id, auth.uid())
        or public.academy_is_teacher()
      )
  );
$$;

-- Section 6: start an attempt. The deadline is computed here from the exam's
-- own duration and never accepted from the client, so a student who changes
-- their computer clock gains nothing.
create or replace function public.academy_exam_start_attempt(p_exam_id uuid)
returns public.academy_exam_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  exam_row public.academy_exams%rowtype;
  attempt_row public.academy_exam_attempts%rowtype;
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
  if now() < exam_row.starts_at then
    raise exception 'Examination has not started.' using errcode = '22023';
  end if;
  if exam_row.ends_at is not null and now() > exam_row.ends_at then
    raise exception 'Examination has ended.' using errcode = '22023';
  end if;
  if exam_row.class_id is not null
     and not public.academy_is_class_member(exam_row.class_id, auth.uid()) then
    raise exception 'This examination is not assigned to you.' using errcode = '42501';
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

-- Section 9: the paper. Deliberately does not return correct_key or the
-- explanation, and cannot be coerced into it, because this is the only function
-- a student's browser ever reads.
create or replace function public.academy_exam_paper(p_attempt_id uuid)
returns table (
  question_id uuid,
  -- Named question_position because POSITION is reserved in SQL.
  question_position integer,
  prompt text,
  options jsonb,
  marks numeric,
  is_answered boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  attempt_row public.academy_exam_attempts%rowtype;
  exam_row public.academy_exams%rowtype;
  shuffled jsonb;
begin
  select * into attempt_row from public.academy_exam_attempts where id = p_attempt_id;
  if attempt_row.id is null then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;
  if attempt_row.student_id <> auth.uid() and not public.academy_is_teacher() then
    raise exception 'That attempt is not yours.' using errcode = '42501';
  end if;
  if attempt_row.status <> 'in_progress' then
    raise exception 'This attempt is already submitted.' using errcode = '42501';
  end if;
  if now() > attempt_row.deadline_at then
    raise exception 'Time is up for this attempt.' using errcode = '22023';
  end if;

  select * into exam_row from public.academy_exams where id = attempt_row.exam_id;

  -- Section 10, deterministic: the same attempt always produces the same order,
  -- so a refresh cannot reshuffle the paper under the student.
  select coalesce(jsonb_agg(link.question_id order by
             case when exam_row.randomize_questions
               then abs(hashtextextended(link.question_id::text || attempt_row.random_seed::text, 0))
               else link.position end,
             link.position), '[]'::jsonb)
  into shuffled
  from public.academy_exam_question_links link
  where link.exam_id = attempt_row.exam_id;

  return query
  with ordered as (
    select link.question_id, link.position, link.marks, link.snapshot
    from public.academy_exam_question_links link
    where link.exam_id = attempt_row.exam_id
  )
  select
    o.question_id,
    row_number() over (order by o.rank)::integer as question_position,
    o.snapshot ->> 'prompt',
    -- Option order is shuffled inside the snapshot when the exam asks for it,
    -- using the same attempt seed so it stays put for this student.
    case when exam_row.randomize_options then
      (select jsonb_agg(elem order by
          abs(hashtextextended((elem ->> 'key') || attempt_row.random_seed::text || o.question_id::text, 0)))
       from jsonb_array_elements(o.snapshot -> 'options') elem)
    else o.snapshot -> 'options' end,
    o.marks,
    exists (
      select 1 from public.academy_exam_answers a
      where a.attempt_id = p_attempt_id and a.question_id = o.question_id
    )
  from ordered o
  join lateral (
    select o2.question_id,
      case when exam_row.randomize_questions
        then abs(hashtextextended(o2.question_id::text || attempt_row.random_seed::text, 0))
        else o2.position end as rank
    from (select question_id, position from public.academy_exam_question_links
           where exam_id = attempt_row.exam_id) o2
  ) r on r.question_id = o.question_id
  order by r.rank, o.position;
end;
$$;

-- Section 7: progressive save, one request per answer change rather than a poll.
-- Section 8: a queued answer from an offline stretch syncs, and last write wins
-- on the client's own timestamp so a stale queued answer cannot overwrite a
-- newer one.
create or replace function public.academy_exam_save_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_key text,
  p_client_answered_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_row public.academy_exam_attempts%rowtype;
  existing public.academy_exam_answers%rowtype;
  valid_key text;
begin
  select * into attempt_row from public.academy_exam_attempts where id = p_attempt_id;
  if attempt_row.id is null then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;
  if attempt_row.student_id <> auth.uid() then
    raise exception 'That attempt is not yours.' using errcode = '42501';
  end if;
  if attempt_row.status <> 'in_progress' then
    raise exception 'This attempt is already submitted.' using errcode = '42501';
  end if;
  if now() > attempt_row.deadline_at then
    raise exception 'Time is up for this attempt.' using errcode = '22023';
  end if;

  -- The question has to belong to this exam, so a student cannot park answers
  -- against questions nobody asked them.
  select snapshot ->> 'correct_key' into valid_key
  from public.academy_exam_question_links
  where exam_id = attempt_row.exam_id and question_id = p_question_id;
  if valid_key is null then
    raise exception 'That question is not part of this examination.' using errcode = '42501';
  end if;

  if p_selected_key is not null and exists (
    select 1 from jsonb_array_elements(
      (select snapshot -> 'options' from public.academy_exam_question_links
        where exam_id = attempt_row.exam_id and question_id = p_question_id)
    ) elem
    where elem ->> 'key' <> p_selected_key
  ) then
    -- The chosen key is not one of the options, so it cannot be marked. Refused
    -- rather than silently stored as wrong.
    raise exception 'That answer is not one of the options.' using errcode = '22023';
  end if;

  select * into existing from public.academy_exam_answers
  where attempt_id = p_attempt_id and question_id = p_question_id;

  -- Last write wins on the student's own clock, so a queued offline answer that
  -- is older than what is already stored is dropped instead of undoing it.
  if existing.id is not null and p_client_answered_at is not null
     and existing.client_answered_at is not null
     and existing.client_answered_at > p_client_answered_at then
    return false;
  end if;

  insert into public.academy_exam_answers (
    attempt_id, question_id, selected_key, client_answered_at
  ) values (p_attempt_id, p_question_id, p_selected_key, p_client_answered_at)
  on conflict (attempt_id, question_id) do update
    set selected_key = excluded.selected_key,
        client_answered_at = excluded.client_answered_at,
        updated_at = now();

  return true;
end;
$$;

-- Section 11 and 7: submit, or be submitted automatically at zero. Grading
-- happens here against the snapshot, so the key is read inside the database and
-- never travels to the client.
create or replace function public.academy_exam_submit_attempt(
  p_attempt_id uuid,
  p_reason text default 'student',
  p_client_submitted_at timestamptz default null
)
returns public.academy_exam_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_row public.academy_exam_attempts%rowtype;
  exam_row public.academy_exams%rowtype;
  marks_total numeric := 0;
  marks_scored numeric := 0;
  got_correct integer := 0;
  got_wrong integer := 0;
  effective_reason text;
begin
  select * into attempt_row from public.academy_exam_attempts where id = p_attempt_id
    for update;
  if attempt_row.id is null then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;
  if attempt_row.student_id <> auth.uid() and not public.academy_is_teacher() then
    raise exception 'That attempt is not yours.' using errcode = '42501';
  end if;
  if attempt_row.status <> 'in_progress' then
    return attempt_row;  -- already submitted, grading is idempotent
  end if;

  select * into exam_row from public.academy_exams where id = attempt_row.exam_id;

  -- The server clock decides. The student's own clock is kept for the record.
  effective_reason := case
    when now() > attempt_row.deadline_at then 'timeout'
    when p_reason = 'admin' then 'admin'
    else 'student'
  end;

  -- allow_early_submit false means the paper is not handable back early, so the
  -- attempt is graded by the sweep at the deadline instead. Honouring the
  -- setting matters: an exam that looks like it can be submitted early and then
  -- refuses is worse than one that says so up front.
  if effective_reason = 'student' and not exam_row.allow_early_submit then
    raise exception 'This examination cannot be submitted early. It will be submitted for you when time runs out.'
      using errcode = '42501';
  end if;

  select coalesce(sum(link.marks), 0) into marks_total
  from public.academy_exam_question_links link
  where link.exam_id = attempt_row.exam_id;

  -- Grade from the snapshot, so a later edit to the bank cannot change this.
  with graded as (
    select
      link.question_id,
      link.marks,
      link.snapshot ->> 'correct_key' as correct_key,
      answer.selected_key
    from public.academy_exam_question_links link
    left join public.academy_exam_answers answer
      on answer.attempt_id = p_attempt_id and answer.question_id = link.question_id
    where link.exam_id = attempt_row.exam_id
  )
  update public.academy_exam_answers a
     set is_correct = case
           when g.selected_key is null then null
           when g.selected_key = g.correct_key then true
           else false end,
         marks_awarded = case
           when g.selected_key is null then 0
           when g.selected_key = g.correct_key then g.marks
           else 0 end,
         updated_at = now()
    from graded g
   where a.attempt_id = p_attempt_id and a.question_id = g.question_id;

  select
    count(*) filter (where a.is_correct is true),
    count(*) filter (where a.is_correct is false),
    coalesce(sum(a.marks_awarded), 0)
  into got_correct, got_wrong, marks_scored
  from public.academy_exam_answers a
  where a.attempt_id = p_attempt_id;

  update public.academy_exam_attempts
  set status = 'graded',
      submitted_at = now(),
      submit_reason = effective_reason,
      client_submitted_at = p_client_submitted_at,
      synced_at = now(),
      score = marks_scored,
      total_marks = marks_total,
      correct_count = got_correct,
      incorrect_count = got_wrong,
      unanswered_count = (select count(*) from public.academy_exam_question_links
                          where exam_id = attempt_row.exam_id) - got_correct - got_wrong,
      percentage = case when marks_total > 0
                        then round((marks_scored / marks_total) * 100, 2)
                        else 0 end,
      graded_at = now()
  where id = p_attempt_id
  returning * into attempt_row;

  update public.academy_exams
  set status = 'graded' where id = attempt_row.exam_id and status in ('active', 'closed', 'scheduled');

  insert into public.academy_exam_events (exam_id, attempt_id, actor_id, student_id, action, metadata)
  values (attempt_row.exam_id, attempt_row.id, auth.uid(), attempt_row.student_id,
          case when effective_reason = 'timeout' then 'exam_auto_submitted' else 'exam_submitted' end,
          jsonb_build_object('reason', effective_reason,
                             'client_submitted_at', p_client_submitted_at,
                             'server_submitted_at', attempt_row.submitted_at));

  return attempt_row;
end;
$$;

-- Section 7: sweep attempts whose deadline has passed. Safe to call on a timer
-- and safe to call twice; grading is idempotent.
create or replace function public.academy_exam_auto_submit_expired()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  row record;
  done integer := 0;
begin
  for row in
    select id from public.academy_exam_attempts
     where status = 'in_progress' and deadline_at < now()
  loop
    -- Submit as the student so the authorisation inside holds, then it cannot
    -- save a further answer.
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', (select student_id from public.academy_exam_attempts where id = row.id)::text)::text,
      true
    );
    begin
      perform public.academy_exam_submit_attempt(row.id, 'timeout');
      done := done + 1;
    exception when others then
      null;  -- one bad attempt must not stop the sweep
    end;
  end loop;
  return done;
end;
$$;

-- Section 12: results stay hidden until a teacher says otherwise. This is the
-- only student facing read of a score, and it refuses while hidden.
create or replace function public.academy_exam_student_result(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  attempt_row public.academy_exam_attempts%rowtype;
  exam_row public.academy_exams%rowtype;
begin
  select * into attempt_row from public.academy_exam_attempts where id = p_attempt_id;
  if attempt_row.id is null then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;
  if attempt_row.student_id <> auth.uid() and not public.academy_is_teacher() then
    raise exception 'That attempt is not yours.' using errcode = '42501';
  end if;

  select * into exam_row from public.academy_exams where id = attempt_row.exam_id;

  -- Section 12. No score, no percentage, no ranking, nothing.
  if not exam_row.results_published and not public.academy_is_teacher() then
    return jsonb_build_object(
      'attempt_id', attempt_row.id,
      'status', attempt_row.status,
      'results_published', false,
      'submitted_at', attempt_row.submitted_at
    );
  end if;

  return jsonb_build_object(
    'attempt_id', attempt_row.id,
    'status', attempt_row.status,
    'results_published', true,
    'score', attempt_row.score,
    'total_marks', attempt_row.total_marks,
    'percentage', attempt_row.percentage,
    'correct', attempt_row.correct_count,
    'incorrect', attempt_row.incorrect_count,
    'unanswered', attempt_row.unanswered_count,
    'submitted_at', attempt_row.submitted_at,
    'duration_used_seconds', extract(epoch from (attempt_row.submitted_at - attempt_row.started_at))::integer
  );
end;
$$;

-- Section 12: publish or withdraw results for a whole examination at once.
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

  return true;
end;
$$;

-- Section 24: refuse to publish a broken exam, and say which part is broken.
create or replace function public.academy_exam_validate(p_exam_id uuid)
returns table (problem text, detail text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  exam_row public.academy_exams%rowtype;
  question_count integer;
begin
  select * into exam_row from public.academy_exams where id = p_exam_id;
  if exam_row.id is null then
    raise exception 'Examination not found.' using errcode = 'P0002';
  end if;

  select count(*) into question_count
  from public.academy_exam_question_links where exam_id = p_exam_id;

  if question_count = 0 then
    return query select 'no_questions', 'The examination has no questions.';
  end if;

  if exam_row.duration_minutes is null or exam_row.duration_minutes < 1 then
    return query select 'bad_duration', 'Duration must be greater than zero.';
  end if;

  if exam_row.starts_at is null then
    return query select 'bad_start', 'A start date and time is required.';
  end if;

  if exam_row.ends_at is not null and exam_row.ends_at <= exam_row.starts_at then
    return query select 'bad_window', 'The closing time must be after the start time.';
  end if;

  if exam_row.class_id is not null
     and not exists (select 1 from public.academy_classes where id = exam_row.class_id) then
    return query select 'bad_class', 'The assigned class does not exist.';
  end if;

  return query
    select 'question_missing_key', 'Question ' || link.position || ' has no correct answer.'
    from public.academy_exam_question_links link
    where link.exam_id = p_exam_id
      and (link.snapshot ->> 'correct_key') is null;

  return query
    select 'question_mcq_options', 'Question ' || link.position || ' does not have valid options.'
    from public.academy_exam_question_links link
    where link.exam_id = p_exam_id
      and (link.snapshot ->> 'question_type') = 'mcq'
      and coalesce(jsonb_array_length(link.snapshot -> 'options'), 0) < 2;

  return query
    select 'question_archived', 'Question ' || link.position || ' has been archived.'
    from public.academy_exam_question_links link
    join public.academy_exam_questions q on q.id = link.question_id
    where link.exam_id = p_exam_id and q.status = 'archived';

  return query
    select 'duplicate_question', 'Question ' || link.position || ' appears more than once.'
    from public.academy_exam_question_links link
    where link.exam_id = p_exam_id
    group by link.question_id, link.position
    having count(*) > 1;
end;
$$;

revoke execute on function public.academy_exam_start_attempt(uuid) from public, anon;
revoke execute on function public.academy_exam_paper(uuid) from public, anon;
revoke execute on function public.academy_exam_save_answer(uuid, uuid, text, timestamptz) from public, anon;
revoke execute on function public.academy_exam_submit_attempt(uuid, text, timestamptz) from public, anon;
revoke execute on function public.academy_exam_student_result(uuid) from public, anon;
revoke execute on function public.academy_exam_publish_results(uuid, boolean) from public, anon;
revoke execute on function public.academy_exam_validate(uuid) from public, anon;
revoke execute on function public.academy_exam_window_is_open(uuid) from public, anon;
revoke execute on function public.academy_exam_auto_submit_expired() from public, anon, authenticated;

grant execute on function public.academy_exam_start_attempt(uuid) to authenticated;
grant execute on function public.academy_exam_paper(uuid) to authenticated;
grant execute on function public.academy_exam_save_answer(uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.academy_exam_submit_attempt(uuid, text, timestamptz) to authenticated;
grant execute on function public.academy_exam_student_result(uuid) to authenticated;
grant execute on function public.academy_exam_publish_results(uuid, boolean) to authenticated;
grant execute on function public.academy_exam_validate(uuid) to authenticated;
grant execute on function public.academy_exam_window_is_open(uuid) to authenticated;

notify pgrst, 'reload schema';
