-- Let a student see whether their number is provisional or final.
--
-- academy_my_registration_number returns only the number, so a student cannot
-- tell an automatically issued provisional number from one an administrator
-- has accepted. That matters now that every student is issued one on signup:
-- "here is your number" means something different before acceptance.
--
-- The original function is left in place, since it is already referenced.

create or replace function public.academy_my_registration()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'registration_number', codes.registration_number,
    'status', codes.status,
    'is_final', codes.status = 'claimed',
    'registration_year', codes.registration_year,
    'serial_number', codes.serial_number,
    'issued_at', codes.claimed_at,
    'accepted_at', codes.accepted_at
  )
  from public.academy_profiles as profiles
  join public.academy_registration_codes as codes
    on codes.id = profiles.registration_code_id
  where profiles.id = auth.uid();
$$;

revoke execute on function public.academy_my_registration() from public, anon;
grant execute on function public.academy_my_registration() to authenticated;

notify pgrst, 'reload schema';
