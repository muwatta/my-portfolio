-- Correct the option rebuild in academy_exam_normalise_question.
--
-- The generate_series over the cleaned options was aliased i, which is also a
-- variable in that block, so Postgres raised "column reference i is ambiguous"
-- and no question could be added to an exam at all. The alias is now n.
--
-- This is the second time a subquery alias has collided with a plpgsql variable
-- in this work, the first being k in the CSV reader. Worth remembering: in
-- plpgsql, a loop or counter variable shadows nothing, it just makes an
-- unqualified alias ambiguous.

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

    -- The series is aliased n rather than i because i is a variable in this
    -- block, and Postgres then cannot tell which one is meant.
    select jsonb_agg(
             jsonb_build_object('key', clean_keys[n], 'label', clean_labels[n]) order by n)
      into out_options
    from generate_series(1, array_length(clean_labels, 1)) as n;
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

notify pgrst, 'reload schema';
