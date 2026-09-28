-- Correct academy_delete_registration_code, which could never have worked.
--
-- It inserted an academy_registration_audit row carrying a foreign key to the
-- code, then tried to delete that code. The delete was always refused by its own
-- audit trail, so no administrator could ever delete an unused number. Editing
-- the original migration would not have fixed this, because that file was
-- already applied; the corrected function has to ship as a new version.

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

  -- Release the foreign key before deleting. The audit row keeps the number and
  -- the serial, so the fact that this serial was consumed is still on record;
  -- what is lost is only the join to a row that no longer exists.
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
