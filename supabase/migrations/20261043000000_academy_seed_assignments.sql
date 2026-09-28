-- Phase 1, step 4b: the example assignments, with a resolvable author.
--
-- 20261042000000 guarded its insert on
--   exists (select 1 from auth.users where lower(email) = 'abdullahimusliudeen@gmail.com')
-- because academy_assignments.created_by is not null and references auth.users.
-- That guard is always false on this project: no auth.users row carries that
-- address, so the insert matched nothing and the migration was a silent no-op.
--
-- The same discovery matters beyond seeding. academy_is_admin() compares the JWT
-- email against that hard coded address, so its "primary administrator" branch
-- can never fire here. Administrator access is granted purely through the
-- academy_admins allow list, which currently holds two accounts. Resolve the
-- author from that list instead, so the seed does not depend on an address that
-- is not registered.

create or replace function public.academy_seed_author()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select user_id from public.academy_admins order by created_at limit 1),
    (select id from auth.users order by created_at limit 1)
  );
$$;

revoke execute on function public.academy_seed_author() from public, anon, authenticated;

-- Example activity: one auto-graded Python task.
insert into public.academy_assignments (
  course_id, lesson_id, created_by, title, instructions, points,
  published, is_draft, status, ai_feedback_enabled, retry_limit
)
select c.id,
       l.id,
       public.academy_seed_author(),
       'Example: auto-graded Python function task',
       'DRAFT TEMPLATE. Replace this text with the real task. Write a function that returns the expected result, then submit. The teacher grades this automatically against hidden test cases.',
       20,
       false,
       true,
       'draft',
       true,
       3
  from public.academy_courses c
  join public.academy_weeks w on w.course_id = c.id
  join public.academy_lessons l on l.week_id = w.id
 where c.slug = 'python-for-ai-machine-learning'
   and public.academy_seed_author() is not null
 order by w.week_number, l.lesson_number
 limit 1
on conflict do nothing;

-- Example activity: one hardware-evidence task for C++, which cannot be graded
-- by running code because the hardware sits outside the browser.
insert into public.academy_assignments (
  course_id, lesson_id, created_by, title, instructions, points,
  published, is_draft, status, allowed_file_types, allowed_submission_types,
  max_file_size_bytes, ai_feedback_enabled, retry_limit
)
select c.id,
       l.id,
       public.academy_seed_author(),
       'Example: C++ hardware evidence task',
       'DRAFT TEMPLATE. Build the circuit, then submit evidence: a wiring photo or diagram, a short video, your source file, and the serial monitor output. A self-check list confirms each item before you submit. Graded by the teacher against a rubric.',
       25,
       false,
       true,
       'draft',
       array['.cpp', '.h', '.ino', '.txt', '.log', '.png', '.jpg', '.jpeg', '.mp4'],
       array['code', 'file'],
       10485760,
       false,
       2
  from public.academy_courses c
  join public.academy_weeks w on w.course_id = c.id
  join public.academy_lessons l on l.week_id = w.id
 where c.slug = 'cpp-embedded-robotics'
   and public.academy_seed_author() is not null
 order by w.week_number, l.lesson_number
 limit 1
on conflict do nothing;

insert into public.academy_lesson_activities (lesson_id, kind, ref_id, title, points, status)
select a.lesson_id, 'assignment', a.id, a.title, a.points, 'draft'
  from public.academy_assignments a
 where a.title like 'Example:%'
on conflict (lesson_id, kind, ref_id) do nothing;

notify pgrst, 'reload schema';
