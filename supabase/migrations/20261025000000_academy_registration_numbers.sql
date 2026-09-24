create table if not exists public.academy_registration_codes (
  id uuid primary key default gen_random_uuid(),
  registration_year smallint not null,
  serial_number smallint not null,
  registration_number text generated always as (
    'ATE-' || lpad((registration_year % 100)::text, 2, '0') || '-' || lpad(serial_number::text, 3, '0')
  ) stored,
  status text not null default 'available',
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academy_registration_codes_format_ck check (
    registration_number ~ '^ATE-[0-9]{2}-[0-9]{3}$'
  ),
  constraint academy_registration_codes_year_ck check (
    registration_year between 2000 and 2099
  ),
  constraint academy_registration_codes_serial_ck check (
    serial_number between 1 and 999
  ),
  constraint academy_registration_codes_status_ck check (
    status in ('available', 'claimed', 'suspended')
  )
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.academy_registration_codes'::regclass
      and conname = 'academy_registration_codes_registration_number_key'
  ) then
    alter table public.academy_registration_codes
      add constraint academy_registration_codes_registration_number_key unique (registration_number);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.academy_registration_codes'::regclass
      and conname = 'academy_registration_codes_year_serial_key'
  ) then
    alter table public.academy_registration_codes
      add constraint academy_registration_codes_year_serial_key unique (registration_year, serial_number);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.academy_registration_codes'::regclass
      and conname = 'academy_registration_codes_claimed_by_key'
  ) then
    alter table public.academy_registration_codes
      add constraint academy_registration_codes_claimed_by_key unique (claimed_by);
  end if;
end;
$$;

create index if not exists academy_registration_codes_status_idx
  on public.academy_registration_codes (status, registration_year, serial_number);

create index if not exists academy_registration_codes_claimed_by_idx
  on public.academy_registration_codes (claimed_by)
  where claimed_by is not null;

alter table public.academy_profiles
  add column if not exists registration_code_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.academy_profiles'::regclass
      and conname = 'academy_profiles_registration_code_id_fkey'
  ) then
    alter table public.academy_profiles
      add constraint academy_profiles_registration_code_id_fkey
      foreign key (registration_code_id)
      references public.academy_registration_codes(id)
      on delete restrict;
  end if;
end;
$$;

create unique index if not exists academy_profiles_registration_code_id_key
  on public.academy_profiles (registration_code_id)
  where registration_code_id is not null;

create table if not exists public.academy_registration_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  student_id uuid references auth.users(id) on delete set null,
  registration_code_id uuid references public.academy_registration_codes(id) on delete restrict,
  registration_number text not null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists academy_registration_audit_student_idx
  on public.academy_registration_audit (student_id, created_at desc);

create index if not exists academy_registration_audit_code_idx
  on public.academy_registration_audit (registration_code_id, created_at desc);

alter table public.academy_registration_codes enable row level security;
alter table public.academy_registration_audit enable row level security;

drop policy if exists academy_registration_codes_admin_read on public.academy_registration_codes;
create policy academy_registration_codes_admin_read
  on public.academy_registration_codes for select to authenticated
  using (public.academy_is_admin() or claimed_by = auth.uid());

drop policy if exists academy_registration_audit_admin_read on public.academy_registration_audit;
create policy academy_registration_audit_admin_read
  on public.academy_registration_audit for select to authenticated
  using (public.academy_is_admin());

revoke all on public.academy_registration_codes from anon;
revoke all on public.academy_registration_audit from anon;
revoke insert, update, delete on public.academy_registration_codes from authenticated;
revoke insert, update, delete on public.academy_registration_audit from authenticated;
grant select on public.academy_registration_codes to authenticated;
grant select on public.academy_registration_audit to authenticated;

create or replace function public.academy_registration_code_delete_guard()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Issued registration numbers cannot be deleted.';
end;
$$;

drop trigger if exists academy_registration_code_delete_guard on public.academy_registration_codes;
create trigger academy_registration_code_delete_guard
  before delete on public.academy_registration_codes
  for each row execute function public.academy_registration_code_delete_guard();

create or replace function public.academy_registration_identity_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.registration_code_id is distinct from old.registration_code_id
    and coalesce(current_setting('academy.registration_change', true), '0') <> '1' then
    raise exception 'Registration numbers can only be changed through the controlled Academy procedure.';
  end if;
  return new;
end;
$$;

