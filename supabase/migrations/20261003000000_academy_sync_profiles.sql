-- Recover any Auth accounts that were created before the Academy profile trigger
-- or while a deployment was incomplete. Signing out does not remove these rows.
create or replace function public.academy_sync_profiles()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.academy_is_admin() then
    raise exception 'Academy administrator access required';
  end if;

  update public.academy_profiles as profiles
  set display_name = coalesce(
    nullif(profiles.display_name, ''),
    nullif(users.raw_user_meta_data ->> 'display_name', ''),
    split_part(users.email, '@', 1),
    ''
  )
  from auth.users as users
  where profiles.id = users.id and profiles.display_name = '';

  insert into public.academy_profiles (id, display_name)
  select
    users.id,
    coalesce(
      nullif(users.raw_user_meta_data ->> 'display_name', ''),
      split_part(users.email, '@', 1),
      ''
    )
  from auth.users as users
  left join public.academy_profiles as profiles on profiles.id = users.id
  where profiles.id is null;
end;
$$;

revoke execute on function public.academy_sync_profiles() from public, anon;
grant execute on function public.academy_sync_profiles() to authenticated;