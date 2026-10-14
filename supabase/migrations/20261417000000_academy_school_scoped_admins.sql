-- Transfer global administration to the explicitly requested account, then
-- give school administrators a separate, school-scoped permission boundary.
do $migration$
declare
  matching_user_ids uuid[];
begin
  select array_agg(id)
    into matching_user_ids
  from auth.users
  where lower(email) = 'abdullahmusliudeen@gmail.com';

  if coalesce(array_length(matching_user_ids, 1), 0) <> 1 then
    raise exception
      'Expected exactly one auth.users account for abdullahmusliudeen@gmail.com; found %.',
      coalesce(array_length(matching_user_ids, 1), 0);
  end if;

  execute format(
    'create or replace function public.academy_primary_admin_id()
     returns uuid
     language sql
     immutable
     as $function$ select %L::uuid; $function$',
    matching_user_ids[1]
  );
end;
$migration$;

revoke execute on function public.academy_primary_admin_id()
  from public, anon, authenticated;
grant execute on function public.academy_primary_admin_id() to service_role;

delete from public.academy_admins
where user_id <> public.academy_primary_admin_id();

insert into public.academy_admins (user_id)
values (public.academy_primary_admin_id())
on conflict (user_id) do nothing;

create or replace function public.academy_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.uid() = public.academy_primary_admin_id(), false);
$$;

revoke execute on function public.academy_is_admin() from public, anon;
grant execute on function public.academy_is_admin() to authenticated;

create or replace function public.academy_set_user_admin(
  target_user_id uuid,
  should_be_admin boolean
)
returns public.academy_admins
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.academy_admins;
begin
  if not public.academy_is_admin() then
    raise exception 'Primary administrator access required';
  end if;
  if target_user_id is null or should_be_admin is null then
    raise exception 'A target account and administrator setting are required';
  end if;

  if target_user_id = public.academy_primary_admin_id() and not should_be_admin then
    raise exception 'The primary administrator cannot be removed';
  end if;
  if should_be_admin and target_user_id <> public.academy_primary_admin_id() then
    raise exception 'Global administrator access is reserved for the primary administrator';
  end if;

  if should_be_admin then
    insert into public.academy_admins (user_id)
    values (target_user_id)
    on conflict (user_id) do update set user_id = excluded.user_id
    returning * into result;
  else
    delete from public.academy_admins
    where user_id = target_user_id
    returning * into result;
  end if;
  return result;
end;
$$;

revoke execute on function public.academy_set_user_admin(uuid, boolean)
  from public, anon;
grant execute on function public.academy_set_user_admin(uuid, boolean)
  to authenticated;

create table if not exists public.academy_school_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.academy_schools(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists academy_school_admins_school_idx
  on public.academy_school_admins (school_id);

alter table public.academy_school_admins enable row level security;
revoke all on public.academy_school_admins from anon, authenticated;
grant select on public.academy_school_admins to authenticated;

drop policy if exists academy_school_admins_read on public.academy_school_admins;
create policy academy_school_admins_read
  on public.academy_school_admins
  for select to authenticated
  using (user_id = auth.uid() or public.academy_is_admin());

create or replace function public.academy_is_school_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.academy_school_admins
    where user_id = auth.uid()
  );
$$;

revoke execute on function public.academy_is_school_admin() from public, anon;
grant execute on function public.academy_is_school_admin() to authenticated;

create or replace function public.academy_school_admin_can_manage_student(
  target_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.academy_school_admins school_admin
    join public.academy_profiles student
      on student.school_id = school_admin.school_id
     and student.role = 'student'
    where school_admin.user_id = auth.uid()
      and student.id = target_student_id
  );
$$;

revoke execute on function public.academy_school_admin_can_manage_student(uuid)
  from public, anon, authenticated;

create or replace function public.academy_set_school_admin(
  target_user_id uuid,
  target_school_id uuid
)
returns public.academy_school_admins
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.academy_school_admins;
begin
  if not public.academy_is_admin() then
    raise exception 'Primary administrator access required';
  end if;
  if target_user_id = public.academy_primary_admin_id() then
    raise exception 'The primary administrator cannot be assigned a school role';
  end if;
  if not exists (select 1 from public.academy_profiles where id = target_user_id) then
    raise exception 'Account profile not found';
  end if;

  if target_school_id is null then
    delete from public.academy_school_admins
    where user_id = target_user_id
    returning * into result;
    return result;
  end if;

  if not exists (
    select 1 from public.academy_schools
    where id = target_school_id and is_active
  ) then
    raise exception 'An active school is required';
  end if;

  insert into public.academy_school_admins (user_id, school_id, created_by)
  values (target_user_id, target_school_id, auth.uid())
  on conflict (user_id) do update
    set school_id = excluded.school_id,
        created_by = excluded.created_by,
        created_at = now()
  returning * into result;
  return result;
