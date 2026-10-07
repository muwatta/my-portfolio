-- Registration happens before authentication, so anonymous users need to read
-- the active school options. Do not expose inactive schools to public signup.

grant select on public.academy_schools to anon;

drop policy if exists academy_schools_public_signup_read
  on public.academy_schools;
create policy academy_schools_public_signup_read
  on public.academy_schools
  for select to anon
  using (is_active);
