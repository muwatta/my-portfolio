-- ATE student onboarding data. Existing profiles remain valid.
create table if not exists public.academy_schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  state text not null,
  city text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.academy_schools (name, code, state, city)
values
  ('SMS', 'SMS', 'Kwara', 'Ilorin'),
  ('DGHIA', 'DGHIA', 'Plateau', 'Jos'),
  ('CIMAI', 'CIMAI', 'Abuja', 'Abuja'),
  ('MMS', 'MMS', 'Lagos', 'Lagos')
on conflict (code) do update set name = excluded.name, state = excluded.state, city = excluded.city;

alter table public.academy_profiles
  add column if not exists school_id uuid references public.academy_schools(id) on delete set null,
  add column if not exists state text,
  add column if not exists city text,
  add column if not exists student_level text;

create index if not exists academy_profiles_school_idx on public.academy_profiles(school_id);
create index if not exists academy_profiles_state_idx on public.academy_profiles(state);

alter table public.academy_schools enable row level security;
drop policy if exists academy_schools_read on public.academy_schools;
create policy academy_schools_read on public.academy_schools
  for select to authenticated using (is_active or public.academy_is_teacher());

drop policy if exists academy_profiles_student_update on public.academy_profiles;
create policy academy_profiles_student_update on public.academy_profiles
  for update to authenticated
  using (id = auth.uid() and role = 'student')
  with check (id = auth.uid() and role = 'student');

revoke update on public.academy_profiles from authenticated;
grant update (display_name, school_id, state, city, student_level, avatar_url) on public.academy_profiles to authenticated;

create or replace function public.academy_create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_school text := nullif(new.raw_user_meta_data ->> 'school_code', '');
begin
  insert into public.academy_profiles (
    id, display_name, school_id, state, city, student_level
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    (select id from public.academy_schools where code = requested_school and is_active),
    nullif(new.raw_user_meta_data ->> 'state', ''),
    nullif(new.raw_user_meta_data ->> 'city', ''),
    nullif(new.raw_user_meta_data ->> 'student_level', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;