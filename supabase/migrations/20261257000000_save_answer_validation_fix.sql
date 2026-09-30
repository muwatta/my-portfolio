-- Correct the option check in academy_exam_save_answer.
--
-- The original condition was
--
--   if p_selected_key is not null and exists (
--     select 1 from jsonb_array_elements(options) elem
--      where elem ->> 'key' <> p_selected_key)
--
-- which raises whenever any option differs from the chosen key. With two or more
-- options that is always true, so every legitimate answer was rejected with
-- "That answer is not one of the options". Verified live: the first attempt to
-- save a real answer was refused.
--
-- The intent was the opposite: refuse only when the chosen key is not among the
-- options at all. That is what NOT EXISTS expresses.

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
  option_keys jsonb;
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
  select snapshot ->> 'correct_key', snapshot -> 'options'
  into valid_key, option_keys
  from public.academy_exam_question_links
  where exam_id = attempt_row.exam_id and question_id = p_question_id;

  if valid_key is null then
    raise exception 'That question is not part of this examination.' using errcode = '42501';
  end if;

  if p_selected_key is not null and not exists (
    select 1 from jsonb_array_elements(option_keys) elem
     where elem ->> 'key' = p_selected_key
  ) then
    -- The chosen key is not one of the options, so it cannot be marked. Refused
    -- rather than silently stored as wrong.
    raise exception 'That answer is not one of the options.' using errcode = '22023';
  end if;

  select * into existing from public.academy_exam_answers
  where attempt_id = p_attempt_id and question_id = p_question_id;

  -- Section 8: last write wins on the student's own clock, so a queued offline
  -- answer that is older than what is already stored is dropped instead of
  -- undoing it.
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

revoke execute on function public.academy_exam_save_answer(uuid, uuid, text, timestamptz) from public, anon;
grant execute on function public.academy_exam_save_answer(uuid, uuid, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';
