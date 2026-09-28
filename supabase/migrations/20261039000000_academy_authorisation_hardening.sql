-- Phase 1, step 2: close the live authorisation gaps found during the audit.
--
-- Every change here is either a policy that was written but never switched on,
-- a privilege that was never revoked, or a rule that contradicted its own stated
-- intent. No table is dropped, no column is removed, and no existing row is
-- modified, so student content and grades are untouched.
--
-- Verified before this migration: the only direct client write to
-- academy_profiles is updateAcademyStudentProfile, which updates the caller's
-- own row. Every teacher mutation already goes through a SECURITY DEFINER RPC.

-- 1. Row level security was never enabled on these five tables. Policies exist
--    for three of them but had no effect, and Supabase grants new public tables
--    to anon and authenticated by default, so all five were readable and
--    writable by any signed in student. academy_learning_session_events holds
--    every student's heartbeat and route history.

alter table public.academy_lesson_subtopics enable row level security;
alter table public.academy_assignment_visibility enable row level security;
alter table public.academy_leaderboard_periods enable row level security;
alter table public.academy_learning_session_events enable row level security;
alter table public.academy_activity_feed enable row level security;

-- Subtopics: readable when the parent lesson is available to the student.
drop policy if exists academy_lesson_subtopics_read on public.academy_lesson_subtopics;
create policy academy_lesson_subtopics_read on public.academy_lesson_subtopics
  for select to authenticated using (
    public.academy_is_teacher()
    or exists (
      select 1 from public.academy_lessons l
      where l.id = lesson_id
        and l.published
        and public.academy_lesson_is_unlocked_for_student(auth.uid(), l.id)
    )
  );

drop policy if exists academy_lesson_subtopics_manage on public.academy_lesson_subtopics;
create policy academy_lesson_subtopics_manage on public.academy_lesson_subtopics
  for all to authenticated using (public.academy_is_teacher())
  with check (public.academy_is_teacher());

-- Assignment visibility is an internal broadcast log. Nothing reads it, so keep
-- it staff only rather than world readable.
drop policy if exists academy_assignment_visibility_read on public.academy_assignment_visibility;
create policy academy_assignment_visibility_read on public.academy_assignment_visibility
  for select to authenticated using (public.academy_is_teacher());

drop policy if exists academy_assignment_visibility_manage on public.academy_assignment_visibility;
create policy academy_assignment_visibility_manage on public.academy_assignment_visibility
  for all to authenticated using (public.academy_is_teacher())
  with check (public.academy_is_teacher());

-- Leaderboard periods are window metadata, safe to read, staff only to change.
drop policy if exists academy_leaderboard_periods_read on public.academy_leaderboard_periods;
create policy academy_leaderboard_periods_read on public.academy_leaderboard_periods
  for select to authenticated using (true);

drop policy if exists academy_leaderboard_periods_manage on public.academy_leaderboard_periods;
create policy academy_leaderboard_periods_manage on public.academy_leaderboard_periods
  for all to authenticated using (public.academy_is_teacher())
  with check (public.academy_is_teacher());

-- Time tracking events: a student sees only their own trail.
drop policy if exists academy_learning_session_events_self_read
  on public.academy_learning_session_events;
create policy academy_learning_session_events_self_read
  on public.academy_learning_session_events
  for select to authenticated using (student_id = auth.uid() or public.academy_is_teacher());

drop policy if exists academy_learning_session_events_teacher_read
  on public.academy_learning_session_events;
create policy academy_learning_session_events_teacher_read
  on public.academy_learning_session_events
  for select to authenticated using (public.academy_is_teacher());

-- Writes happen inside SECURITY DEFINER helpers, so no insert policy is needed.
drop policy if exists academy_learning_session_events_self_write
  on public.academy_learning_session_events;
revoke insert, update, delete on public.academy_learning_session_events from anon, authenticated;

-- Activity feed: staff read and write only.
drop policy if exists academy_activity_feed_read on public.academy_activity_feed;
create policy academy_activity_feed_read on public.academy_activity_feed
  for select to authenticated using (public.academy_is_teacher());

drop policy if exists academy_activity_feed_write on public.academy_activity_feed;
create policy academy_activity_feed_write on public.academy_activity_feed
  for insert to authenticated with check (public.academy_is_teacher());

revoke update, delete on public.academy_activity_feed from anon, authenticated;

-- 2. public.blog_posts grants insert, update and delete to every authenticated
--    user with using (true). The blog actually runs on Firestore and no code
--    reads this table, so it is a free-for-all on a table nobody uses.
do $$
begin
  if to_regclass('public.blog_posts') is not null then
    execute 'revoke insert, update, delete on public.blog_posts from anon, authenticated';
  end if;
end;
$$;

-- 3. Projects and their milestones were readable by every authenticated user
--    regardless of enrolment. Tie both to an active enrolment in the course.
drop policy if exists academy_projects_read on public.academy_projects;
create policy academy_projects_read on public.academy_projects
  for select to authenticated using (
    public.academy_is_teacher()
    or exists (
      select 1 from public.academy_enrollments e
      where e.course_id = academy_projects.course_id
        and e.student_id = auth.uid()
        and e.status = 'active'
    )
  );

drop policy if exists academy_milestones_read on public.academy_project_milestones;
create policy academy_milestones_read on public.academy_project_milestones
  for select to authenticated using (
    public.academy_is_teacher()
    or exists (
      select 1 from public.academy_projects p
      join public.academy_enrollments e on e.course_id = p.course_id
      where p.id = project_id
        and e.student_id = auth.uid()
        and e.status = 'active'
    )
  );

-- 4. Teachers could rename any student. 20260924000000 granted update on
--    level_id only and was titled "cannot change profile identity fields", but a
--    later migration widened the column grant to display_name, school_id, state,
--    city and avatar_url, and column grants accumulate. The teacher policy then
--    applied to whole rows, so the widened grant reached every student.
--    Teachers already assign levels and courses through SECURITY DEFINER RPCs,
--    so remove the blanket teacher update policy and the unused column grant.
drop policy if exists academy_profiles_teacher_level_update on public.academy_profiles;
revoke update (level_id) on public.academy_profiles from authenticated;

-- 5. Exercises were readable whenever the parent lesson was published, which
--    bypassed the prerequisite chain. Require the lesson to be unlocked too.
drop policy if exists academy_exercises_read on public.academy_exercises;
create policy academy_exercises_read on public.academy_exercises
  for select to authenticated using (
    public.academy_is_teacher()
    or exists (
      select 1 from public.academy_lessons l
      where l.id = lesson_id
        and l.published
        and public.academy_lesson_is_unlocked_for_student(auth.uid(), l.id)
    )
  );

-- 6. The offline sync queue uploads with upsert, which becomes an UPDATE when
--    the object already exists, and there was no update policy, so a retried
--    upload was rejected by RLS. Add it, still scoped to the caller's folder.
drop policy if exists academy_submission_files_self_update on storage.objects;
create policy academy_submission_files_self_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'assignment-submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'assignment-submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
