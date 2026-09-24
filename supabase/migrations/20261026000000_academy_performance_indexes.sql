create index if not exists academy_exercises_lesson_id_idx
  on public.academy_exercises (lesson_id);

create index if not exists academy_exercise_attempts_exercise_student_idx
  on public.academy_exercise_attempts (exercise_id, student_id);

create index if not exists academy_student_badges_student_awarded_idx
  on public.academy_student_badges (student_id, awarded_at desc);

create index if not exists academy_learning_sessions_student_started_idx
  on public.academy_learning_sessions (student_id, started_at desc);

create index if not exists academy_profiles_role_name_idx
  on public.academy_profiles (role, display_name);

create index if not exists academy_assignments_course_published_due_idx
  on public.academy_assignments (course_id, published, due_at asc nulls last);

create index if not exists academy_materials_course_published_created_idx
  on public.academy_materials (course_id, created_at desc)
  where published = true;

create index if not exists academy_submissions_submitted_at_idx
  on public.academy_submissions (submitted_at desc);

create index if not exists academy_projects_course_id_idx
  on public.academy_projects (course_id);

create index if not exists academy_leaderboard_points_period_status_student_idx
  on public.academy_leaderboard_points (
    period_id,
    verification_status,
    student_id,
    points desc
  );
