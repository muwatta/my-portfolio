-- The primary administrator account predates Academy display-name metadata.
-- Give its existing profile a useful name without overwriting a chosen name.
update public.academy_profiles
set display_name = 'Abdullahi Musliudeen'
where id = public.academy_primary_admin_id()
  and nullif(btrim(display_name), '') is null;
