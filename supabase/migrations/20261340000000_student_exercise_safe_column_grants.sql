-- Student exercise queries use these release fields when listing and filtering
-- published content. Keep answer keys and grader inputs ungranted.
grant select (status, release_at) on public.academy_exercises to authenticated;

notify pgrst, 'reload schema';