end;
$$;

revoke execute on function public.academy_set_school_admin(uuid, uuid)
  from public, anon;
grant execute on function public.academy_set_school_admin(uuid, uuid)
  to authenticated;

create or replace function public.academy_school_admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  assigned_school public.academy_schools;
  dashboard jsonb;
begin
  if not public.academy_is_school_admin() then
    raise exception 'School administrator access required' using errcode = '42501';
  end if;

  select school.*
    into assigned_school
  from public.academy_school_admins school_admin
  join public.academy_schools school on school.id = school_admin.school_id
  where school_admin.user_id = auth.uid();

  if assigned_school.id is null then
    raise exception 'No school is assigned to this account' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'school', jsonb_build_object(
      'id', assigned_school.id,
      'name', assigned_school.name,
      'code', assigned_school.code,
      'state', assigned_school.state,
      'city', assigned_school.city
    ),
    'courses', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', course.id, 'title', course.title)
        order by course.sort_order, course.title
      )
      from public.academy_courses course
      where course.is_active
    ), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(student_row.details order by student_row.display_name)
      from (
        select
          profile.display_name,
          jsonb_build_object(
            'id', profile.id,
            'display_name', profile.display_name,
            'email', profile.email,
            'state', profile.state,
            'city', profile.city,
            'registration_number', registration.registration_number,
            'student_level', profile.student_level,
            'current_course_id', profile.current_course_id,
            'course_title', course.title,
            'completed_lessons', coalesce(progress.completed_lessons, 0),
            'learning_seconds', coalesce(activity.learning_seconds, 0),
            'last_active_at', activity.last_active_at,
            'verified_points', coalesce(points.verified_points, 0)
          ) as details
        from public.academy_profiles profile
        left join public.academy_registration_codes registration
          on registration.id = profile.registration_code_id
        left join public.academy_courses course
          on course.id = profile.current_course_id
        left join lateral (
          select count(*)::integer as completed_lessons
          from public.academy_lesson_progress lesson_progress
          where lesson_progress.student_id = profile.id
            and lesson_progress.completed_at is not null
        ) progress on true
        left join lateral (
          select
            coalesce(sum(learning_session.active_seconds), 0)::bigint
              as learning_seconds,
            max(learning_session.last_heartbeat_at) as last_active_at
          from public.academy_learning_sessions learning_session
          where learning_session.student_id = profile.id
        ) activity on true
        left join lateral (
          select coalesce(sum(leaderboard.points), 0)::bigint
            as verified_points
          from public.academy_leaderboard_points leaderboard
          where leaderboard.student_id = profile.id
            and leaderboard.verification_status = 'verified'
        ) points on true
        where profile.school_id = assigned_school.id
          and profile.role = 'student'
      ) student_row
    ), '[]'::jsonb)
  )
  into dashboard;

  return dashboard;
end;
$$;

revoke execute on function public.academy_school_admin_dashboard()
  from public, anon;
grant execute on function public.academy_school_admin_dashboard()
  to authenticated;

create or replace function public.academy_is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.academy_is_admin()
    or (
      exists (
        select 1
        from public.academy_profiles
        where id = auth.uid() and role = 'teacher'
      )
      and not exists (
        select 1
        from public.academy_school_admins
        where user_id = auth.uid()
      )
    );
$$;

revoke execute on function public.academy_is_teacher() from public, anon;
grant execute on function public.academy_is_teacher() to authenticated;

create or replace function public.academy_assign_student_course(
  target_student_id uuid,
  target_course_id uuid
)
returns public.academy_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_profile public.academy_profiles;
begin
  if not public.academy_is_teacher()
    and not public.academy_is_admin()
    and not public.academy_school_admin_can_manage_student(target_student_id)
  then
    raise exception 'You cannot change this student''s course.'
      using errcode = '42501';
  end if;
  if target_course_id is not null
    and not exists (
      select 1 from public.academy_courses
      where id = target_course_id and is_active
    )
  then
    raise exception 'Course is not available.';
  end if;

  update public.academy_enrollments
  set status = 'completed'
  where student_id = target_student_id and status = 'active';

  if target_course_id is not null then
    insert into public.academy_enrollments (student_id, course_id, status)
    values (target_student_id, target_course_id, 'active')
    on conflict (student_id, course_id) do update set status = 'active';
  end if;

  update public.academy_profiles
  set current_course_id = target_course_id,
      updated_at = now()
  where id = target_student_id and role = 'student'
  returning * into assigned_profile;

  if assigned_profile.id is null then
    raise exception 'Student profile not found.';
  end if;
  return assigned_profile;
end;
$$;

revoke execute on function public.academy_assign_student_course(uuid, uuid)
  from public, anon;
grant execute on function public.academy_assign_student_course(uuid, uuid)
  to authenticated;

notify pgrst, 'reload schema';
