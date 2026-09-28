-- Phase 2 correction, second pass.
--
-- The objectives array in academy_import_lessons was built with
--   array_agg(btrim(value #>> '{}'))
-- but jsonb_array_elements_text already returns text, and the #>> operator only
-- exists for jsonb, so any import containing objectives failed with SQLSTATE
-- 42883. Corrected in 20261045000000 and 20261046000000 as well; this carries
-- the fix to the database that already has the broken body.

create or replace function public.academy_import_lessons(
  p_week_id uuid,
  p_rows jsonb,
  p_status text default 'draft'
)
returns table (
  inserted integer,
  skipped integer,
  total integer,
  failures jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_status text;
  check_row record;
  inserted_count integer := 0;
  skipped_count integer := 0;
  failure_list jsonb := '[]'::jsonb;
begin
  perform public.academy_require_teacher();

  target_status := lower(trim(coalesce(p_status, 'draft')));
  if target_status not in ('draft', 'scheduled', 'published', 'archived') then
    raise exception 'Unknown status %', target_status using errcode = '22023';
  end if;
  -- Importing straight to published would expose content the teacher has not
  -- read, so a bulk import always lands as a draft.
  if target_status <> 'draft' then
    target_status := 'draft';
  end if;

  for check_row in
    select * from public.academy_validate_lesson_import(p_week_id, p_rows)
  loop
    continue when check_row.valid;
    skipped_count := skipped_count + 1;
    failure_list := failure_list || jsonb_build_object(
      'row', check_row.row_index,
      'title', check_row.title,
      'errors', to_jsonb(check_row.errors)
    );
  end loop;

  for check_row in
    select v.*, e.*
      from public.academy_validate_lesson_import(p_week_id, p_rows) v
      join lateral jsonb_array_elements(p_rows) with ordinality as e(value, ord) on e.ord = v.row_index
     where v.valid
  loop
    insert into public.academy_lessons (
      week_id, title, slug, lesson_number, objectives, content,
      status, release_at, due_at, points, late_policy, sort_order
    )
    values (
      p_week_id,
      check_row.title,
      check_row.slug,
      check_row.lesson_number,
      -- jsonb_array_elements_text already yields text, so the value must not be
      -- unwrapped again with the jsonb #>> operator.
      coalesce(
        (select array_agg(btrim(trimmed))
           from jsonb_array_elements_text(coalesce(check_row.value -> 'objectives', '[]'::jsonb)) as trimmed),
        '{}'
      ),
      coalesce(check_row.value -> 'content', '{}'::jsonb),
      target_status,
      null,
      nullif(check_row.value ->> 'due_at', '')::timestamptz,
      nullif(check_row.value ->> 'points', '')::numeric,
      coalesce(nullif(check_row.value ->> 'late_policy', ''), 'accept_penalty'),
      coalesce(nullif(check_row.value ->> 'sort_order', '')::integer, 0)
    );
    inserted_count := inserted_count + 1;
  end loop;

  inserted := inserted_count;
  skipped := skipped_count;
  total := inserted_count + skipped_count;
  failures := failure_list;
  return next;
end;
$$;

notify pgrst, 'reload schema';

notify pgrst, 'reload schema';
