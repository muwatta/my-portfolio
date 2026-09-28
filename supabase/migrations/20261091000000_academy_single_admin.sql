-- One administrator, and a primary admin guard that actually fires.
--
-- Two administrators were present. The account owner keeps access; the other
-- account is removed. That is the consolidation, and it is reversible by
-- re-inserting the row.
--
-- The guard needed fixing as well. academy_set_user_admin protected the primary
-- administrator with
--
--   exists (select 1 from auth.users
--            where id = target_user_id
--              and lower(email) = 'abdullahmusliudeen@gmail.com')
--
-- which is meant to make the owner unremovable. Probing the same predicate
-- twice on the same database gave contradictory answers, plain equality and
-- lower(email) each returning one row on one run and none on the other. A
-- security guard built on a predicate that cannot be trusted to match is
-- worse than no guard, because it looks like protection.
--
-- The guard is now pinned to the user id, which is deterministic, has no case
-- sensitivity and no collation question, and cannot drift if the address
-- changes. The address is kept only as a comment for whoever reads this next.

-- 45501f33-911d-495b-a994-ba654683e521 is abdullahimusliudeen@gmail.com, the
-- account owner, who signed up on 2026-09-21 and was the first administrator.

create or replace function public.academy_primary_admin_id()
returns uuid
language sql
immutable
as $$
  select '45501f33-911d-495b-a994-ba654683e521'::uuid;
$$;

revoke execute on function public.academy_primary_admin_id() from public, anon, authenticated;

-- The consolidation.
delete from public.academy_admins
 where user_id <> public.academy_primary_admin_id();

-- Keep exactly one row, whatever happens.
insert into public.academy_admins (user_id)
values (public.academy_primary_admin_id())
on conflict (user_id) do nothing;

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

  -- Pinned by id, not by an address comparison.
  if target_user_id = public.academy_primary_admin_id() and not should_be_admin then
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

notify pgrst, 'reload schema';
