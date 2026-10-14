drop policy if exists academy_graders_admin_read on public.academy_graders;
create policy academy_graders_admin_read on public.academy_graders
  for select to authenticated using (public.academy_is_admin());
grant select on public.academy_graders to authenticated;
notify pgrst, 'reload schema';
