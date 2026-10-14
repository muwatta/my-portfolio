-- C++ practice sets are generated from each lesson's content. Require a passed
-- set for learners who have not already completed the lesson, even when the
-- lesson has no authored question-bank rows.
create or replace function public.academy_lesson_required_activities_complete(
  target_student_id uuid,
  target_lesson_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_student_id is not null
    and target_lesson_id is not null
    and (
      not exists (
        select 1
        from public.academy_lessons lesson
        join public.academy_weeks weeks on weeks.id = lesson.week_id
        join public.academy_courses course on course.id = weeks.course_id
        where lesson.id = target_lesson_id
          and course.slug = 'cpp-embedded-robotics'
      )
      or exists (
        select 1
        from public.academy_lesson_progress progress
        where progress.student_id = target_student_id
          and progress.lesson_id = target_lesson_id
          and progress.completion_status = 'completed'
          and progress.completed_at is not null
      )
      or exists (
        select 1
        from public.academy_practice_sessions practice_session
        where practice_session.student_id = target_student_id
          and practice_session.lesson_id = target_lesson_id
          and practice_session.completed_at is not null
      )
    )
    and not exists (
      select 1
      from public.academy_lesson_activities activity
      where activity.lesson_id = target_lesson_id
        and activity.required_for_completion
        and activity.status = 'published'
        and (activity.release_at is null or activity.release_at <= now())
        and (
          (
            activity.kind = 'practice'
            and exists (
              select 1
              from public.academy_exercises exercise
              where exercise.id = activity.ref_id
                and exercise.published
                and exercise.status = 'published'
                and (exercise.release_at is null or exercise.release_at <= now())
            )
            and not exists (
              select 1
              from public.academy_practice_sessions practice_session
              where practice_session.student_id = target_student_id
                and practice_session.lesson_id = target_lesson_id
                and practice_session.completed_at is not null
            )
            and not exists (
              select 1
              from public.academy_exercise_attempts attempt
              where attempt.exercise_id = activity.ref_id
                and attempt.student_id = target_student_id
                and attempt.passed > 0
            )
          )
          or (
            activity.kind = 'assignment'
            and exists (
              select 1
              from public.academy_assignments assignment
              where assignment.id = activity.ref_id
                and assignment.published
                and not assignment.is_draft
                and assignment.status = 'published'
                and (assignment.release_at is null or assignment.release_at <= now())
            )
            and not exists (
              select 1
              from public.academy_submissions submission
              where submission.assignment_id = activity.ref_id
                and submission.student_id = target_student_id
            )
          )
        )
    );
$$;

revoke execute on function public.academy_lesson_required_activities_complete(uuid, uuid)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
