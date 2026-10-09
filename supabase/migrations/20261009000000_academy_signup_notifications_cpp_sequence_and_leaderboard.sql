-- Notify Academy administrators when an account is created.
alter table public.academy_notifications
  drop constraint if exists academy_notifications_type_check;

alter table public.academy_notifications
  add constraint academy_notifications_type_check
  check (
    type in (
      'lesson',
      'assignment',
      'feedback',
      'badge',
      'live_class',
      'announcement',
      'registration'
    )
  );

create or replace function public.academy_notify_admin_of_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  student_name text;
begin
  student_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'New student'
  );

  insert into public.academy_notifications (user_id, type, title, message)
  select admin.user_id,
         'registration',
         'New student signup',
         format(
           '%s (%s) just signed up. Review registrations to place them in a course.',
           student_name,
           coalesce(new.email, 'email unavailable')
         )
    from public.academy_admins admin;

  return new;
end;
$$;

revoke execute on function public.academy_notify_admin_of_signup()
  from public, anon, authenticated;

drop trigger if exists academy_notify_admin_of_signup on auth.users;
create trigger academy_notify_admin_of_signup
  after insert on auth.users
  for each row execute function public.academy_notify_admin_of_signup();

-- C++ work unlocks in curriculum order after the previous week's assignment is
-- submitted. Passing the grader is intentionally not required for progression.
create or replace function public.academy_require_prior_cpp_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_course_id uuid;
  target_week_number integer;
  target_language text;
begin
  if auth.uid() is null
     or new.student_id <> auth.uid()
     or public.academy_is_teacher()
     or public.academy_is_admin()
  then
    return new;
  end if;

  select assignment.course_id, week.week_number, course.language
    into target_course_id, target_week_number, target_language
    from public.academy_assignments assignment
    join public.academy_courses course on course.id = assignment.course_id
    left join public.academy_weeks week on week.id = assignment.week_id
   where assignment.id = new.assignment_id;

  if target_language <> 'cpp' or target_week_number is null then
    return new;
  end if;

  if exists (
    select 1
      from public.academy_assignments prior
      join public.academy_weeks prior_week on prior_week.id = prior.week_id
     where prior.course_id = target_course_id
       and prior_week.week_number < target_week_number
       and prior.published
       and not prior.is_draft
       and prior.status = 'published'
       and (prior.release_at is null or prior.release_at <= now())
       and not exists (
         select 1
           from public.academy_submissions submission
          where submission.assignment_id = prior.id
            and submission.student_id = new.student_id
       )
  ) then
    raise exception 'Submit the previous C++ week assignment before starting this one.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.academy_require_prior_cpp_assignments()
  from public, anon, authenticated;

drop trigger if exists academy_require_prior_cpp_assignments
  on public.academy_submissions;
create trigger academy_require_prior_cpp_assignments
  before insert on public.academy_submissions
  for each row execute function public.academy_require_prior_cpp_assignments();

-- Students see the top ten; staff can inspect the full cohort.
create or replace function public.academy_weekly_leaderboard(
  p_period_id uuid default null
)
returns table (
  student_id uuid,
  display_name text,
  points bigint,
  rank bigint
)
language sql
security definer
set search_path = public
as $$
  with standings as (
    select
      points.student_id,
      profiles.display_name,
      sum(points.points) as points
    from public.academy_leaderboard_points points
    join public.academy_profiles profiles on profiles.id = points.student_id
    where points.verification_status = 'verified'
      and points.period_id = coalesce(
        p_period_id,
        (
          select id
            from public.academy_leaderboard_periods
           where status = 'active'
           order by starts_at desc
           limit 1
        )
      )
      and profiles.role = 'student'
    group by points.student_id, profiles.display_name
  ),
  ranked as (
    select
      standings.student_id,
      standings.display_name,
      standings.points::bigint as points,
      row_number() over (
        order by standings.points desc, standings.student_id
      )::bigint as rank
    from standings
  )
  select ranked.student_id, ranked.display_name, ranked.points, ranked.rank
    from ranked
    where ranked.rank <= 10
       or public.academy_is_admin()
   order by ranked.rank;
$$;

revoke execute on function public.academy_weekly_leaderboard(uuid)
  from public, anon;
grant execute on function public.academy_weekly_leaderboard(uuid)
  to authenticated;

do $$
begin
  alter publication supabase_realtime
    add table public.academy_notifications;
exception when duplicate_object then
  null;
end;
$$;

notify pgrst, 'reload schema';
