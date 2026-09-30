-- Also catch the same question twice inside one file, and put the importer back
-- in service.
--
-- The duplicate check only looked in the question bank, so a file containing the
-- same question twice imported it twice. That is the case a teacher actually
-- meets when a question is copy and pasted down a spreadsheet, and it is the one
-- section 3 means by avoiding accidental duplicates.
--
-- Seen rows are tracked per file, so the second copy is reported against the row
-- it duplicates. The importer is re-granted execute, which was revoked while the
-- reader was broken.

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
  dup_in_file boolean;
  dup_of integer;
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
  this_fingerprint text;
  earlier_fingerprints text[] := '{}'::text[];
  earlier_rows integer[] := '{}'::integer[];
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
    if not exists (select 1 from jsonb_array_elements_text(row_value) c
                    where btrim(c) <> '') then
      continue;
    end if;

    problems_list := '{}'::text[];
    -- The column is called pos rather than k because k is already the loop
    -- variable in this scope, and Postgres then cannot tell which k is meant.
    this_fingerprint := public.academy_exam_normalise_prompt(coalesce((
      select btrim(row_value ->> (pos - 1))
        from generate_series(1, coalesce(array_length(header, 1), 0)) as pos
       where header[pos] in ('question', 'question_text', 'prompt', 'text')
       limit 1), ''));
    prompt_text := coalesce((
      select btrim(row_value ->> (pos - 1))
        from generate_series(1, coalesce(array_length(header, 1), 0)) as pos
       where header[pos] in ('question', 'question_text', 'prompt', 'text')
       limit 1), '');
    if prompt_text = '' then
      problems_list := array_append(problems_list, 'question is empty');
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
      problems_list := array_append(problems_list, 'unknown type, use mcq or true_false');
    end if;

    option_keys := '{}'::text[];
    option_labels := '{}'::text[];
    for k in 1 .. coalesce(array_length(header, 1), 0) loop
      if header[k] ~ '^option_[a-h]$' then
        option_keys := option_keys || upper(right(header[k], 1));
        option_labels := array_append(option_labels, btrim(coalesce(row_value ->> (k - 1), '')));
      end if;
    end loop;

    if qtype = 'true_false' then
      options_json := '[{"key":"A","label":"True"},{"key":"B","label":"False"}]';
    elsif coalesce(array_length(option_labels, 1), 0) < 2 then
      problems_list := array_append(problems_list, 'an MCQ needs at least two options');
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
      problems_list := array_append(problems_list, 'no correct answer given');
    elsif qtype = 'true_false' then
      correct_text := case
        when lower(correct_text) in ('true', 'yes', 'a') then 'A'
        when lower(correct_text) in ('false', 'no', 'b') then 'B'
        else 'X' end;
      if correct_text = 'X' then
        problems_list := array_append(problems_list, 'correct answer must be True or False');
      end if;
    else
      correct_text := upper(correct_text);
      if not exists (select 1 from jsonb_array_elements(options_json) e
                      where e ->> 'key' = correct_text) then
        problems_list := array_append(
          problems_list,
          'correct answer "' || correct_text || '" is not one of the options');
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
      problems_list := array_append(problems_list, 'marks is not a number');
    end;
    if marks_num <= 0 then
      marks_num := 1;
      problems_list := array_append(problems_list, 'marks must be greater than zero');
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
        problems_list := array_append(problems_list, 'no subject given');
      end if;
    else
      select id into resolved_subject from public.academy_subjects
       where lower(name) = lower(subject_text)
          or lower(slug) = lower(replace(subject_text, ' ', '-'));
      if resolved_subject is null then
        problems_list := array_append(
          problems_list, 'subject "' || subject_text || '" does not exist');
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
      problems_list := array_append(problems_list, 'difficulty must be easy, medium or hard');
    end if;

    -- Duplicates inside this file, and separately in the bank. The file check
    -- is the one a teacher meets, from a question pasted down a spreadsheet.
    dup_in_file := exists (
      select 1 from unnest(earlier_fingerprints) f where f = this_fingerprint
    );
    select min(r) into dup_of
      from unnest(earlier_fingerprints) with ordinality as t(f, r)
     where t.f = this_fingerprint;

    dup := exists (
      select 1 from public.academy_exam_questions q
       where q.fingerprint = this_fingerprint
         and q.status <> 'archived'
    );

    if not p_allow_duplicates then
      if dup_in_file then
        problems_list := array_append(
          problems_list,
          'the same question appears earlier in this file, on row ' || dup_of);
      elsif dup then
        problems_list := array_append(problems_list, 'already in the question bank');
      end if;
    end if;

    earlier_fingerprints := array_append(earlier_fingerprints, this_fingerprint);
    earlier_rows := array_append(earlier_rows, row_index);

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
      dup_in_file or dup;
  end loop;
end;
$$;

grant execute on function public.academy_exam_preview_csv(text, uuid, boolean) to authenticated;
grant execute on function public.academy_exam_import_csv(text, uuid, boolean, boolean) to authenticated;

notify pgrst, 'reload schema';
