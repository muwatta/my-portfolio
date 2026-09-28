-- Restore administrator access for a colleague.
--
-- academy_admins held two rows and I removed one of them, tayosofiyyah2019, on
-- the reading that consolidation meant a single administrator. That reading was
-- wrong. She is a colleague who needs teacher and administrator access, and
-- being able to publish content and grade work is part of her job.
--
-- Removing a colleague's access on an ambiguous instruction was the wrong call
-- even where the instruction was technically clear, because a mistaken yes is
-- indistinguishable from a deliberate one at the moment it is given.
--
-- The guard stays pinned to the account owner by id. It protects the owner from
-- removal, which is the point of it, and colleagues are unaffected by it.

insert into public.academy_admins (user_id)
select u.id
  from auth.users u
 where u.id = 'ec499da3-5c3c-4df5-9f9d-8e1c6496e0ae'
on conflict (user_id) do nothing;
