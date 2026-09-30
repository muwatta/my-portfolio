-- Rewrite the CSV reader over JSONB instead of nested Postgres arrays.
--
-- This replaces three functions that were rewritten four times and still did not
-- work. The cause was always array rank: the splitter returns text[][], and every
-- way of pulling a single row out of it, unnest(f) flattens all dimensions,
-- with ordinality treats the whole array as one row, and generate_subscripts(f, 1)
-- yields the right count but the value did not land in a text[] receiver. Two of
-- those were my own mistakes and are recorded in the earlier migrations.
--
-- JSONB has no rank to get wrong. The splitter returns a JSON array whose
-- elements are JSON arrays of strings, and the preview walks it with
-- jsonb_array_elements, where each element is unambiguously one CSV row. A cell
-- is read with ->> on a zero based index.
--
-- The parser itself is unchanged and was already verified: a quoted field
-- containing a comma comes back whole, doubled quotes unescape, and Windows line
-- endings are ignored.

-- Dropped first because create or replace cannot change a return type, and this
-- one goes from text[][] to jsonb. Nothing else calls it with the old shape.
drop function if exists public.academy_exam_split_csv(text);

create function public.academy_exam_split_csv(p_csv text)
returns jsonb
language plpgsql
immutable
as $$
declare
  rows jsonb := '[]'::jsonb;
  current_row text[] := '{}';
  field text := '';
  in_quotes boolean := false;
  ch text;
  i integer;
  len integer;
begin
  if p_csv is null then
    return rows;
  end if;

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
        rows := rows || jsonb_build_array(to_jsonb(current_row));
        current_row := '{}';
        field := '';
      elsif ch = E'\r' then
        null;
      else
        field := field || ch;
      end if;
    end if;
    i := i + 1;
  end loop;

  if field <> '' or array_length(current_row, 1) > 0 then
    current_row := current_row || field;
    rows := rows || jsonb_build_array(to_jsonb(current_row));
  end if;

  return rows;
end;
$$;

revoke execute on function public.academy_exam_split_csv(text) from public, anon, authenticated;

-- Check one row without parsing the whole file. Cheaper than the preview for a
-- teacher who just wants to know whether the file is shaped correctly.
create or replace function public.academy_exam_csv_shape(p_csv text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'rows', jsonb_array_length(public.academy_exam_split_csv(p_csv)),
    'header', public.academy_exam_split_csv(p_csv) -> 0,
    'first_data_row', public.academy_exam_split_csv(p_csv) -> 1
  );
$$;

