-- Issue registration numbers only after email verification, and require each
-- student profile to use a school already provisioned in Academy.

create or replace function public.academy_validate_student_school()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_school public.academy_schools%rowtype;
begin
  if new.role <> 'student' then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.role is not distinct from old.role
    and new.school_id is not distinct from old.school_id
    and new.state is not distinct from old.state
    and new.city is not distinct from old.city then
    return new;
  end if;

  select * into selected_school
  from public.academy_schools
  where id = new.school_id
    and is_active;

  if not found then
    raise exception 'Select a school from the available Academy school list.';
  end if;

  new.state := selected_school.state;
  new.city := selected_school.city;
  return new;
end;
$$;

drop trigger if exists academy_validate_student_school on public.academy_profiles;
create trigger academy_validate_student_school
  before insert or update on public.academy_profiles
  for each row execute function public.academy_validate_student_school();

-- Keep assigned numbers and their audit history, but remove reserved numbers
-- that were never assigned to any student.
drop trigger if exists academy_registration_code_delete_guard
  on public.academy_registration_codes;

update public.academy_registration_audit
set registration_code_id = null
where registration_code_id in (
  select codes.id
  from public.academy_registration_codes codes
  where codes.status = 'available'
    and codes.claimed_by is null
    and not exists (
      select 1
      from public.academy_profiles profiles
      where profiles.registration_code_id = codes.id
    )
);

delete from public.academy_registration_codes codes
where codes.status = 'available'
  and codes.claimed_by is null
  and not exists (
    select 1
    from public.academy_profiles profiles
    where profiles.registration_code_id = codes.id
  );

create or replace function public.academy_registration_code_delete_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'postgres'
    and coalesce(current_setting('academy.registration_cleanup', true), '0') = '1' then
    return old;
  end if;
  if old.status <> 'available' or old.claimed_by is not null then
    raise exception 'An issued registration number cannot be deleted. Withdraw it instead, which keeps the number from being reissued.';
  end if;
  if not public.academy_is_admin() then
    raise exception 'Only Academy administrators can delete unused registration numbers.';
  end if;
  return old;
end;
$$;

create trigger academy_registration_code_delete_guard
  before delete on public.academy_registration_codes
  for each row execute function public.academy_registration_code_delete_guard();

-- Old signup behavior provisioned numbers before email confirmation. Those
-- students never received their number, so remove only those pending claims;
-- confirmed or otherwise assigned numbers remain untouched.
do $$
declare
  pending_registration record;
begin
  for pending_registration in
    select codes.id as code_id, users.id as student_id
    from auth.users users
    join public.academy_registration_codes codes
      on codes.claimed_by = users.id
     and codes.status = 'provisional'
    where users.email_confirmed_at is null
    for update of codes
  loop
    perform set_config('academy.registration_change', '1', true);
    update public.academy_profiles
    set registration_code_id = null, updated_at = now()
    where id = pending_registration.student_id
      and registration_code_id = pending_registration.code_id;
    perform set_config('academy.registration_change', '0', true);

    update public.academy_registration_audit
    set registration_code_id = null
    where registration_code_id = pending_registration.code_id;

    perform set_config('academy.registration_cleanup', '1', true);
    delete from public.academy_registration_codes
    where id = pending_registration.code_id;
    perform set_config('academy.registration_cleanup', '0', true);
  end loop;
end;
$$;

-- A manual number change consumes the old serial too. Retain that high-water
-- mark from the audit log so future allocations never reuse it.
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
  perform pg_advisory_xact_lock(
    hashtextextended('academy-registration-' || target_year::text, 0)
  );

  select greatest(
    coalesce((
      select max(serial_number)
      from public.academy_registration_codes
      where registration_year = target_year
    ), 0),
    coalesce((
      select max(substring(registration_number from 8)::integer)
      from public.academy_registration_audit
      where registration_code_id is not null
        and registration_number ~ (
          '^ATE-' || lpad((target_year % 100)::text, 2, '0') || '-[0-9]{3}$'
        )
    ), 0)
  ) + 1
  into next_serial;

  if next_serial > 999 then
    raise exception 'Registration numbers for % are exhausted. Start a new registration year.', target_year;
  end if;

  return next_serial;
end;
$$;

revoke execute on function public.academy_next_registration_serial(integer)
  from public, anon, authenticated;

-- A student who never confirms never receives a number. If an older pending
-- signup did reserve one, release its profile and audit references, then remove
-- that number so the serial remains available for a confirmed student.
create or replace function public.academy_release_provisional_registration_on_user_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  code_row public.academy_registration_codes%rowtype;
begin
  for code_row in
    select *
    from public.academy_registration_codes
    where claimed_by = old.id
      and status = 'provisional'
    for update
  loop
    perform set_config('academy.registration_change', '1', true);
    update public.academy_profiles
    set registration_code_id = null, updated_at = now()
    where registration_code_id = code_row.id;
    perform set_config('academy.registration_change', '0', true);

    update public.academy_registration_audit
    set registration_code_id = null
    where registration_code_id = code_row.id;

    perform set_config('academy.registration_cleanup', '1', true);
    delete from public.academy_registration_codes
    where id = code_row.id;
    perform set_config('academy.registration_cleanup', '0', true);
  end loop;

  return old;
