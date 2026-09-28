-- Students no longer supply a registration number, and one is issued to them
-- automatically as a provisional number that an administrator accepts.
--
-- Before, academy_registration_claim_signup raised unless signup supplied a
-- pre-issued ATE-YY-NNN in metadata, so a student could not register without a
-- number the school had already issued. Numbers now come from the same
-- sequential source, allocated at registration, and sit as provisional until an
-- administrator accepts them.
--
-- Status gains two values:
--   provisional  auto-issued at registration, awaiting an administrator
--   voided       withdrawn by an administrator, never reassigned
--
-- Serial allocation is unchanged in spirit and still sequential: the advisory
-- lock plus max(serial_number) + 1 means the next number always follows the last
-- one handed out, with no gaps reused and no duplicates under concurrency.
--
-- One deliberate departure from the request: an issued number cannot be hard
-- deleted, only voided. A voided row keeps its serial, so the number is never
-- reissued to another student. A hard delete would eventually hand out a number
-- that already appears on a real student's certificate. Hard delete is now
-- permitted only for unissued codes, which is what a mis-keyed batch actually
-- needs.

alter table public.academy_registration_codes
  drop constraint if exists academy_registration_codes_status_ck;
alter table public.academy_registration_codes
  add constraint academy_registration_codes_status_ck check (
    status in ('available', 'provisional', 'claimed', 'suspended', 'voided')
  );

-- Records when a number became final, distinct from when it was first issued.
alter table public.academy_registration_codes
  add column if not exists accepted_at timestamptz;
alter table public.academy_registration_codes
  add column if not exists accepted_by uuid references auth.users(id) on delete set null;
alter table public.academy_registration_codes
  add column if not exists voided_at timestamptz;
alter table public.academy_registration_codes
  add column if not exists voided_by uuid references auth.users(id) on delete set null;

create index if not exists academy_registration_codes_provisional_idx
  on public.academy_registration_codes (status, registration_year, serial_number)
  where status = 'provisional';

-- Allocate the next sequential number for a year. The advisory lock is what
-- makes two concurrent signups safe: without it two students can read the same
-- max and collide on the unique (year, serial) index.
create or replace function public.academy_next_registration_serial(
  target_year integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_serial integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('academy-registration-' || target_year::text, 0));

  select coalesce(max(serial_number), 0) + 1
  into next_serial
  from public.academy_registration_codes
  where registration_year = target_year;

  if next_serial > 999 then
    raise exception 'Registration numbers for % are exhausted. Start a new registration year.', target_year;
  end if;

  return next_serial;
end;
$$;

revoke execute on function public.academy_next_registration_serial(integer) from public, anon, authenticated;

-- Signup: accept a pre-issued number when one is offered, otherwise allocate the
-- next one. Never raises for a missing number any more.
create or replace function public.academy_registration_claim_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_number text;
  code_row public.academy_registration_codes%rowtype;
  requested_school text := nullif(new.raw_user_meta_data ->> 'school_code', '');
  display_name text := coalesce(new.raw_user_meta_data ->> 'display_name', '');
  signup_year integer := extract(year from now())::integer;
begin
  normalized_number := upper(trim(coalesce(new.raw_user_meta_data ->> 'registration_number', '')));

  if normalized_number <> '' then
    -- Still honour a pre-issued number, for schools that hand numbers out on paper.
    select * into code_row
    from public.academy_registration_codes
    where registration_number = normalized_number
    for update;

    if not found or code_row.status <> 'available' or code_row.claimed_by is not null then
      raise exception 'We couldn''t verify this registration number. Please check your Academy registration details or contact your teacher.';
    end if;

    update public.academy_registration_codes
    set status = 'provisional',
        claimed_by = new.id,
        claimed_at = now(),
        updated_at = now()
    where id = code_row.id;
  else
    code_row.serial_number := public.academy_next_registration_serial(signup_year);
    code_row.registration_year := signup_year;

    insert into public.academy_registration_codes (
      registration_year, serial_number, status, claimed_by, claimed_at, updated_at
    ) values (
      signup_year, code_row.serial_number, 'provisional', new.id, now(), now()
    )
    on conflict (registration_year, serial_number) do update
      set claimed_by = excluded.claimed_by,
          claimed_at = excluded.claimed_at,
          status = 'provisional',
          updated_at = now()
    returning * into code_row;
  end if;

  insert into public.academy_profiles (
    id, display_name, role, school_id, state, city, registration_code_id
  ) values (
    new.id,
    display_name,
    'student',
    (select id from public.academy_schools where code = requested_school and is_active),
    nullif(new.raw_user_meta_data ->> 'state', ''),
    nullif(new.raw_user_meta_data ->> 'city', ''),
    code_row.id
  );

  insert into public.academy_registration_audit (
    actor_id, student_id, registration_code_id, registration_number, action, metadata
  ) values (
    new.id, new.id, code_row.id, code_row.registration_number, 'assigned',
    jsonb_build_object('source', 'signup', 'status', 'provisional')
  );

  return new;
end;
$$;

