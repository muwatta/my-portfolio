create or replace function public.academy_claim_registration_from_metadata()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.academy_profiles%rowtype;
  code_row public.academy_registration_codes%rowtype;
  requested_number text;
  newly_claimed boolean := false;
begin
  if auth.uid() is null then
    return null;
  end if;

  select * into profile_row
  from public.academy_profiles
  where id = auth.uid();

  if profile_row.id is null then
    insert into public.academy_profiles (id, display_name, role)
    values (
      auth.uid(),
      coalesce(
        nullif((select raw_user_meta_data ->> 'display_name' from auth.users where id = auth.uid()), ''),
        split_part((select email from auth.users where id = auth.uid()), '@', 1),
        'Student'
      ),
      'student'
    )
    on conflict (id) do nothing;
    select * into profile_row
    from public.academy_profiles
    where id = auth.uid();
    if profile_row.id is null then
      return null;
    end if;
  end if;

  if profile_row.registration_code_id is not null then
    select registration_number into requested_number
    from public.academy_registration_codes
    where id = profile_row.registration_code_id;
    return requested_number;
  end if;

  select upper(trim(coalesce(raw_user_meta_data ->> 'registration_number', '')))
  into requested_number
  from auth.users
  where id = auth.uid();

  if requested_number is null or requested_number !~ '^ATE-[0-9]{2}-[0-9]{3}$' then
    return null;
  end if;

  select * into code_row
  from public.academy_registration_codes
  where registration_number = requested_number
  for update;

  if not found or code_row.status = 'suspended' then
    return null;
  end if;

  if code_row.claimed_by is not null and code_row.claimed_by <> auth.uid() then
    return null;
  end if;

  if code_row.claimed_by is null then
    update public.academy_registration_codes
    set status = 'claimed',
        claimed_by = auth.uid(),
        claimed_at = now(),
        updated_at = now()
    where id = code_row.id;
    newly_claimed := true;
  end if;

  perform set_config('academy.registration_change', '1', true);
  update public.academy_profiles
  set registration_code_id = code_row.id
  where id = auth.uid();

  if newly_claimed then
    insert into public.academy_registration_audit (
      actor_id,
      student_id,
      registration_code_id,
      registration_number,
      action,
      metadata
    ) values (
      auth.uid(),
      auth.uid(),
      code_row.id,
      code_row.registration_number,
      'assigned',
      jsonb_build_object('source', 'login_claim')
    );
  end if;

  return code_row.registration_number;
end;
$$;

create or replace function public.academy_my_registration_number()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select codes.registration_number
  from public.academy_profiles as profiles
  join public.academy_registration_codes as codes
    on codes.id = profiles.registration_code_id
  where profiles.id = auth.uid();
$$;

revoke execute on function public.academy_claim_registration_from_metadata() from public, anon;
grant execute on function public.academy_claim_registration_from_metadata() to authenticated;
revoke execute on function public.academy_my_registration_number() from public, anon;
grant execute on function public.academy_my_registration_number() to authenticated;
