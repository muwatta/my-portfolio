-- Correct the row iteration in academy_exam_preview_csv.
--
-- The function academy_exam_split_csv returns text[][], so it yields one value
-- that is an array of rows. Iterating it with "with ordinality" therefore
-- produced a single row numbered 1, which the header skip then discarded, and
-- the preview always reported zero questions. Verified: eight data rows, zero
-- parsed.
--
-- The outer array is now unnested with ordinality, so each CSV line is its own
-- row and the header is genuinely just the first one.

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
  raws text[][];
  headers text[];
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

  select u.row into raws
  from public.academy_exam_split_csv(p_csv) f
  cross join lateral unnest(f) with ordinality as u(row, ord)
  order by u.ord
  limit 1;
  if raws is null then
    raise exception 'The file is empty.' using errcode = '22023';
  end if;

  select array_agg(lower(regexp_replace(btrim(coalesce(h, '')), '[\s-]+', '_', 'g')))
  into headers
  from unnest(raws) as h;

  if (select count(*) from unnest(headers) hn
       where hn in ('question', 'question_text', 'prompt', 'text')) = 0 then
    raise exception 'The first row must be a header including a question column.'
      using errcode = '22023';
  end if;

  for raws, row_index in
    select u.row, u.ord
    from public.academy_exam_split_csv(p_csv) f
    cross join lateral unnest(f) with ordinality as u(row, ord)
  loop
    continue when row_index = 1;
    continue when raws[1] is null or btrim(coalesce(raws[1], '')) = '';

    problems_list := '{}'::text[];

    get_value := null;
    for k in 1 .. coalesce(array_length(headers, 1), 0) loop
      if headers[k] in ('question', 'question_text', 'prompt', 'text')
         and get_value is null then get_value := raws[k]; end if;
    end loop;
    prompt_text := btrim(coalesce(get_value, ''));
    if prompt_text = '' then
      problems_list := problems_list || 'question is empty';
    end if;

    get_value := null;
    for k in 1 .. coalesce(array_length(headers, 1), 0) loop
      if headers[k] in ('type', 'question_type', 'qtype') and get_value is null then
        get_value := raws[k];
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
    for k in 1 .. coalesce(array_length(headers, 1), 0) loop
      if headers[k] ~ '^option_[a-h]$' then
        option_keys := option_keys || upper(right(headers[k], 1));
        option_labels := option_labels || btrim(coalesce(raws[k], ''));
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
    for k in 1 .. coalesce(array_length(headers, 1), 0) loop
      if headers[k] in ('correct_answer', 'answer', 'correct', 'key')
         and get_value is null then get_value := raws[k]; end if;
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
    for k in 1 .. coalesce(array_length(headers, 1), 0) loop
      if headers[k] in ('marks', 'mark', 'points') and get_value is null then
        get_value := raws[k];
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
    for k in 1 .. coalesce(array_length(headers, 1), 0) loop
      if headers[k] in ('subject', 'subject_name') and get_value is null then
        get_value := raws[k];
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
    for k in 1 .. coalesce(array_length(headers, 1), 0) loop
      if headers[k] in ('topic', 'unit') and get_value is null then get_value := raws[k]; end if;
    end loop;
    topic_text := btrim(coalesce(get_value, ''));

    get_value := null;
    for k in 1 .. coalesce(array_length(headers, 1), 0) loop
      if headers[k] in ('difficulty', 'level') and get_value is null then get_value := raws[k]; end if;
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
