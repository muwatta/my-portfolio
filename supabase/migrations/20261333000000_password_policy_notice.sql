-- Tell existing students to choose a strong password, without touching their access.
--
-- New passwords are now held to a stronger rule on the server: at least 8
-- characters with an uppercase letter, a lowercase letter, a number and a symbol
-- (Supabase Auth config, not SQL -- see the README for the curl). GoTrue only
-- applies those rules when a password is next set, so accounts created under the
-- old rule keep working exactly as they are. That is deliberate: this notice
-- asks students to update, and nothing here can lock them out if they ignore it.
--
-- What we cannot do is tell whether a given password is already weak. GoTrue
-- stores only a bcrypt hash, so there is no way to score an existing password
-- without resetting it. Everyone who signed up before the rule change is
-- therefore treated as a candidate, and the notice stays dismissible.

with policy_windows as (
  select
    -- Any account created before now predates the rule change. Timestamps from
    -- accounts created later are left alone.
    timestamptz '2026-10-03 00:00:00+00' as cutoff
)
insert into public.academy_notifications (user_id, type, title, message)
select
  u.id,
  'password_policy_update',
  'Please choose a stronger password',
  'Academy now asks for passwords of at least 8 characters that mix uppercase and lowercase letters, a number, and a symbol. Changing yours is optional and nothing is lost if you skip it, but a stronger password protects your coursework. Update it from Forgot password on the sign-in page.'
from auth.users u
cross join policy_windows w
where u.created_at < w.cutoff
  and not exists (
    select 1
    from public.academy_notifications n
    where n.user_id = u.id
      and n.type = 'password_policy_update'
  );