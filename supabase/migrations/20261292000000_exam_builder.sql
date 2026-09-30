-- Assessment engine: building an exam.
--
-- Three things happen here that are easy to get wrong and are the difference
-- between a working exam and a broken one.
--
-- 1. Option keys are normalised on the way in. Whatever keys a question was
--    authored or imported with, the snapshot a student sees is always A, B, C,
--    D in order. A question stored with keys 1/2/3/4, or with True/False as
--    A/B, still arrives as a clean A/B/C or A/B, and the correct answer is
--    remapped to follow the option rather than staying put. Getting this wrong
--    is how an exam ends up with a correct answer pointing at a letter that is
--    not there.
--
-- 2. The snapshot is taken now, not at exam time. Editing a question afterwards
--    cannot change a paper a student has already sat.
--
-- 3. Publishing validates first. A missing answer key, too few options, a
--    duplicate, or a bad window stops publication and says which, per section 24.

-- Normalise a question into snapshot form with clean A, B, C, D keys.
create or replace function public.academy_exam_normalise_question(p_question_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  question_row public.academy_exam_questions%rowtype;
  keys text[];
  labels text[];
  clean_keys text[];
  clean_labels text[];
  out_options jsonb;
  correct_key text;
  i integer;
  answer_index integer;
begin
  select * into question_row from public.academy_exam_questions where id = p_question_id;
  if question_row.id is null then
    raise exception 'Question not found.' using errcode = 'P0002';
  end if;

  if question_row.question_type = 'true_false' then
    -- Always exactly True then False, so the letter a teacher picks is stable.
    out_options := '[{"key":"A","label":"True"},{"key":"B","label":"False"}]';
    correct_key := case
      when lower(coalesce(question_row.correct_key, '')) in ('b', 'false', 'no') then 'B'
      when lower(coalesce(question_row.correct_key, '')) in ('a', 'true', 'yes') then 'A'
      else null
    end;
  else
    select
      array_agg(e ->> 'key' order by ord),
      array_agg(btrim(coalesce(e ->> 'label', '')) order by ord)
    into keys, labels
    from jsonb_array_elements(question_row.options) with ordinality as t(e, ord)
    where btrim(coalesce(e ->> 'label', '')) <> '';

    if coalesce(array_length(labels, 1), 0) < 2 then
      raise exception 'A multiple choice question needs at least two filled in options.'
        using errcode = '22023';
    end if;

    clean_keys := '{}'::text[];
    clean_labels := '{}'::text[];
    for i in 1 .. array_length(labels, 1) loop
      clean_keys := array_append(clean_keys, chr(64 + i)::text);
      clean_labels := array_append(clean_labels, labels[i]);
    end loop;

    -- Find which option was right before the letters were rewritten, so the new
    -- letter is derived from the option itself and not from the old key.
    select j into answer_index
    from generate_subscripts(keys, 1) as j
    where upper(coalesce(keys[j], '')) = upper(coalesce(question_row.correct_key, ''))
       or lower(btrim(coalesce(labels[j], ''))) = lower(btrim(coalesce(question_row.correct_key, '')));

    if answer_index is null then
      raise exception 'That question has no answer key that matches one of its options.'
        using errcode = '22023';
    end if;
    correct_key := clean_keys[answer_index];

    select jsonb_agg(
             jsonb_build_object('key', clean_keys[i], 'label', clean_labels[i]) order by i)
      into out_options
    from generate_series(1, array_length(clean_labels, 1)) i;
  end if;

  return jsonb_build_object(
    'prompt', question_row.prompt,
    'options', out_options,
    'correct_key', correct_key,
    'question_type', question_row.question_type,
    'difficulty', question_row.difficulty,
    'topic', question_row.topic,
    'explanation', coalesce(question_row.explanation, '')
  );
end;
$$;

revoke execute on function public.academy_exam_normalise_question(uuid) from public, anon;

-- Create a draft exam. Draft means students cannot see it at all, which is what
-- section 16 asks for.
create or replace function public.academy_exam_create(
  p_title text,
  p_subject_id uuid default null,
  p_class_id uuid default null,
  p_level_id uuid default null,
  p_instructions text default '',
  p_duration_minutes integer default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_pass_mark numeric default null,
  p_randomize_questions boolean default false,
  p_randomize_options boolean default false,
  p_allow_review boolean default true,
  p_allow_early_submit boolean default true,
  p_max_attempts integer default 1
)
returns public.academy_exams
language plpgsql
security definer
set search_path = public
as $$
declare
  exam_row public.academy_exams%rowtype;
  chosen_duration integer := coalesce(p_duration_minutes, 20);
begin
  if not public.academy_is_teacher() then
    raise exception 'Only teachers can create an examination.' using errcode = '42501';
  end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'An examination needs a title.' using errcode = '22023';
  end if;
  if chosen_duration < 1 or chosen_duration > 600 then
    raise exception 'The duration must be between 1 and 600 minutes.' using errcode = '22023';
  end if;

  insert into public.academy_exams (
    title, subject_id, class_id, level_id, instructions, duration_minutes,
    starts_at, ends_at, pass_mark, randomize_questions, randomize_options,
    allow_review, allow_early_submit, max_attempts, status, created_by
  ) values (
    btrim(p_title), p_subject_id, p_class_id, p_level_id,
    coalesce(p_instructions, ''), chosen_duration,
    coalesce(p_starts_at, now() + interval '1 day'), p_ends_at, p_pass_mark,
    coalesce(p_randomize_questions, false), coalesce(p_randomize_options, false),
    coalesce(p_allow_review, true), coalesce(p_allow_early_submit, true),
    coalesce(p_max_attempts, 1), 'draft', auth.uid()
  )
  returning * into exam_row;

  insert into public.academy_exam_events (exam_id, actor_id, action)
  values (exam_row.id, auth.uid(), 'exam_created');

  return exam_row;
end;
$$;

revoke execute on function public.academy_exam_create(text, uuid, uuid, uuid, text, integer, timestamptz, timestamptz, numeric, boolean, boolean, boolean, boolean, integer) from public, anon;
grant execute on function public.academy_exam_create(text, uuid, uuid, uuid, text, integer, timestamptz, timestamptz, numeric, boolean, boolean, boolean, boolean, integer) to authenticated;

-- Add one question. Rejects a duplicate rather than adding it twice, because a
-- paper with the same question in it twice is worse than a short paper.
create or replace function public.academy_exam_add_question(
  p_exam_id uuid,
  p_question_id uuid
)
returns public.academy_exam_question_links
language plpgsql
security definer
set search_path = public
as $$
declare
  exam_row public.academy_exams%rowtype;
  link_row public.academy_exam_question_links%rowtype;
  next_position integer;
  snap jsonb;
begin
  if not public.academy_is_teacher() then
    raise exception 'Only teachers can build an examination.' using errcode = '42501';
  end if;

  select * into exam_row from public.academy_exams where id = p_exam_id;
  if exam_row.id is null then
    raise exception 'Examination not found.' using errcode = 'P0002';
  end if;
  if exam_row.status <> 'draft' then
    raise exception 'Questions can only be changed while the examination is a draft.'
      using errcode = '42501';
  end if;
  if exists (select 1 from public.academy_exam_question_links
              where exam_id = p_exam_id and question_id = p_question_id) then
    raise exception 'That question is already in this examination.' using errcode = '22023';
  end if;

  select coalesce(max(position), 0) + 1 into next_position
  from public.academy_exam_question_links where exam_id = p_exam_id;

  snap := public.academy_exam_normalise_question(p_question_id);

  insert into public.academy_exam_question_links (exam_id, question_id, position, marks, snapshot)
  values (p_exam_id, p_question_id, next_position, 1, snap)
  returning * into link_row;

  return link_row;
end;
$$;

-- Add many at once, for automatic selection. Rows that cannot be added are
-- reported rather than silently dropped, so a teacher asking for ten questions
-- and getting six knows why.
create or replace function public.academy_exam_add_questions(
  p_exam_id uuid,
  p_question_ids uuid[]
)
returns table (question_id uuid, added boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_position integer;
  failure text;
  linked uuid;
begin
  if not public.academy_is_teacher() then
    raise exception 'Only teachers can build an examination.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.academy_exams
                  where id = p_exam_id and status = 'draft') then
    raise exception 'Questions can only be changed while the examination is a draft.'
      using errcode = '42501';
  end if;

  foreach linked in array coalesce(p_question_ids, '{}'::uuid[]) loop
    next_position := coalesce((
      select max(position) + 1 from public.academy_exam_question_links
       where exam_id = p_exam_id), 1);
    failure := null;
    begin
      if exists (select 1 from public.academy_exam_question_links
                  where exam_id = p_exam_id and question_id = linked) then
        raise exception 'Already in this examination.';
      end if;
      insert into public.academy_exam_question_links
        (exam_id, question_id, position, marks, snapshot)
      values (p_exam_id, linked, next_position, 1,
              public.academy_exam_normalise_question(linked));
    exception when others then
      failure := sqlerrm;
    end;
    return query select linked, failure is null, failure;
  end loop;
end;
$$;

revoke execute on function public.academy_exam_add_question(uuid, uuid) from public, anon;
revoke execute on function public.academy_exam_add_questions(uuid, uuid[]) from public, anon;
grant execute on function public.academy_exam_add_question(uuid, uuid) to authenticated;
grant execute on function public.academy_exam_add_questions(uuid, uuid[]) to authenticated;

-- Fill the exam from a difficulty and type mix. Separate from the reporting
-- query above so the teacher gets a real insert rather than a count.
create or replace function public.academy_exam_fill_from_mix(
  p_exam_id uuid,
  p_difficulty_counts jsonb,
  p_type_counts jsonb default null,
  p_subject_id uuid default null,
  p_topic text default null
)
returns table (added integer, short_by text)
language plpgsql
security definer
set search_path = public
as $$
declare
  link_row public.academy_exam_question_links%rowtype;
  picked uuid[];
  want_row record;
  total_added integer := 0;
  shortfall text;
begin
  if not public.academy_is_teacher() then
    raise exception 'Only teachers can build an examination.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.academy_exams
                  where id = p_exam_id and status = 'draft') then
    raise exception 'Questions can only be changed while the examination is a draft.'
      using errcode = '42501';
  end if;

  for want_row in
    select d.key as difficulty, t.key as question_type, t.value::integer as n
    from jsonb_each_text(coalesce(p_difficulty_counts, '{}'::jsonb)) as d(key, value)
    cross join lateral (
      select key, value from jsonb_each_text(
        case
          when coalesce(p_type_counts, '{}'::jsonb) = '{}'::jsonb
            then jsonb_build_object('mcq', d.value, 'true_false', d.value)
          else p_type_counts
        end
      )
    ) as t(key, value)
  loop
    select coalesce(array_agg(q.id), '{}'::uuid[]) into picked
    from (
      select id from public.academy_exam_questions cand
      where cand.status = 'active'
        and cand.difficulty = want_row.difficulty
        and cand.question_type = want_row.question_type
        and (p_subject_id is null or cand.subject_id = p_subject_id)
        and (p_topic is null or btrim(p_topic) = '' or lower(cand.topic) = lower(p_topic))
        and not exists (
          select 1 from public.academy_exam_question_links link
           where link.exam_id = p_exam_id and link.question_id = cand.id
        )
      order by cand.created_at desc, cand.id
      limit want_row.n
    ) q;

    if coalesce(array_length(picked, 1), 0) < want_row.n then
      shortfall := coalesce(shortfall, '') ||
        want_row.difficulty || '/' || want_row.question_type ||
        ' wanted ' || want_row.n || ' found ' || coalesce(array_length(picked, 1), 0) || '; ';
    end if;

    for link_row in select * from public.academy_exam_add_questions(p_exam_id, picked) loop
      if link_row.added is not null then
        total_added := total_added + 1;
      end if;
    end loop;
  end loop;

  return query select total_added, nullif(shortfall, '');
