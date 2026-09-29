-- One account per email address, enforced by the database.
--
-- auth.users already refuses a duplicate address, but academy_profiles had no
-- email column at all, so nothing below the auth layer could check for one. That
-- left duplicate detection dependent on parsing an error string, and left the
-- administrators page unable to show who an account belongs to.
--
-- Email is added here, kept in sync from auth.users, and given a unique index so
-- a second profile for the same address is refused by the database rather than
-- by whichever code path happened to check first. Deleting the account frees the
-- address again, because the row goes with it, so a removed student can
-- register afresh.

alter table public.academy_profiles
  add column if not exists email text;

create unique index if not exists academy_profiles_email_key
  on public.academy_profiles (lower(email))
  where email is not null;

-- Backfill before the trigger lands, so existing rows are not left empty.
update public.academy_profiles p
   set email = lower(u.email)
  from auth.users u
 where u.id = p.id
   and p.email is null
   and u.email is not null;

-- Keep the profile's copy of the address current, including when an
-- administrator changes it from the account management function.
create or replace function public.academy_sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and (old.email is null or lower(old.email) is distinct from lower(new.email)) then
    update public.academy_profiles
    set email = lower(new.email), updated_at = now()
    where id = new.id
      and (email is null or lower(email) is distinct from lower(new.email));
  end if;
  return new;
end;
$$;

drop trigger if exists academy_auth_user_email on auth.users;
create trigger academy_auth_user_email
after insert or update of email on auth.users
for each row execute procedure public.academy_sync_profile_email();

-- Signup creates the profile, so it must carry the address too. The previous
-- version of this function inserted the profile without one, which would have
-- failed the unique index on the second student to register.
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
    select * into code_row
    from public.academy_registration_codes
    where registration_number = normalized_number
    for update;

    if not found or code_row.status <> 'available' or code_row.claimed_by is not null then
      raise exception 'We couldn''t verify this registration number. Please check your Academy registration details or contact your teacher.';
    end if;

    update public.academy_registration_codes
    set status = 'provisional', claimed_by = new.id, claimed_at = now(), updated_at = now()
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
      set claimed_by = excluded.claimed_by, claimed_at = excluded.claimed_at,
          status = 'provisional', updated_at = now()
    returning * into code_row;
  end if;

  insert into public.academy_profiles (
    id, display_name, role, school_id, state, city, registration_code_id, email
  ) values (
    new.id,
    display_name,
    'student',
    (select id from public.academy_schools where code = requested_school and is_active),
    nullif(new.raw_user_meta_data ->> 'state', ''),
    nullif(new.raw_user_meta_data ->> 'city', ''),
    code_row.id,
    lower(new.email)
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

notify pgrst, 'reload schema';
