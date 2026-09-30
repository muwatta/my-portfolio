-- Assessment engine: CSV question import.
--
-- Section 3, and validated on the server rather than in the browser, so the
-- report the teacher reads is the same one that decides what is written.
--
-- The importer is a dry run by default. Nothing is inserted until a teacher asks
-- for it, because a half correct file that imports anyway is how a question
-- bank ends up full of questions with no answer key.
--
-- Duplicates are detected on a fingerprint of the normalised prompt rather than
-- on the whole row, so a file re-uploaded a week later is reported as already
-- present instead of silently doubling the bank. An administrator can still
-- override that per import, because genuinely the same question can be wanted
-- for two subjects.

create or replace function public.academy_exam_normalise_prompt(p_text text)
returns text
language sql
immutable
as $$
  select md5(lower(regexp_replace(trim(coalesce(p_text, '')), '\s+', ' ', 'g')));
$$;

-- Parse and check, without writing anything.
--
-- p_csv is the raw file contents. Columns are matched by header name so a
-- teacher can add columns or reorder them, and the accepted names are the ones
-- in section 3 plus a couple of obvious synonyms.
create or replace function public.academy_exam_preview_csv(
  p_csv text,
  p_default_subject_id uuid default null,
  p_allow_duplicates boolean default false
)
returns table (
  row_number integer,
  is_valid boolean,
  problems text[],
  prompt text,
  question_type text,
  options jsonb,
  correct_key text,
  marks numeric,
  subject_id uuid,
  topic text,
  difficulty text,
  is_duplicate boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  header_line text;
  lines text[];
  headers text[];
  raws text[][];
  row_index integer;
  cell text;
  problems_list text[];
  get_value text;
  found boolean;
  dup boolean;
  subject_uuid uuid;
  subject_text text;
  qtype text;
  prompt_text text;
  correct_text text;
  marks_num numeric;
  topic_text text;
  diff_text text;
  option_keys text[];
  option_labels text[];
  options_json jsonb;
  resolved_subject uuid;
  k integer;
begin
  if not public.academy_is_teacher() then
    raise exception 'Only teachers can import questions.' using errcode = '42501';
  end if;
  if p_csv is null or btrim(p_csv) = '' then
    raise exception 'The file is empty.' using errcode = '22023';
  end if;

  -- The first row is the header. Take it, normalise to lower case with the spaces
  -- removed, so "Correct Answer" and "correct_answer" both match.
  select first_row into raws
    from (
      select r as first_row
      from public.academy_exam_split_csv(p_csv) with ordinality as t(r, o)
      order by o
      limit 1
    ) head;
  if raws is null then
    raise exception 'The file is empty.' using errcode = '22023';
  end if;
  select array_agg(lower(regexp_replace(btrim(coalesce(h, '')), '[\s-]+', '_', 'g')))
  into headers
  from unnest(raws) as h;
  if (select count(*) from unnest(headers) hn where hn in ('question','question_text','prompt','text')) = 0 then
    raise exception 'The first row must be a header including a question column.' using errcode = '22023';
  end if;

  -- Split on newlines that are not inside a quoted field, then each row on
  -- commas that are not inside one. A teacher pasting from a spreadsheet is the
  -- normal case, so the naive split would corrupt questions containing commas.
  for raws, row_index in
    select parsed, ordinality
    from public.academy_exam_split_csv(p_csv) with ordinality as t(parsed, ordinality)
  loop
    continue when row_index = 1 and raws[1] is not null
      and lower(btrim(raws[1])) in ('question', 'question_text');
    continue when raws[1] is null or btrim(coalesce(raws[1], '')) = '';

    problems_list := '{}'::text[];

    -- resolve the column by name, tolerating the obvious spellings
    get_value := null;
    for k in 1 .. coalesce(array_length(headers, 1), 0) loop
      if headers[k] in ('question', 'question_text', 'prompt', 'text') then
        if get_value is null then get_value := raws[k]; end if;
      end if;
    end loop;
    prompt_text := btrim(coalesce(get_value, ''));
    if prompt_text = '' then
      problems_list := problems_list || 'question is empty';
    end if;

    get_value := null;
    for k in 1 .. coalesce(array_length(headers, 1), 0) loop
      if headers[k] in ('type', 'question_type', 'qtype') then
        if get_value is null then get_value := raws[k]; end if;
      end if;
    end loop;
    qtype := lower(replace(btrim(coalesce(get_value, 'mcq')), ' ', '_'));
    qtype := case
      when qtype in ('mcq', 'multiple_choice', 'multiplechoice', 'multiple choice') then 'mcq'
      when qtype in ('true_false', 'truefalse', 'true/false', 'true or false', 'tf') then 'true_false'
      else qtype
    end;
    if qtype not in ('mcq', 'true_false') then
      problems_list := problems_list || 'unknown type "' || coalesce(nullif(qtype, ''), '') || '", use mcq or true_false';
    end if;

    -- options
    option_keys := '{}'::text[];
    option_labels := '{}'::text[];
    for k in 1 .. coalesce(array_length(headers, 1), 0) loop
      if headers[k] ~ '^option_[a-h]$' then
        option_keys := option_keys || upper(right(headers[k], 1));
        option_labels := option_labels || btrim(coalesce(raws[k], ''));
      end if;
    end loop;

    if qtype = 'true_false' then
      options_json := '[{"key":"A","label":"True"},{"key":"B","label":"False"}]';
    else
      if coalesce(array_length(option_labels, 1), 0) < 2 then
        problems_list := problems_list || 'an MCQ needs at least two options';
        options_json := '[]'::jsonb;
      else
        options_json := (select jsonb_agg(
          jsonb_build_object('key', option_keys[i], 'label', option_labels[i])
          order by i)
          from generate_series(1, array_length(option_labels, 1)) i);
      end if;
    end if;

    get_value := null;
    for k in 1 .. coalesce(array_length(headers, 1), 0) loop
      if headers[k] in ('correct_answer', 'answer', 'correct', 'key') then
        if get_value is null then get_value := raws[k]; end if;
      end if;
    end loop;
    correct_text := btrim(coalesce(get_value, ''));
    if correct_text = '' then
      problems_list := problems_list || 'no correct answer given';
    else
      if qtype = 'true_false' then
        correct_text := case
          when lower(correct_text) in ('true', 'yes', 'a') then 'A'
          when lower(correct_text) in ('false', 'no', 'b') then 'B'
          else 'X'
        end;
        if correct_text = 'X' then
          problems_list := problems_list || 'correct answer must be True or False';
        end if;
      else
        correct_text := upper(correct_text);
        if not exists (select 1 from jsonb_array_elements(options_json) e
                        where e ->> 'key' = correct_text) then
          problems_list := problems_list || 'correct answer "' || correct_text || '" is not one of the options';
        end if;
      end if;
    end if;

    get_value := null;
    for k in 1 .. coalesce(array_length(headers, 1), 0) loop
      if headers[k] in ('marks', 'mark', 'points') then
        if get_value is null then get_value := raws[k]; end if;
      end if;
    end loop;
    begin
      marks_num := coalesce(nullif(btrim(coalesce(get_value, '')), '')::numeric, 1);
    exception when others then
      marks_num := 1;
      problems_list := problems_list || 'marks "' || coalesce(get_value, '') || '" is not a number';
    end;
    if marks_num <= 0 then
      marks_num := 1;
      problems_list := problems_list || 'marks must be greater than zero';
    end if;

    get_value := null;
    for k in 1 .. coalesce(array_length(headers, 1), 0) loop
      if headers[k] in ('subject', 'subject_name') then
        if get_value is null then get_value := raws[k]; end if;
      end if;
    end loop;
    subject_text := btrim(coalesce(get_value, ''));
    if subject_text = '' then
      resolved_subject := p_default_subject_id;
      if resolved_subject is null then
        problems_list := problems_list || 'no subject given';
      end if;
    else
      select id into resolved_subject from public.academy_subjects
       where lower(name) = lower(subject_text) or lower(slug) = lower(replace(subject_text, ' ', '-'));
      if resolved_subject is null then
        problems_list := problems_list || 'subject "' || subject_text || '" does not exist';
      end if;
    end if;

    get_value := null;
    for k in 1 .. coalesce(array_length(headers, 1), 0) loop
      if headers[k] in ('topic', 'unit') then
        if get_value is null then get_value := raws[k]; end if;
      end if;
    end loop;
    topic_text := btrim(coalesce(get_value, ''));

    get_value := null;
    for k in 1 .. coalesce(array_length(headers, 1), 0) loop
      if headers[k] in ('difficulty', 'level') then
        if get_value is null then get_value := raws[k]; end if;
      end if;
    end loop;
    diff_text := lower(btrim(coalesce(get_value, 'easy')));
    diff_text := case
      when diff_text in ('easy', 'beginner', 'basic', 'simple') then 'easy'
      when diff_text in ('medium', 'moderate', 'intermediate', 'developing') then 'medium'
      when diff_text in ('hard', 'challenge', 'advanced', 'difficult') then 'hard'
      else diff_text
    end;
    if diff_text not in ('easy', 'medium', 'hard') then
      problems_list := problems_list || 'difficulty must be easy, medium or hard';
    end if;

    dup := exists (
      select 1 from public.academy_exam_questions q
       where q.fingerprint = public.academy_exam_normalise_prompt(prompt_text)
         and q.status <> 'archived'
    );
    if dup and not p_allow_duplicates then
      problems_list := problems_list || 'already in the question bank';
    end if;

    return query select
      row_index::integer,
      coalesce(array_length(problems_list, 1), 0) = 0,
      problems_list,
      prompt_text,
      qtype,
      options_json,
      correct_text,
      marks_num,
      resolved_subject,
      topic_text,
      diff_text,
      dup;
  end loop;
end;
$$;

-- A quoted CSV field aware splitter. A question such as
-- "Which of these is a list, {}, or a dict?" would otherwise be torn in half.
create or replace function public.academy_exam_split_csv(p_csv text)
returns text[][]
language plpgsql
immutable
as $$
declare
  rows_out text[][] := '{}';
  current_row text[] := '{}';
  field text := '';
  in_quotes boolean := false;
  ch text;
  i integer;
  len integer;
begin
  len := length(p_csv);
  i := 1;
  while i <= len loop
    ch := substr(p_csv, i, 1);
    if in_quotes then
      if ch = '"' then
        if i < len and substr(p_csv, i + 1, 1) = '"' then
          field := field || '"';
          i := i + 1;
        else
          in_quotes := false;
        end if;
      else
        field := field || ch;
      end if;
    else
      if ch = '"' then
        in_quotes := true;
      elsif ch = ',' then
        current_row := current_row || field;
        field := '';
      elsif ch = E'\n' then
        current_row := current_row || field;
        field := '';
        rows_out := rows_out || current_row;
        current_row := '{}';
      elsif ch = E'\r' then
        null;  -- ignore, Windows line endings
      else
        field := field || ch;
      end if;
    end if;
    i := i + 1;
  end loop;
  if field <> '' or array_length(current_row, 1) > 0 then
    current_row := current_row || field;
    rows_out := rows_out || current_row;
  end if;
  return rows_out;
end;
$$;

-- Write the valid rows. Separate from the preview on purpose: a teacher reads
-- the report, fixes the file, and only then commits.
create or replace function public.academy_exam_import_csv(
  p_csv text,
  p_default_subject_id uuid default null,
  p_allow_duplicates boolean default false,
  p_import_only_valid boolean default true
)
returns table (imported integer, skipped integer, problems text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data record;
  did_import integer := 0;
  did_skip integer := 0;
  issues text[] := '{}'::text[];
begin
  if not public.academy_is_teacher() then
    raise exception 'Only teachers can import questions.' using errcode = '42501';
  end if;

  for row_data in
    select * from public.academy_exam_preview_csv(p_csv, p_default_subject_id, p_allow_duplicates)
  loop
    if row_data.is_valid or not p_import_only_valid then
      if row_data.is_valid then
        insert into public.academy_exam_questions (
          subject_id, topic, difficulty, question_type, prompt, options,
          correct_key, marks, status, fingerprint, created_by
        ) values (
          row_data.subject_id, row_data.topic, row_data.difficulty,
          row_data.question_type, row_data.prompt, row_data.options,
          row_data.correct_key, row_data.marks, 'active',
          public.academy_exam_normalise_prompt(row_data.prompt),
          auth.uid()
        );
        did_import := did_import + 1;
      else
        did_skip := did_skip + 1;
        issues := issues || ('row ' || row_data.row_number || ': ' || array_to_string(row_data.problems, '; '));
      end if;
    else
      did_skip := did_skip + 1;
      issues := issues || ('row ' || row_data.row_number || ': ' || array_to_string(row_data.problems, '; '));
    end if;
  end loop;

  return query select did_import, did_skip, issues;
end;
$$;

revoke execute on function public.academy_exam_preview_csv(text, uuid, boolean) from public, anon;
revoke execute on function public.academy_exam_import_csv(text, uuid, boolean, boolean) from public, anon;
revoke execute on function public.academy_exam_split_csv(text) from public, anon, authenticated;
revoke execute on function public.academy_exam_normalise_prompt(text) from public, anon, authenticated;
grant execute on function public.academy_exam_preview_csv(text, uuid, boolean) to authenticated;
grant execute on function public.academy_exam_import_csv(text, uuid, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';