end;
$$;

create or replace function public.academy_exam_remove_question(
  p_exam_id uuid,
  p_question_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.academy_is_teacher() then
    raise exception 'Only teachers can build an examination.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.academy_exams where id = p_exam_id and status = 'draft') then
    raise exception 'Questions can only be changed while the examination is a draft.'
      using errcode = '42501';
  end if;
  delete from public.academy_exam_question_links
   where exam_id = p_exam_id and question_id = p_question_id;
  return found;
end;
$$;

-- Publish, but only if academy_exam_validate comes back clean. Refuses rather
-- than publishes something broken, and says why.
create or replace function public.academy_exam_publish(p_exam_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  exam_row public.academy_exams%rowtype;
  issue record;
  problems text := '';
begin
  if not public.academy_is_teacher() then
    raise exception 'Only teachers can publish an examination.' using errcode = '42501';
  end if;
  select * into exam_row from public.academy_exams where id = p_exam_id;
  if exam_row.id is null then
    raise exception 'Examination not found.' using errcode = 'P0002';
  end if;
  if exam_row.status <> 'draft' then
    raise exception 'This examination is not a draft.' using errcode = '42501';
  end if;

  for issue in select * from public.academy_exam_validate(p_exam_id) loop
    problems := problems || issue.problem || ': ' || issue.detail || '; ';
  end loop;
  if problems <> '' then
    raise exception 'This examination is not ready to publish. %', problems
      using errcode = '22023';
  end if;

  -- Scheduled or active depending on when it opens. Availability is always
  -- decided by the clock at request time regardless, so this is only a label
  -- for the admin list.
  update public.academy_exams
  set status = case when starts_at <= now() then 'active' else 'scheduled' end,
      updated_at = now()
  where id = p_exam_id;

  insert into public.academy_exam_events (exam_id, actor_id, action, metadata)
  values (p_exam_id, auth.uid(), 'exam_published',
          jsonb_build_object('starts_at', exam_row.starts_at));

  return 'published';
end;
$$;

revoke execute on function public.academy_exam_remove_question(uuid, uuid) from public, anon;
revoke execute on function public.academy_exam_publish(uuid) from public, anon;
revoke execute on function public.academy_exam_fill_from_mix(uuid, jsonb, jsonb, uuid, text) from public, anon;
grant execute on function public.academy_exam_remove_question(uuid, uuid) to authenticated;
grant execute on function public.academy_exam_publish(uuid) to authenticated;
grant execute on function public.academy_exam_fill_from_mix(uuid, jsonb, jsonb, uuid, text) to authenticated;

notify pgrst, 'reload schema';
