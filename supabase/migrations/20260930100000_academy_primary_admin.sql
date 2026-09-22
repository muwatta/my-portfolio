-- The primary administrator is identified by email and may delegate admin access.
create or replace function public.academy_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'abdullahmusliudeen@gmail.com'
    or exists (select 1 from public.academy_admins where user_id = auth.uid());
$$;

insert into public.academy_admins (user_id)
select id from auth.users
where lower(email) = 'abdullahmusliudeen@gmail.com'
on conflict (user_id) do nothing;

create or replace function public.academy_is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.academy_is_admin()
    or exists (
      select 1 from public.academy_profiles
      where id = auth.uid() and role = 'teacher'
    );
$$;

drop policy if exists academy_profiles_admin_read on public.academy_profiles;
create policy academy_profiles_admin_read on public.academy_profiles
  for select to authenticated using (public.academy_is_admin());

create or replace function public.academy_set_user_admin(
  target_user_id uuid,
  should_be_admin boolean
)
returns public.academy_admins
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.academy_admins;
begin
  if not public.academy_is_admin() then
    raise exception 'Primary administrator access required';
  end if;
  if exists (select 1 from auth.users where id = target_user_id and lower(email) = 'abdullahmusliudeen@gmail.com')
     and not should_be_admin then
    raise exception 'The primary administrator cannot be removed';
  end if;
  if should_be_admin then
    insert into public.academy_admins (user_id) values (target_user_id)
    on conflict (user_id) do update set user_id = excluded.user_id
    returning * into result;
  else
    delete from public.academy_admins where user_id = target_user_id returning * into result;
  end if;
  return result;
end;
$$;

revoke execute on function public.academy_set_user_admin(uuid, boolean) from public, anon;
grant execute on function public.academy_set_user_admin(uuid, boolean) to authenticated;