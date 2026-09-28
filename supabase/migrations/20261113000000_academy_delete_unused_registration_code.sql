-- Delete an unused registration number.
--
-- The admin role has no table level delete grant on academy_registration_codes,
-- which is deliberate and consistent with the rest of this schema, where every
-- privileged operation is a security definer function rather than a direct
-- write. So delete goes through a function too, and the trigger guard stays as
-- defence in depth for anything that does have the grant.
--
-- An issued number is refused. Withdraw it with academy_void_registration
-- instead, which keeps its serial so it can never be handed to another student.

create or replace function public.academy_delete_registration_code(
  p_registration_code_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  code_row public.academy_registration_codes%rowtype;
begin
  if not public.academy_is_admin() then
    raise exception 'Only Academy administrators can delete unused registration numbers.';
  end if;

  select * into code_row
  from public.academy_registration_codes
  where id = p_registration_code_id
  for update;

  if not found then
    raise exception 'Registration number not found.';
  end if;

  if code_row.status <> 'available' or code_row.claimed_by is not null then
    raise exception 'That number has been issued, so it cannot be deleted. Withdraw it instead, which keeps the number from being reissued.';
  end if;

  insert into public.academy_registration_audit (
    actor_id, student_id, registration_code_id, registration_number, action, metadata
  ) values (
    auth.uid(), null, code_row.id, code_row.registration_number, 'deleted',
    jsonb_build_object('serial_number', code_row.serial_number, 'year', code_row.registration_year)
  );

  -- The audit row keeps the number and the serial, but drops the foreign key,
  -- otherwise the delete below is refused by its own audit trail. The record
  -- that a serial was consumed matters more than the ability to join to a row
  -- that no longer exists.
  update public.academy_registration_audit
  set registration_code_id = null
  where registration_code_id = code_row.id
    and action = 'deleted';

  delete from public.academy_registration_codes where id = code_row.id;
  return true;
end;
$$;

revoke execute on function public.academy_delete_registration_code(uuid) from public, anon;
grant execute on function public.academy_delete_registration_code(uuid) to authenticated;

notify pgrst, 'reload schema';
