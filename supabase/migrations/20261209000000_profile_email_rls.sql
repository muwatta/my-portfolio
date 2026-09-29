-- Staff need to read a profile's email to manage the account. Students should
-- still not be able to harvest other students' addresses by listing profiles.
drop policy if exists academy_profiles_email_read on public.academy_profiles;
create policy academy_profiles_email_read on public.academy_profiles
  for select to authenticated
  using (public.academy_is_teacher() or id = auth.uid());

grant select (email) on public.academy_profiles to authenticated;

notify pgrst, 'reload schema';
