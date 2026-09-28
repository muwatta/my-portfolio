-- Phase 1, step 4: seed scaffolding and a health check.
--
-- The two courses already carry 35 weeks, 160 lessons and 120 published
-- exercises, so the curriculum is not re-seeded here. What is missing is any
-- assignment: the submissions and grading loop has never run against real
-- data, so the next phase would have nothing to build or test against.
--
-- The example assignments below are deliberately created as drafts. They
-- exist so the submission, auto-grading and grading-inbox work has a target,
-- and they are visible to nobody until the teacher writes real content and
-- publishes them. Nothing a student can currently see is affected.

create or replace function public.academy_grading_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'submissions_total',
      (select count(*) from public.academy_submissions),
    'awaiting_grading',
      (select count(*) from public.academy_submissions
        where status in ('submitted', 'queued')),
    'graded',
      (select count(*) from public.academy_submissions where status = 'graded'),
    'grading_unavailable',
      (select count(*) from public.academy_submissions
        where status = 'grading_unavailable'),
    'failed',
      (select count(*) from public.academy_submissions
        where status = 'grading_failed'),
    'assignments_published',
      (select count(*) from public.academy_assignments
        where status = 'published'),
    'assignments_draft',
      (select count(*) from public.academy_assignments where status = 'draft'),
    'results_awaiting_review',
      (select count(*) from public.academy_submission_results
        where reviewed_at is null)
  );
$$;

revoke execute on function public.academy_grading_health() from public, anon;
grant execute on function public.academy_grading_health() to authenticated;

-- A deterministic health function is useless if every student can read the
-- class-wide totals, so guard it behind staff at the policy level too. It has
-- no RLS of its own because it is a function, not a table.

-- Example activity: one auto-graded Python task.
insert into public.academy_assignments (
  course_id, lesson_id, created_by, title, instructions, points, published, is_draft,
  status, ai_feedback_enabled, retry_limit
)
select c.id,
       l.id,
       (select id from auth.users where lower(email) = 'abdullahimusliudeen@gmail.com' limit 1),
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
   and exists (select 1 from auth.users where lower(email) = 'abdullahimusliudeen@gmail.com')
 order by w.week_number, l.lesson_number
 limit 1
on conflict do nothing;

-- Example activity: one hardware-evidence task for C++, which cannot be graded
-- by running code because the hardware is outside the browser.
insert into public.academy_assignments (
  course_id, lesson_id, created_by, title, instructions, points, published, is_draft,
  status, allowed_file_types, allowed_submission_types, max_file_size_bytes,
  ai_feedback_enabled, retry_limit
)
select c.id,
       l.id,
       (select id from auth.users where lower(email) = 'abdullahimusliudeen@gmail.com' limit 1),
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
   and exists (select 1 from auth.users where lower(email) = 'abdullahimusliudeen@gmail.com')
 order by w.week_number, l.lesson_number
 limit 1
on conflict do nothing;

-- Attach the drafts as activities so the new table is exercised end to end.
insert into public.academy_lesson_activities (lesson_id, kind, ref_id, title, points, status)
select a.lesson_id, 'assignment', a.id, a.title, a.points, 'draft'
  from public.academy_assignments a
 where a.status = 'draft'
   and a.title like 'Example:%'
on conflict (lesson_id, kind, ref_id) do nothing;

notify pgrst, 'reload schema';
