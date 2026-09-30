-- Students can read an exam row directly, not only through the start-attempt
-- function, so a class member was able to see a draft paper's title,
-- instructions, duration and subject in the student examination list. Starting
-- one was already refused; this closes the metadata leak as well. Archived
-- papers drop off the list for the same reason.
drop policy if exists academy_exams_student_read on public.academy_exams;
create policy academy_exams_student_read
  on public.academy_exams
  for select to authenticated
  using (
    public.academy_is_teacher()
    or (
      status in (
        'scheduled', 'active', 'closed', 'graded', 'results_published'
      )
      and class_id is not null
      and public.academy_is_class_member(class_id)
    )
  );
