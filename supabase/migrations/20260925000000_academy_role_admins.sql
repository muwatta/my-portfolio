-- Separate trusted Academy administrators from ordinary teachers.
create table if not exists public.academy_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.academy_admins enable row level security;

create or replace function public.academy_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.academy_admins
    where user_id = auth.uid()
  );
$$;

create policy academy_admins_self_read on public.academy_admins
  for select to authenticated using (user_id = auth.uid() or public.academy_is_admin());

create policy academy_admins_admin_manage on public.academy_admins
  for all to authenticated using (public.academy_is_admin()) with check (public.academy_is_admin());

create or replace function public.academy_set_user_role(
  target_user_id uuid,
  target_role public.academy_role
)
returns public.academy_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.academy_profiles;
begin
  if not public.academy_is_admin() then
    raise exception 'Academy administrator access required';
  end if;

  update public.academy_profiles
  set role = target_role,
      updated_at = now()
  where id = target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Academy profile not found';
  end if;

  return updated_profile;
end;
$$;

revoke execute on function public.academy_is_admin() from public, anon;
grant execute on function public.academy_is_admin() to authenticated;
revoke execute on function public.academy_set_user_role(uuid, public.academy_role) from public, anon;
grant execute on function public.academy_set_user_role(uuid, public.academy_role) to authenticated;
