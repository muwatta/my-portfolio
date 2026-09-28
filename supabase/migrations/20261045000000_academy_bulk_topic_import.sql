-- Phase 2: bulk topic import with a dry run.
--
-- The brief asks for importing many topics at once with a preview and
-- validation step before anything is saved. The validator is a function of its
-- own so the editor can call it against a pasted file and show the teacher
-- exactly which rows will fail, without touching the database. The importer
-- calls the same validator, so what the preview shows is what the import does.

-- Guard rails. A teacher pasting a large file should get a clear message
-- rather than a timeout.
create or replace function public.academy_import_limits()
returns table (max_rows integer, max_title integer, max_objectives integer)
language sql
immutable
as $$
  select 200, 200, 20;
$$;

-- Row shape:
--   { "title", "slug", "lesson_number", "objectives": [], "content": {},
--     "points", "due_at", "release_at", "late_policy" }
create or replace function public.academy_validate_lesson_import(
  p_week_id uuid,
  p_rows jsonb
)
returns table (
  row_index integer,
  title text,
  slug text,
  lesson_number integer,
  status text,
  valid boolean,
  errors text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  limits record;
  total integer;
  entry jsonb;
  row_title text;
  row_slug text;
  row_number integer;
  row_objectives jsonb;
  problems text[];
  candidate_slug text;
  next_number integer;
  index integer := 0;
  taken_slugs text[] := '{}';
  taken_numbers integer[] := '{}';
begin
  perform public.academy_require_teacher();

  select * into limits from public.academy_import_limits();

  if p_week_id is null then
    raise exception 'Week is required.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.academy_weeks where id = p_week_id) then
    raise exception 'Week not found.' using errcode = 'P0002';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Rows must be a JSON array.' using errcode = '22023';
  end if;

  total := jsonb_array_length(p_rows);
  if total = 0 then
    raise exception 'There is nothing to import.' using errcode = '22023';
  end if;
  if total > limits.max_rows then
    raise exception 'Import at most % topics at a time, this file has %.',
      limits.max_rows, total using errcode = '22023';
  end if;

  -- Start from what the week already holds so collisions are caught.
  select coalesce(array_agg(l.slug), '{}'), coalesce(array_agg(l.lesson_number), '{}')
    into taken_slugs, taken_numbers
    from public.academy_lessons l
   where l.week_id = p_week_id;

  -- Qualify the column: lesson_number is also an OUT parameter of this
  -- function, so an unqualified reference is ambiguous.
  select coalesce(max(l.lesson_number), 0) into next_number
    from public.academy_lessons l
   where l.week_id = p_week_id;

  for entry in select value from jsonb_array_elements(p_rows) loop
    index := index + 1;
    problems := '{}';

    if jsonb_typeof(entry) <> 'object' then
      row_index := index;
      row_title := null;
      row_slug := null;
      row_number := null;
      status := 'error';
      valid := false;
      errors := array['This row is not an object.'];
      return next;
      continue;
    end if;

    row_title := nullif(trim(coalesce(entry ->> 'title', '')), '');
    row_slug := lower(trim(coalesce(entry ->> 'slug', '')));
    row_objectives := entry -> 'objectives';
    row_number := nullif(entry ->> 'lesson_number', '')::integer;

    if row_title is null then
      problems := array_append(problems, 'A title is required.');
    elsif length(row_title) > limits.max_title then
      problems := array_append(problems, format('Title is longer than % characters.', limits.max_title));
    end if;

    -- Derive the slug the same way academy_save_lesson does, so the preview and
    -- the saved row agree.
    if row_slug = '' then
      candidate_slug := trim(both '-' from lower(regexp_replace(coalesce(row_title, ''), '[^a-z0-9]+', '-', 'i')));
    else
      candidate_slug := row_slug;
    end if;

    if row_title is not null and candidate_slug = '' then
      problems := array_append(problems, 'Could not derive a slug from this title.');
    end if;

    if candidate_slug <> '' and candidate_slug = any (taken_slugs) then
      problems := array_append(problems, format('Slug "%s" is already used in this week.', candidate_slug));
    end if;

    if row_number is not null and row_number = any (taken_numbers) then
      problems := array_append(problems, format('Topic number % is already used in this week.', row_number));
    end if;

    if row_objectives is not null
       and jsonb_typeof(row_objectives) <> 'array' then
      problems := array_append(problems, 'Objectives must be a list.');
    elsif row_objectives is not null
       and jsonb_array_length(row_objectives) > limits.max_objectives then
      problems := array_append(problems, format('At most % objectives per topic.', limits.max_objectives));
    elsif row_objectives is not null then
      if exists (
        select 1 from jsonb_array_elements_text(row_objectives) v where length(trim(v)) = 0
      ) then
        problems := array_append(problems, 'Objectives cannot be blank.');
      end if;
    end if;

    if entry ? 'content'
       and entry -> 'content' is not null
       and jsonb_typeof(entry -> 'content') <> 'object' then
      problems := array_append(problems, 'Content must be a JSON object.');
    end if;

    if entry ? 'points' and entry ->> 'points' <> '' then
      begin
        if (entry ->> 'points')::numeric < 0 then
          problems := array_append(problems, 'Points cannot be negative.');
        end if;
      exception when others then
        problems := array_append(problems, 'Points must be a number.');
      end;
    end if;

    if entry ? 'due_at' and entry ->> 'due_at' <> ''
       and (entry ->> 'due_at')::timestamptz is null then
      problems := array_append(problems, 'Due date is not a valid date.');
    end if;

    -- Track what this run has already claimed so two identical titles in one
    -- file are reported rather than silently colliding on insert.
    if candidate_slug <> '' then
      taken_slugs := taken_slugs || candidate_slug;
    end if;
    if row_number is null then
      next_number := next_number + 1;
      taken_numbers := taken_numbers || next_number;
      row_number := next_number;
    else
      taken_numbers := taken_numbers || row_number;
    end if;

    row_index := index;
    title := row_title;
    slug := candidate_slug;
    lesson_number := row_number;
    status := case when cardinality(problems) = 0 then 'ready' else 'error' end;
    valid := cardinality(problems) = 0;
    errors := problems;
    return next;
  end loop;
end;
$$;

-- Commit an import. Every row goes through the same validator, so a bad row is
-- reported and skipped rather than aborting the whole file.
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

revoke execute on function public.academy_import_limits() from public, anon, authenticated;
revoke execute on function public.academy_validate_lesson_import(uuid, jsonb) from public, anon;
revoke execute on function public.academy_import_lessons(uuid, jsonb, text) from public, anon;
grant execute on function public.academy_validate_lesson_import(uuid, jsonb) to authenticated;
grant execute on function public.academy_import_lessons(uuid, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
