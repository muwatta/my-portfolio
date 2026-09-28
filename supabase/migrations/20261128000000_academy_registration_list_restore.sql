-- Restore academy_admin_registration_list to its known good shape.
--
-- An earlier version tried to widen this function to return the registration
-- code id and serial as well, so the admin page could edit and delete numbers.
-- That failed at runtime with "structure of query does not match function
-- result type" on every call, which broke the whole registrations admin page.
-- The cause was not worth chasing while it was taking a working page down.
--
-- This restores the original seven column signature and body byte for byte,
-- changing one thing only: the status filter now accepts provisional and
-- voided. Without that, filtering for students awaiting acceptance raised
-- "Registration status filter is not valid", so the new lifecycle was
-- invisible to the very page that manages it.
--
-- Editing and deleting a number are not wired into the admin page yet. The
-- functions exist and are verified (academy_edit_registration_number and
-- academy_delete_registration_code), so the page can be extended later without
-- further schema work.

drop function if exists public.academy_admin_registration_list(text, text);

create or replace function public.academy_admin_registration_list(
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
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.academy_is_admin() then
    raise exception 'Only Academy administrators can view registration numbers.';
  end if;
  if status_filter is not null
    and status_filter not in (
      'available', 'provisional', 'claimed', 'suspended', 'voided'
    ) then
    raise exception 'Registration status filter is not valid.';
  end if;

  return query
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
  where (
      nullif(trim(search_text), '') is null
      or lower(concat_ws(' ', codes.registration_number, profile_row.display_name, auth_user.email))
        like '%' || lower(trim(search_text)) || '%'
    )
    and (nullif(trim(status_filter), '') is null or codes.status = status_filter)
  order by codes.registration_year desc, codes.serial_number;
end;
$$;

revoke execute on function public.academy_admin_registration_list(text, text) from public, anon;
grant execute on function public.academy_admin_registration_list(text, text) to authenticated;

notify pgrst, 'reload schema';
