-- Restrict manual grading to the primary admin and explicitly appointed graders.
-- Teachers retain their existing curriculum-management permissions.

create table if not exists public.academy_graders (
  user_id uuid primary key references auth.users(id) on delete cascade,
  appointed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.academy_graders enable row level security;
revoke all on public.academy_graders from public, anon, authenticated;

create or replace function public.academy_can_grade()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = public.academy_primary_admin_id()
    or exists (
      select 1
      from public.academy_graders g
      where g.user_id = auth.uid()
    );
$$;

revoke execute on function public.academy_can_grade() from public, anon;
grant execute on function public.academy_can_grade() to authenticated;

create or replace function public.academy_set_grader(
  target_user_id uuid,
  should_be_grader boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from public.academy_primary_admin_id() then
    raise exception 'Only the primary superadmin can appoint or remove graders.'
      using errcode = '42501';
  end if;
  if target_user_id is null or not exists (
    select 1 from auth.users where id = target_user_id
  ) then
    raise exception 'Choose an existing user.' using errcode = '22023';
  end if;

  if should_be_grader then
    insert into public.academy_graders (user_id, appointed_by)
    values (target_user_id, auth.uid())
    on conflict (user_id) do update
      set appointed_by = excluded.appointed_by;
  else
    delete from public.academy_graders where user_id = target_user_id;
  end if;
  return should_be_grader;
end;
$$;

revoke execute on function public.academy_set_grader(uuid, boolean) from public, anon;
grant execute on function public.academy_set_grader(uuid, boolean) to authenticated;

-- Defence in depth: old grading RPCs and direct table writes cannot bypass
-- the same authorization rule. Student objective attempts remain unaffected.
create or replace function public.academy_guard_manual_grade_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  grading_changed boolean := false;
  request_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if request_role = 'service_role' or auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    grading_changed :=
      new.teacher_score is not null
      or new.reviewed_by is not null
      or new.published_by is not null
      or coalesce(new.review_state, 'unreviewed') in ('reviewed', 'published')
      or new.teacher_feedback is not null
      or new.rubric_feedback is not null;
  else
    grading_changed :=
      new.teacher_score is distinct from old.teacher_score
      or new.final_score is distinct from old.final_score
      or new.teacher_feedback is distinct from old.teacher_feedback
      or new.rubric_feedback is distinct from old.rubric_feedback
      or new.reviewed_by is distinct from old.reviewed_by
      or new.published_by is distinct from old.published_by
      or new.review_state is distinct from old.review_state
      or new.published_at is distinct from old.published_at
      or new.reviewed_at is distinct from old.reviewed_at;
  end if;

  if grading_changed and not public.academy_can_grade() then
    raise exception 'Only the superadmin or an appointed grader can grade or publish submissions.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists academy_submission_results_manual_grade_guard
  on public.academy_submission_results;
create trigger academy_submission_results_manual_grade_guard
  before insert or update on public.academy_submission_results
  for each row execute function public.academy_guard_manual_grade_write();

revoke execute on function public.academy_guard_manual_grade_write()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