revoke execute on function public.academy_exam_csv_shape(text) from public, anon, authenticated;

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
  parsed jsonb;
  header text[];
  row_value jsonb;
  row_index integer;
  k integer;
  get_value text;
  problems_list text[];
  dup boolean;
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
begin
  if not public.academy_is_teacher() then
    raise exception 'Only teachers can import questions.' using errcode = '42501';
  end if;
  if p_csv is null or btrim(p_csv) = '' then
    raise exception 'The file is empty.' using errcode = '22023';
  end if;

  parsed := public.academy_exam_split_csv(p_csv);
  if jsonb_array_length(parsed) = 0 then
    raise exception 'The file is empty.' using errcode = '22023';
  end if;

  -- The header drives every column lookup, matched by name rather than position
  -- so a teacher can reorder columns or add one.
  select array_agg(lower(regexp_replace(btrim(coalesce(cell, '')), '[\s-]+', '_', 'g')))
  into header
  from jsonb_array_elements_text(parsed -> 0) as cell;

  if (select count(*) from unnest(header) h
       where h in ('question', 'question_text', 'prompt', 'text')) = 0 then
    raise exception 'The first row must be a header including a question column.'
      using errcode = '22023';
  end if;

  for row_value, row_index in
    select elem, ord
    from jsonb_array_elements(parsed) with ordinality as t(elem, ord)
    where ord > 1
  loop
    -- A row of nothing but empty cells is a blank line, not a question.
    if not exists (select 1 from jsonb_array_elements_text(row_value) c
                    where btrim(c) <> '') then
      continue;
    end if;

    problems_list := '{}'::text[];

    get_value := null;
    for k in 1 .. coalesce(array_length(header, 1), 0) loop
      if header[k] in ('question', 'question_text', 'prompt', 'text')
         and get_value is null then get_value := row_value ->> (k - 1); end if;
    end loop;
    prompt_text := btrim(coalesce(get_value, ''));
    if prompt_text = '' then
      problems_list := problems_list || 'question is empty';
    end if;

    get_value := null;
    for k in 1 .. coalesce(array_length(header, 1), 0) loop
      if header[k] in ('type', 'question_type', 'qtype') and get_value is null then
        get_value := row_value ->> (k - 1);
      end if;
    end loop;
    qtype := lower(replace(btrim(coalesce(get_value, 'mcq')), ' ', '_'));
    qtype := case
      when qtype in ('mcq', 'multiple_choice', 'multiplechoice') then 'mcq'
      when qtype in ('true_false', 'truefalse', 'true/false', 'true or false', 'tf') then 'true_false'
      else qtype
    end;
    if qtype not in ('mcq', 'true_false') then
      problems_list := problems_list || 'unknown type, use mcq or true_false';
    end if;

    option_keys := '{}'::text[];
    option_labels := '{}'::text[];
    for k in 1 .. coalesce(array_length(header, 1), 0) loop
      if header[k] ~ '^option_[a-h]$' then
        option_keys := option_keys || upper(right(header[k], 1));
        option_labels := option_labels || btrim(coalesce(row_value ->> (k - 1), ''));
      end if;
    end loop;

    if qtype = 'true_false' then
      options_json := '[{"key":"A","label":"True"},{"key":"B","label":"False"}]';
    elsif coalesce(array_length(option_labels, 1), 0) < 2 then
      problems_list := problems_list || 'an MCQ needs at least two options';
      options_json := '[]'::jsonb;
    else
      options_json := (select jsonb_agg(
        jsonb_build_object('key', option_keys[i], 'label', option_labels[i]) order by i)
        from generate_series(1, array_length(option_labels, 1)) i);
    end if;

    get_value := null;
    for k in 1 .. coalesce(array_length(header, 1), 0) loop
      if header[k] in ('correct_answer', 'answer', 'correct', 'key')
         and get_value is null then get_value := row_value ->> (k - 1); end if;
    end loop;
    correct_text := btrim(coalesce(get_value, ''));
    if correct_text = '' then
      problems_list := problems_list || 'no correct answer given';
    elsif qtype = 'true_false' then
      correct_text := case
        when lower(correct_text) in ('true', 'yes', 'a') then 'A'
        when lower(correct_text) in ('false', 'no', 'b') then 'B'
        else 'X' end;
      if correct_text = 'X' then
        problems_list := problems_list || 'correct answer must be True or False';
      end if;
    else
      correct_text := upper(correct_text);
      if not exists (select 1 from jsonb_array_elements(options_json) e
                      where e ->> 'key' = correct_text) then
        problems_list := problems_list
          || 'correct answer "' || correct_text || '" is not one of the options';
      end if;
    end if;

    get_value := null;
    for k in 1 .. coalesce(array_length(header, 1), 0) loop
      if header[k] in ('marks', 'mark', 'points') and get_value is null then
        get_value := row_value ->> (k - 1);
      end if;
    end loop;
    begin
      marks_num := coalesce(nullif(btrim(coalesce(get_value, '')), '')::numeric, 1);
    exception when others then
      marks_num := 1;
      problems_list := problems_list || 'marks is not a number';
    end;
    if marks_num <= 0 then
      marks_num := 1;
      problems_list := problems_list || 'marks must be greater than zero';
    end if;

    get_value := null;
    for k in 1 .. coalesce(array_length(header, 1), 0) loop
      if header[k] in ('subject', 'subject_name') and get_value is null then
        get_value := row_value ->> (k - 1);
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
       where lower(name) = lower(subject_text)
          or lower(slug) = lower(replace(subject_text, ' ', '-'));
      if resolved_subject is null then
        problems_list := problems_list || 'subject "' || subject_text || '" does not exist';
      end if;
    end if;

    get_value := null;
    for k in 1 .. coalesce(array_length(header, 1), 0) loop
      if header[k] in ('topic', 'unit') and get_value is null then
        get_value := row_value ->> (k - 1);
      end if;
    end loop;
    topic_text := btrim(coalesce(get_value, ''));

    get_value := null;
    for k in 1 .. coalesce(array_length(header, 1), 0) loop
      if header[k] in ('difficulty', 'level') and get_value is null then
        get_value := row_value ->> (k - 1);
      end if;
    end loop;
    diff_text := lower(btrim(coalesce(get_value, 'easy')));
    diff_text := case
      when diff_text in ('easy', 'beginner', 'basic', 'simple') then 'easy'
      when diff_text in ('medium', 'moderate', 'intermediate', 'developing') then 'medium'
      when diff_text in ('hard', 'challenge', 'advanced', 'difficult') then 'hard'
      else diff_text end;
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

revoke execute on function public.academy_exam_preview_csv(text, uuid, boolean) from public, anon;
grant execute on function public.academy_exam_preview_csv(text, uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
