-- Phase 1, step 2b: finish the profile hardening.
--
-- 20260924000000 dropped academy_profiles_teacher_update, but the policy is
-- still present in the live database, so the remote never received that drop.
-- Its using clause is academy_is_teacher() over the whole row, and the column
-- grant on display_name, school_id, state, city and avatar_url is still in
-- force, so a teacher could rename any student or move them to another school.
--
-- The column grant cannot express "your own row only", so the teacher wide
-- update policy has to go. Teachers assign levels and courses through
-- academy_assign_student_level and academy_assign_student_course, both SECURITY
-- DEFINER, and the client only calls those. academy_profiles_admin_level_update
-- is left in place: it is scoped to admins and the level_id grant it needs was
-- revoked, so it can no longer write anything, and the RPCs cover that path.

drop policy if exists academy_profiles_teacher_update on public.academy_profiles;

-- Confirm the only remaining ways to write a profile row are a student's own
-- row and the SECURITY DEFINER helpers.
do $$
declare
  leftovers text;
begin
  select string_agg(policyname || ':' || cmd, ' | ' order by policyname)
  into leftovers
  from pg_policies
  where schemaname = 'public'
    and tablename = 'academy_profiles'
    and cmd in ('UPDATE', 'INSERT', 'DELETE');

  if leftovers is not null and leftovers <> 'academy_profiles_student_update:UPDATE' then
    raise warning 'unexpected profile write policies remain: %', leftovers;
  end if;
end;
$$;

notify pgrst, 'reload schema';