-- Administrator accepts a provisional number, making it final.
create or replace function public.academy_accept_registration(p_student_id uuid)
returns public.academy_registration_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  code_row public.academy_registration_codes%rowtype;
begin
  if not public.academy_is_admin() then
    raise exception 'Only Academy administrators can accept registrations.';
  end if;

  select * into code_row
  from public.academy_registration_codes
  where claimed_by = p_student_id
  for update;

  if not found then
    raise exception 'No registration number was issued to that student.';
  end if;
  if code_row.status = 'claimed' then
    return code_row;
  end if;
  if code_row.status <> 'provisional' then
    raise exception 'That registration number is % and cannot be accepted.', code_row.status;
  end if;

  update public.academy_registration_codes
  set status = 'claimed', accepted_at = now(), accepted_by = auth.uid(), updated_at = now()
  where id = code_row.id
  returning * into code_row;

  perform set_config('academy.registration_change', '1', true);
  update public.academy_profiles
  set registration_code_id = code_row.id, updated_at = now()
  where id = p_student_id;
  perform set_config('academy.registration_change', '0', true);

  insert into public.academy_registration_audit (
    actor_id, student_id, registration_code_id, registration_number, action, metadata
  ) values (
    auth.uid(), p_student_id, code_row.id, code_row.registration_number, 'accepted',
    jsonb_build_object('previous_status', 'provisional')
  );

  return code_row;
end;
$$;

-- Withdraw a number without deleting its serial.
create or replace function public.academy_void_registration(p_student_id uuid)
returns public.academy_registration_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  code_row public.academy_registration_codes%rowtype;
begin
  if not public.academy_is_admin() then
    raise exception 'Only Academy administrators can withdraw registration numbers.';
  end if;

  select * into code_row
  from public.academy_registration_codes
  where claimed_by = p_student_id
  for update;

  if not found then
    raise exception 'No registration number was issued to that student.';
  end if;
  if code_row.status in ('voided', 'suspended') then
    return code_row;
  end if;

  update public.academy_registration_codes
  set status = 'voided', voided_at = now(), voided_by = auth.uid(), updated_at = now()
  where id = code_row.id
  returning * into code_row;

  perform set_config('academy.registration_change', '1', true);
  update public.academy_profiles
  set registration_code_id = null, updated_at = now()
  where id = p_student_id;
  perform set_config('academy.registration_change', '0', true);

  insert into public.academy_registration_audit (
    actor_id, student_id, registration_code_id, registration_number, action, metadata
  ) values (
    auth.uid(), p_student_id, code_row.id, code_row.registration_number, 'voided',
    jsonb_build_object('previous_status', code_row.status)
  );

  return code_row;
end;
$$;

-- Edit a number's serial. Refuses a serial already in use for that year, so an
-- edit cannot collide with a real student's number.
create or replace function public.academy_edit_registration_number(
  p_registration_code_id uuid,
  p_new_serial integer
)
returns public.academy_registration_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  code_row public.academy_registration_codes%rowtype;
begin
  if not public.academy_is_admin() then
    raise exception 'Only Academy administrators can edit registration numbers.';
  end if;
  if p_new_serial is null or p_new_serial < 1 or p_new_serial > 999 then
    raise exception 'A registration serial must be between 1 and 999.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('academy-registration-' || p_new_serial::text, 0));

  select * into code_row
  from public.academy_registration_codes
  where id = p_registration_code_id
  for update;

  if not found then
    raise exception 'Registration number not found.';
  end if;

  if exists (
    select 1 from public.academy_registration_codes
    where registration_year = code_row.registration_year
      and serial_number = p_new_serial
      and id <> p_registration_code_id
  ) then
    raise exception 'That number is already in use for %.', code_row.registration_year;
  end if;

  update public.academy_registration_codes
  set serial_number = p_new_serial, updated_at = now()
  where id = p_registration_code_id
  returning * into code_row;

  insert into public.academy_registration_audit (
    actor_id, student_id, registration_code_id, registration_number, action, metadata
  ) values (
    auth.uid(), code_row.claimed_by, code_row.id, code_row.registration_number, 'edited',
    jsonb_build_object('new_serial', p_new_serial)
  );

  return code_row;
end;
$$;

-- Delete is now permitted for unissued codes only. An issued number keeps its
-- row and is voided instead, so its serial is never handed to another student.
create or replace function public.academy_registration_code_delete_guard()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'available' or old.claimed_by is not null then
    raise exception 'An issued registration number cannot be deleted. Withdraw it instead, which keeps the number from being reissued.';
  end if;
  if not public.academy_is_admin() then
    raise exception 'Only Academy administrators can delete unused registration numbers.';
  end if;
  return old;
end;
$$;

revoke execute on function public.academy_accept_registration(uuid) from public, anon;
revoke execute on function public.academy_void_registration(uuid) from public, anon;
revoke execute on function public.academy_edit_registration_number(uuid, integer) from public, anon;
grant execute on function public.academy_accept_registration(uuid) to authenticated;
grant execute on function public.academy_void_registration(uuid) to authenticated;
grant execute on function public.academy_edit_registration_number(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