drop trigger if exists academy_registration_identity_guard on public.academy_profiles;
create trigger academy_registration_identity_guard
  before update of registration_code_id on public.academy_profiles
  for each row execute function public.academy_registration_identity_guard();

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
begin
  normalized_number := upper(trim(coalesce(new.raw_user_meta_data ->> 'registration_number', '')));

  if normalized_number !~ '^ATE-[0-9]{2}-[0-9]{3}$' then
    raise exception 'We couldn''t verify this registration number. Please check your Academy registration details or contact your teacher.';
  end if;

  select * into code_row
  from public.academy_registration_codes
  where registration_number = normalized_number
  for update;

  if not found or code_row.status <> 'available' or code_row.claimed_by is not null then
    raise exception 'We couldn''t verify this registration number. Please check your Academy registration details or contact your teacher.';
  end if;

  update public.academy_registration_codes
  set status = 'claimed',
      claimed_by = new.id,
      claimed_at = now(),
      updated_at = now()
  where id = code_row.id;

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
    actor_id,
    student_id,
    registration_code_id,
    registration_number,
    action,
    metadata
  ) values (
    new.id,
    new.id,
    code_row.id,
    normalized_number,
    'assigned',
    jsonb_build_object('source', 'signup')
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_academy_profile on auth.users;
drop trigger if exists academy_auth_user_profile on auth.users;
drop trigger if exists academy_registration_signup_claim on auth.users;
create trigger academy_registration_signup_claim
  after insert on auth.users
  for each row execute function public.academy_registration_claim_signup();

create or replace function public.academy_generate_registration_codes(
  target_year integer,
  number_to_generate integer
)
returns table (
  registration_number text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_serial integer;
  first_serial integer;
  last_serial integer;
begin
  if not public.academy_is_admin() then
    raise exception 'Only Academy administrators can generate registration numbers.';
  end if;
  if target_year is null or target_year < 2000 or target_year > 2099 then
    raise exception 'Registration year must be between 2000 and 2099.';
  end if;
  if number_to_generate is null or number_to_generate < 1 or number_to_generate > 999 then
    raise exception 'Number of registration numbers must be between 1 and 999.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('academy-registration-' || target_year::text, 0));

  select coalesce(max(serial_number), 0) + 1
  into next_serial
  from public.academy_registration_codes
  where registration_year = target_year;

  first_serial := next_serial;
  last_serial := next_serial + number_to_generate - 1;
  if last_serial > 999 then
    raise exception 'The selected registration year has no unused serial numbers left.';
  end if;

  insert into public.academy_registration_codes (registration_year, serial_number)
  select target_year, (first_serial + value - 1)::smallint
  from generate_series(1, number_to_generate) as value;

  insert into public.academy_registration_audit (
    actor_id,
    registration_code_id,
    registration_number,
    action,
    metadata
  )
  select
    auth.uid(),
    codes.id,
    codes.registration_number,
    'created',
    jsonb_build_object('batch_size', number_to_generate, 'year', target_year)
  from public.academy_registration_codes codes
  where codes.registration_year = target_year
    and codes.serial_number between first_serial and last_serial;

  return query
  select codes.registration_number, codes.status, codes.created_at
  from public.academy_registration_codes codes
  where codes.registration_year = target_year
    and codes.serial_number between first_serial and last_serial
  order by codes.serial_number;
end;
$$;

create or replace function public.academy_assign_registration_code(
  target_student_id uuid,
  target_registration_number text
)
returns public.academy_registration_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  code_row public.academy_registration_codes%rowtype;
  profile_row public.academy_profiles%rowtype;
  normalized_number text := upper(trim(coalesce(target_registration_number, '')));
begin
  if not public.academy_is_admin() then
    raise exception 'Only Academy administrators can assign registration numbers.';
  end if;
  if normalized_number !~ '^ATE-[0-9]{2}-[0-9]{3}$' then
    raise exception 'Registration number is not valid.';
  end if;
  if not exists (
    select 1 from public.academy_profiles
    where id = target_student_id and role = 'student'
  ) then
    raise exception 'Student profile not found.';
  end if;

  select * into code_row
  from public.academy_registration_codes
  where registration_number = normalized_number
  for update;
  if not found then
    raise exception 'Registration number not found.';
  end if;

  select * into profile_row
  from public.academy_profiles
  where id = target_student_id
  for update;

  if profile_row.registration_code_id = code_row.id
    and code_row.claimed_by = target_student_id then
    return code_row;
  end if;
  if profile_row.registration_code_id is not null then
    raise exception 'Use the explicit reassignment procedure for this student.';
  end if;
  if code_row.status <> 'available' or code_row.claimed_by is not null then
    raise exception 'Registration number is not available.';
  end if;

  update public.academy_registration_codes
  set status = 'claimed',
      claimed_by = target_student_id,
      claimed_at = now(),
      updated_at = now()
  where id = code_row.id
  returning * into code_row;

  perform set_config('academy.registration_change', '1', true);
  update public.academy_profiles
  set registration_code_id = code_row.id,
      updated_at = now()
  where id = target_student_id;

  insert into public.academy_registration_audit (
    actor_id, student_id, registration_code_id, registration_number, action
  ) values (
    auth.uid(), target_student_id, code_row.id, code_row.registration_number, 'assigned'
  );

  return code_row;
end;
$$;

create or replace function public.academy_suspend_registration_code(
  target_registration_number text,
  suspension_reason text
)
returns public.academy_registration_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  code_row public.academy_registration_codes%rowtype;
  normalized_number text := upper(trim(coalesce(target_registration_number, '')));
begin
  if not public.academy_is_admin() then
    raise exception 'Only Academy administrators can suspend registration numbers.';
  end if;
  if nullif(trim(suspension_reason), '') is null then
    raise exception 'A suspension reason is required.';
  end if;
  select * into code_row
  from public.academy_registration_codes
  where registration_number = normalized_number
  for update;
  if not found then
    raise exception 'Registration number not found.';
  end if;
  if code_row.status = 'suspended' then
    return code_row;
  end if;

  update public.academy_registration_codes
  set status = 'suspended', updated_at = now()
  where id = code_row.id
  returning * into code_row;

  insert into public.academy_registration_audit (
    actor_id, student_id, registration_code_id, registration_number, action, reason
  ) values (
    auth.uid(), code_row.claimed_by, code_row.id, code_row.registration_number,
    'suspended', left(trim(suspension_reason), 500)
  );

  return code_row;
end;
$$;

create or replace function public.academy_reassign_registration_code(
  target_student_id uuid,
  old_registration_number text,
  new_registration_number text,
  reassignment_reason text
)
returns public.academy_registration_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  old_code public.academy_registration_codes%rowtype;
  new_code public.academy_registration_codes%rowtype;
  profile_row public.academy_profiles%rowtype;
  old_number text := upper(trim(coalesce(old_registration_number, '')));
  new_number text := upper(trim(coalesce(new_registration_number, '')));
begin
  if not public.academy_is_admin() then
    raise exception 'Only Academy administrators can reassign registration numbers.';
  end if;
  if nullif(trim(reassignment_reason), '') is null then
    raise exception 'A reassignment reason is required.';
  end if;
  if old_number !~ '^ATE-[0-9]{2}-[0-9]{3}$'
    or new_number !~ '^ATE-[0-9]{2}-[0-9]{3}$'
    or old_number = new_number then
    raise exception 'Registration numbers are not valid for reassignment.';
  end if;

  select * into old_code
  from public.academy_registration_codes
  where registration_number = old_number
  for update;
  select * into new_code
  from public.academy_registration_codes
  where registration_number = new_number
  for update;
  select * into profile_row
  from public.academy_profiles
  where id = target_student_id and role = 'student'
  for update;

  if not found or old_code.id is null or new_code.id is null or profile_row.id is null then
    raise exception 'Student or registration number not found.';
  end if;
  if profile_row.registration_code_id <> old_code.id or old_code.claimed_by <> target_student_id then
    raise exception 'The current registration number does not belong to this student.';
  end if;
  if new_code.status <> 'available' or new_code.claimed_by is not null then
    raise exception 'The replacement registration number is not available.';
  end if;

  update public.academy_registration_codes
  set status = 'suspended', updated_at = now()
  where id = old_code.id;
  update public.academy_registration_codes
  set status = 'claimed',
      claimed_by = target_student_id,
      claimed_at = now(),
      updated_at = now()
  where id = new_code.id
  returning * into new_code;
  perform set_config('academy.registration_change', '1', true);
  update public.academy_profiles
  set registration_code_id = new_code.id, updated_at = now()
  where id = target_student_id;

  insert into public.academy_registration_audit (
    actor_id, student_id, registration_code_id, registration_number, action, reason, metadata
  ) values
  (
    auth.uid(), target_student_id, old_code.id, old_code.registration_number,
    'reassigned_out', left(trim(reassignment_reason), 500),
    jsonb_build_object('replacement', new_code.registration_number)
  ),
  (
    auth.uid(), target_student_id, new_code.id, new_code.registration_number,
    'reassigned_in', left(trim(reassignment_reason), 500),
    jsonb_build_object('replaced', old_code.registration_number)
  );

  return new_code;
end;
$$;

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
    and status_filter not in ('available', 'claimed', 'suspended') then
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

revoke execute on function public.academy_generate_registration_codes(integer, integer) from public, anon;
revoke execute on function public.academy_assign_registration_code(uuid, text) from public, anon;
revoke execute on function public.academy_suspend_registration_code(text, text) from public, anon;
revoke execute on function public.academy_reassign_registration_code(uuid, text, text, text) from public, anon;
revoke execute on function public.academy_admin_registration_list(text, text) from public, anon;
grant execute on function public.academy_generate_registration_codes(integer, integer) to authenticated;
grant execute on function public.academy_assign_registration_code(uuid, text) to authenticated;
grant execute on function public.academy_suspend_registration_code(text, text) to authenticated;
grant execute on function public.academy_reassign_registration_code(uuid, text, text, text) to authenticated;
grant execute on function public.academy_admin_registration_list(text, text) to authenticated;
revoke execute on function public.academy_registration_claim_signup() from public, anon, authenticated;
revoke execute on function public.academy_registration_identity_guard() from public, anon, authenticated;
revoke execute on function public.academy_registration_code_delete_guard() from public, anon, authenticated;