end;
$$;

drop trigger if exists academy_release_provisional_registration_on_user_delete
  on auth.users;
create trigger academy_release_provisional_registration_on_user_delete
before delete on auth.users
for each row
execute function public.academy_release_provisional_registration_on_user_delete();

-- Signup creates the profile but does not allocate a number. The same trigger
-- issues a number only when Auth changes email_confirmed_at from null to set.
create or replace function public.academy_registration_claim_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_school public.academy_schools%rowtype;
  profile_row public.academy_profiles%rowtype;
  code_row public.academy_registration_codes%rowtype;
  target_year integer;
  next_serial integer;
begin
  if tg_op = 'INSERT' then
    select * into selected_school
    from public.academy_schools
    where code = nullif(new.raw_user_meta_data ->> 'school_code', '')
      and is_active;

    if not found then
      raise exception 'Select a school from the available Academy school list.';
    end if;

    insert into public.academy_profiles (
      id, display_name, role, school_id, state, city, email
    ) values (
      new.id,
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        split_part(new.email, '@', 1)
      ),
      'student',
      selected_school.id,
      selected_school.state,
      selected_school.city,
      lower(new.email)
    );
  elsif old.email_confirmed_at is not null or new.email_confirmed_at is null then
    return new;
  end if;

  if new.email_confirmed_at is null then
    return new;
  end if;

  select * into profile_row
  from public.academy_profiles
  where id = new.id
  for update;

  if not found then
    raise exception 'The student profile could not be found for email confirmation.';
  end if;

  target_year := extract(year from new.email_confirmed_at)::integer;

  if profile_row.registration_code_id is not null then
    select * into code_row
    from public.academy_registration_codes
    where id = profile_row.registration_code_id
    for update;

    if not found or code_row.claimed_by <> new.id then
      raise exception 'The student registration number could not be verified.';
    end if;

    if code_row.status = 'provisional' then
      update public.academy_registration_codes
      set status = 'claimed',
          accepted_at = coalesce(accepted_at, new.email_confirmed_at),
          updated_at = now()
      where id = code_row.id
      returning * into code_row;

      insert into public.academy_registration_audit (
        actor_id, student_id, registration_code_id, registration_number, action, metadata
      ) values (
        new.id, new.id, code_row.id, code_row.registration_number, 'confirmed',
        jsonb_build_object('source', 'email_confirmation')
      );
    end if;

    return new;
  end if;

  select * into code_row
  from public.academy_registration_codes
  where claimed_by = new.id
  for update;

  if found then
    if code_row.status = 'provisional' then
      update public.academy_registration_codes
      set status = 'claimed',
          accepted_at = coalesce(accepted_at, new.email_confirmed_at),
          updated_at = now()
      where id = code_row.id
      returning * into code_row;

      insert into public.academy_registration_audit (
        actor_id, student_id, registration_code_id, registration_number, action, metadata
      ) values (
        new.id, new.id, code_row.id, code_row.registration_number, 'confirmed',
        jsonb_build_object('source', 'email_confirmation')
      );
    end if;

    perform set_config('academy.registration_change', '1', true);
    update public.academy_profiles
    set registration_code_id = code_row.id, updated_at = now()
    where id = new.id;
    perform set_config('academy.registration_change', '0', true);

    return new;
  end if;

  next_serial := public.academy_next_registration_serial(target_year);
  insert into public.academy_registration_codes (
    registration_year,
    serial_number,
    status,
    claimed_by,
    claimed_at,
    accepted_at,
    updated_at
  ) values (
    target_year,
    next_serial,
    'claimed',
    new.id,
    new.email_confirmed_at,
    new.email_confirmed_at,
    now()
  )
  returning * into code_row;

  perform set_config('academy.registration_change', '1', true);
  update public.academy_profiles
  set registration_code_id = code_row.id, updated_at = now()
  where id = new.id;
  perform set_config('academy.registration_change', '0', true);

  insert into public.academy_registration_audit (
    actor_id, student_id, registration_code_id, registration_number, action, metadata
  ) values (
    new.id, new.id, code_row.id, code_row.registration_number, 'assigned',
    jsonb_build_object('source', 'email_confirmation', 'status', 'claimed')
  );

  return new;
end;
$$;

