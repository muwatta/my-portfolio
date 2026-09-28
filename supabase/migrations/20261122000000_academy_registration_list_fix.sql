-- Correct academy_admin_registration_list, which could not run.
--
-- The previous version ordered active enrollments by enrollments.started_at.
-- That column does not exist on public.academy_enrollments; the column is
-- enrolled_at. plpgsql does not check SQL inside a function body at creation
-- time, so the function was created successfully and then failed on every
-- call, which would have broken the whole registrations admin page rather than
-- just the new columns.

drop function if exists public.academy_admin_registration_list(text, text);

create or replace function public.academy_admin_registration_list(
  search_text text default null,
  status_filter text default null
)
returns table (
  registration_code_id uuid,
  registration_number text,
  status text,
  serial_number smallint,
  registration_year smallint,
  issued_at timestamptz,
  accepted_at timestamptz,
  is_final boolean,
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
    codes.id,
    codes.registration_number,
    codes.status,
    codes.serial_number,
    codes.registration_year,
    codes.claimed_at,
    codes.accepted_at,
    codes.status = 'claimed',
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
      search_text is null
      or btrim(search_text) = ''
      or codes.registration_number ilike '%' || btrim(search_text) || '%'
      or profile_row.display_name ilike '%' || btrim(search_text) || '%'
      or auth_user.email ilike '%' || btrim(search_text) || '%'
    )
    and (status_filter is null or codes.status = status_filter)
  order by codes.registration_year desc, codes.serial_number asc;
end;
$$;

revoke execute on function public.academy_admin_registration_list(text, text) from public, anon;
grant execute on function public.academy_admin_registration_list(text, text) to authenticated;

notify pgrst, 'reload schema';
