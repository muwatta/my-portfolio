-- Keep ordinary teachers out of grading writes, while allowing appointed
-- graders to read submitted files through short-lived signed URLs.
drop policy if exists academy_submission_results_teacher_write
  on public.academy_submission_results;
create policy academy_submission_results_teacher_write
  on public.academy_submission_results
  for insert to authenticated
  with check (public.academy_can_grade());

drop policy if exists academy_submission_results_teacher_update
  on public.academy_submission_results;
create policy academy_submission_results_teacher_update
  on public.academy_submission_results
  for update to authenticated
  using (public.academy_can_grade())
  with check (public.academy_can_grade());

drop policy if exists academy_submission_files_self_read
  on storage.objects;
create policy academy_submission_files_self_read
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assignment-submissions'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.academy_can_grade()
    )
  );

notify pgrst, 'reload schema';
