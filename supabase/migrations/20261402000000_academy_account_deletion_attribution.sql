-- Keep Academy content and attribution records when an author or reviewer
-- account is removed, without leaving a foreign key that blocks account deletion.

alter table public.academy_assignments
  alter column created_by drop not null,
  drop constraint if exists academy_assignments_created_by_fkey,
  add constraint academy_assignments_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.academy_classes
  alter column created_by drop not null,
  drop constraint if exists academy_classes_created_by_fkey,
  add constraint academy_classes_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.academy_schedules
  alter column created_by drop not null,
  drop constraint if exists academy_schedules_created_by_fkey,
  add constraint academy_schedules_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.academy_materials
  alter column created_by drop not null,
  drop constraint if exists academy_materials_created_by_fkey,
  add constraint academy_materials_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.academy_student_badges
  drop constraint if exists academy_student_badges_awarded_by_fkey,
  add constraint academy_student_badges_awarded_by_fkey
    foreign key (awarded_by) references auth.users(id) on delete set null;

alter table public.academy_live_rooms
  alter column created_by drop not null,
  drop constraint if exists academy_live_rooms_created_by_fkey,
  add constraint academy_live_rooms_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.academy_submission_results
  drop constraint if exists academy_submission_results_reviewed_by_fkey,
  add constraint academy_submission_results_reviewed_by_fkey
    foreign key (reviewed_by) references auth.users(id) on delete set null;

alter table public.academy_exam_questions
  alter column created_by drop not null,
  drop constraint if exists academy_exam_questions_created_by_fkey,
  add constraint academy_exam_questions_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.academy_exams
  alter column created_by drop not null,
  drop constraint if exists academy_exams_created_by_fkey,
  add constraint academy_exams_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;
