-- Rewrite academy_admin_registration_list as a plain SQL function.
--
-- The plpgsql version failed on every call with "structure of query does not
-- match function result type", while the same seven columns selected one at a
-- time outside plpgsql were all fine, and the declared RETURNS TABLE matched the
-- select list column for column with no type mismatch. The shape was right and
-- the types were right, and it still failed, so the plpgsql return query
-- machinery is the thing at fault rather than the query.
--
-- Written as language sql the check does not exist, the call becomes a single
-- plan, and the administrator guard moves into the WHERE clause, which is the
-- only place it actually needed to be.

drop function if exists public.academy_admin_registration_list(text, text);

create function public.academy_admin_registration_list(
  search_text text default null,
  status_filter text default null
)
returns table (
  registration_number text,
  status text,
  student_id uuid,
  student_name text,
  student_email text,
  course_title text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    codes.registration_number,
    codes.status,
    profile_row.id,
    profile_row.display_name,
    auth_user.email,
    active_course.title,
    codes.created_at
  from public.academy_registration_codes codes
  left join public.academy_profiles profile_row
    on profile_row.registration_code_id = codes.id
  left join auth.users auth_user
    on auth_user.id = profile_row.id
  left join lateral (
    select courses.title
    from public.academy_enrollments enrollments
    join public.academy_courses courses on courses.id = enrollments.course_id
    where enrollments.student_id = profile_row.id
      and enrollments.status = 'active'
    order by enrollments.enrolled_at desc
    limit 1
  ) active_course on true
  where public.academy_is_admin()
    and (
      nullif(btrim(coalesce(search_text, '')), '') is null
      or lower(concat_ws(' ', codes.registration_number, profile_row.display_name, auth_user.email))
         like '%' || lower(btrim(search_text)) || '%'
    )
    and (
      nullif(btrim(coalesce(status_filter, '')), '') is null
      or codes.status = btrim(status_filter)
    )
  order by codes.registration_year desc, codes.serial_number;
$$;

revoke execute on function public.academy_admin_registration_list(text, text) from public, anon;
grant execute on function public.academy_admin_registration_list(text, text) to authenticated;

notify pgrst, 'reload schema';