drop trigger if exists academy_registration_signup_claim on auth.users;
drop trigger if exists academy_registration_email_confirmation on auth.users;
create trigger academy_registration_signup_claim
  after insert on auth.users
  for each row execute function public.academy_registration_claim_signup();
create trigger academy_registration_email_confirmation
  after update of email_confirmed_at on auth.users
  for each row execute function public.academy_registration_claim_signup();

-- Correct the edit lock to use the registration year and preserve the existing
-- collision check and audit trail for administrator changes.
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
  previous_number text;
begin
  if not public.academy_is_admin() then
    raise exception 'Only Academy administrators can edit registration numbers.';
  end if;
  if p_new_serial is null or p_new_serial < 1 or p_new_serial > 999 then
    raise exception 'A registration serial must be between 1 and 999.';
  end if;

  select * into code_row
  from public.academy_registration_codes
  where id = p_registration_code_id;

  if not found then
    raise exception 'Registration number not found.';
  end if;

  previous_number := code_row.registration_number;

  perform pg_advisory_xact_lock(
    hashtextextended('academy-registration-' || code_row.registration_year::text, 0)
  );

  select * into code_row
  from public.academy_registration_codes
  where id = p_registration_code_id
  for update;

  if exists (
    select 1
    from public.academy_registration_codes
    where registration_year = code_row.registration_year
      and serial_number = p_new_serial
      and id <> p_registration_code_id
  ) then
    raise exception 'That number is already in use for %.', code_row.registration_year;
  end if;

  if exists (
    select 1
    from public.academy_registration_audit
    where registration_code_id is not null
      and registration_number = (
        'ATE-' ||
        lpad((code_row.registration_year % 100)::text, 2, '0') ||
        '-' ||
        lpad(p_new_serial::text, 3, '0')
      )
      and student_id is distinct from code_row.claimed_by
  ) then
    raise exception 'That number was previously assigned to another student.';
  end if;

  update public.academy_registration_codes
  set serial_number = p_new_serial, updated_at = now()
  where id = p_registration_code_id
  returning * into code_row;

  insert into public.academy_registration_audit (
    actor_id, student_id, registration_code_id, registration_number, action, metadata
  ) values (
    auth.uid(), code_row.claimed_by, code_row.id, previous_number, 'edited',
    jsonb_build_object(
      'new_serial', p_new_serial,
      'new_registration_number', code_row.registration_number
    )
  );

  return code_row;
end;
$$;

-- There is no longer an admin path that creates unassigned registration
-- numbers; numbers are created atomically for confirmed student accounts.
revoke execute on function public.academy_generate_registration_codes(integer, integer)
  from public, anon, authenticated;
revoke execute on function public.academy_assign_registration_code(uuid, text)
  from public, anon, authenticated;

-- Existing confirmed students without an assigned number receive one without
-- changing any number already attached to a student.
do $$
declare
  student_row record;
  code_row public.academy_registration_codes%rowtype;
  target_year integer;
  next_serial integer;
begin
  for student_row in
    select profiles.id, users.email_confirmed_at
    from public.academy_profiles profiles
    join auth.users users on users.id = profiles.id
    where profiles.role = 'student'
      and profiles.registration_code_id is null
      and users.email_confirmed_at is not null
    order by users.created_at, profiles.id
  loop
    target_year := extract(year from student_row.email_confirmed_at)::integer;

    select * into code_row
    from public.academy_registration_codes
    where claimed_by = student_row.id
    for update;

    if found then
      if code_row.status = 'provisional' then
        update public.academy_registration_codes
        set status = 'claimed',
            accepted_at = coalesce(accepted_at, student_row.email_confirmed_at),
            updated_at = now()
        where id = code_row.id
        returning * into code_row;

        insert into public.academy_registration_audit (
          actor_id, student_id, registration_code_id, registration_number, action, metadata
        ) values (
          null, student_row.id, code_row.id, code_row.registration_number, 'confirmed',
          jsonb_build_object('source', 'verified_student_backfill')
        );
      end if;
    else
      next_serial := public.academy_next_registration_serial(target_year);

      insert into public.academy_registration_codes (
        registration_year, serial_number, status, claimed_by, claimed_at,
        accepted_at, updated_at
      ) values (
        target_year, next_serial, 'claimed', student_row.id,
        student_row.email_confirmed_at, student_row.email_confirmed_at, now()
      )
      returning * into code_row;

      insert into public.academy_registration_audit (
        actor_id, student_id, registration_code_id, registration_number, action, metadata
      ) values (
        null, student_row.id, code_row.id, code_row.registration_number, 'assigned',
        jsonb_build_object('source', 'verified_student_backfill')
      );
    end if;

    perform set_config('academy.registration_change', '1', true);
    update public.academy_profiles
    set registration_code_id = code_row.id, updated_at = now()
    where id = student_row.id;
    perform set_config('academy.registration_change', '0', true);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
