-- Two problems with the browser client's access to academy_exercises.
--
-- 1. getAcademyExercises filters on published, and Postgres requires SELECT
--    privilege for a column referenced in WHERE, not just in the select list.
--    published had no column grant, so PostgREST rejected the whole query with
--    403 permission denied for table academy_exercises and students saw no
--    practice exercises at all.
--
-- 2. The 20260922 grant included tests, and the table level revoke in 20260927
--    did not remove it, because revoking a table privilege does not revoke
--    privileges that were granted on individual columns. Hidden tests were
--    therefore still readable by any signed in student.
--
-- Grant only what the client legitimately needs, and take the answer key back.
-- sort_order, updated_at, solution_code and correct_answer stay ungranted: the
-- browser never needs them, and grading happens server side.

grant select (published) on public.academy_exercises to authenticated;

revoke select (tests) on public.academy_exercises from anon, authenticated;

notify pgrst, 'reload schema';
