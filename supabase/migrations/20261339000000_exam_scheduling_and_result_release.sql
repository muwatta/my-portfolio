alter table public.academy_exams
  add column if not exists results_release_mode text not null default 'manual';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'academy_exams_results_release_mode_ck'
      and conrelid = 'public.academy_exams'::regclass
  ) then
    alter table public.academy_exams
      add constraint academy_exams_results_release_mode_ck
      check (results_release_mode in ('manual', 'immediate'));
  end if;
end;
$$;

drop function if exists public.academy_exam_create(
  text, uuid, uuid, uuid, text, integer, timestamptz, timestamptz,
  numeric, boolean, boolean, boolean, boolean, integer
);

create function public.academy_exam_create(
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
  p_max_attempts integer default 1,
  p_results_release_mode text default 'manual'
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
  if p_class_id is null or not exists (
    select 1 from public.academy_classes where id = p_class_id
  ) then
    raise exception 'Choose the class that will take this examination.' using errcode = '22023';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'Set a valid start and close time for this examination.' using errcode = '22023';
  end if;
  if chosen_duration < 1 or chosen_duration > 600 then
    raise exception 'The duration must be between 1 and 600 minutes.' using errcode = '22023';
  end if;
  if coalesce(p_results_release_mode, 'manual') not in ('manual', 'immediate') then
    raise exception 'Choose either manual or immediate result release.' using errcode = '22023';
  end if;

  insert into public.academy_exams (
    title, subject_id, class_id, level_id, instructions, duration_minutes,
    starts_at, ends_at, pass_mark, randomize_questions, randomize_options,
    allow_review, allow_early_submit, max_attempts, results_release_mode,
    status, created_by
  ) values (
    btrim(p_title), p_subject_id, p_class_id, p_level_id,
    coalesce(p_instructions, ''), chosen_duration,
    p_starts_at, p_ends_at, p_pass_mark,
    coalesce(p_randomize_questions, false),
    coalesce(p_randomize_options, false),
    coalesce(p_allow_review, true),
    coalesce(p_allow_early_submit, true),
    coalesce(p_max_attempts, 1),
    coalesce(p_results_release_mode, 'manual'),
    'draft', auth.uid()
  )
  returning * into exam_row;

  insert into public.academy_exam_events (exam_id, actor_id, action)
  values (exam_row.id, auth.uid(), 'exam_created');

  return exam_row;
end;
$$;

revoke execute on function public.academy_exam_create(
  text, uuid, uuid, uuid, text, integer, timestamptz, timestamptz,
  numeric, boolean, boolean, boolean, boolean, integer, text
) from public, anon;
grant execute on function public.academy_exam_create(
  text, uuid, uuid, uuid, text, integer, timestamptz, timestamptz,
  numeric, boolean, boolean, boolean, boolean, integer, text
) to authenticated;

create or replace function public.academy_exam_publish_results(
  p_exam_id uuid,
  p_publish boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.academy_is_teacher() then
    raise exception 'Only teachers can publish examination results.'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.academy_exams where id = p_exam_id
  ) then
    raise exception 'Examination not found.' using errcode = 'P0002';
  end if;
  if not coalesce(p_publish, false) and exists (
    select 1 from public.academy_exams
    where id = p_exam_id and results_release_mode = 'immediate'
  ) then
    raise exception 'Results for an immediate-release test cannot be withheld after publication.'
      using errcode = '22023';
  end if;

  update public.academy_exams
  set results_published = coalesce(p_publish, false),
      status = case when coalesce(p_publish, false) then 'results_published'
                    when status = 'results_published' then 'graded'
                    else status end,
      updated_at = now()
  where id = p_exam_id;

  insert into public.academy_exam_events (exam_id, actor_id, action, metadata)
  values (
    p_exam_id, auth.uid(),
    case when coalesce(p_publish, false)
      then 'results_published' else 'results_unpublished' end,
    jsonb_build_object('at', now())
  );

  begin
    perform public.academy_exam_sync_leaderboard(p_exam_id);
  exception when others then
    insert into public.academy_exam_events (exam_id, actor_id, action, metadata)
    values (
      p_exam_id, auth.uid(), 'leaderboard_sync_failed',
      jsonb_build_object('at', now(), 'error', sqlerrm)
    );
  end;

  return true;
end;
$$;

create or replace function public.academy_exam_publish_immediate_results()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  released_exam_id uuid;
begin
  if new.status <> 'graded' or old.status = 'graded' then
    return new;
  end if;

  update public.academy_exams
  set results_published = true,
      status = 'results_published',
      updated_at = now()
  where id = new.exam_id
    and results_release_mode = 'immediate'
    and results_published = false
  returning id into released_exam_id;

  if released_exam_id is not null then
    insert into public.academy_exam_events (
      exam_id, attempt_id, actor_id, student_id, action, metadata
    )
    values (
      new.exam_id, new.id, new.student_id, new.student_id,
      'results_published',
      jsonb_build_object('release_mode', 'immediate', 'at', now())
    );

    begin
      perform public.academy_exam_sync_leaderboard(new.exam_id);
    exception when others then
      insert into public.academy_exam_events (
        exam_id, attempt_id, actor_id, student_id, action, metadata
      )
      values (
        new.exam_id, new.id, new.student_id, new.student_id,
        'leaderboard_sync_failed',
        jsonb_build_object('at', now(), 'error', sqlerrm)
      );
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists academy_exam_publish_immediate_results
  on public.academy_exam_attempts;
create trigger academy_exam_publish_immediate_results
after update of status on public.academy_exam_attempts
for each row
execute function public.academy_exam_publish_immediate_results();

revoke execute on function public.academy_exam_publish_immediate_results()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
