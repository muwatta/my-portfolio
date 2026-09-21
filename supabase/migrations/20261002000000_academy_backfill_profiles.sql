-- Ensure every existing Auth account appears in Academy administration.
insert into public.academy_profiles (id, display_name)
select
  users.id,
  coalesce(users.raw_user_meta_data ->> 'display_name', '')
from auth.users as users
left join public.academy_profiles as profiles on profiles.id = users.id
where profiles.id is null;

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