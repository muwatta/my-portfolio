-- P0 authorization hardening for Academy teacher controls.
-- Teachers may assign levels, but cannot change roles or profile identity fields.

drop policy if exists academy_profiles_teacher_update on public.academy_profiles;
create policy academy_profiles_teacher_level_update
  on public.academy_profiles for update to authenticated
  using (public.academy_is_teacher())
  with check (public.academy_is_teacher());

revoke update on public.academy_profiles from authenticated;
grant update (level_id) on public.academy_profiles to authenticated;

create or replace function public.academy_assign_student_level(
  target_student_id uuid,
  target_level_id uuid
)
returns public.academy_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.academy_profiles;
begin
  if not public.academy_is_teacher() then
    raise exception 'Academy teacher access required';
  end if;

  update public.academy_profiles
  set level_id = target_level_id,
      updated_at = now()
  where id = target_student_id
    and role = 'student'
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Student profile not found';
  end if;

  return updated_profile;
end;
$$;

revoke execute on function public.academy_assign_student_level(uuid, uuid) from public, anon;
grant execute on function public.academy_assign_student_level(uuid, uuid) to authenticated;
