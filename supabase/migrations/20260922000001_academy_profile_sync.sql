-- Keep Academy student profiles in sync with Supabase Auth users.
create or replace function public.academy_create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.academy_profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(new.email, '@', 1),
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists academy_auth_user_profile on auth.users;
create trigger academy_auth_user_profile
  after insert on auth.users
  for each row execute procedure public.academy_create_profile_for_user();

insert into public.academy_profiles (id, display_name)
select
  users.id,
  coalesce(
    nullif(users.raw_user_meta_data ->> 'display_name', ''),
    split_part(users.email, '@', 1),
    ''
  )
from auth.users as users
on conflict (id) do nothing;
