-- Stop a requirement added after a student finished from locking them out.
--
-- Required activities gate progression: a lesson cannot be completed, and the
-- next lesson cannot unlock, until the required practice has been passed and the
-- required task submitted.
--
-- That gate was fine when the requirement and the student's progress were
-- created together. It stopped being fine when a new required activity was added
-- to a lesson that students had already passed. 20261337000000 attached a
-- required assignment to Session 1 of the Python course on 2026-10-05, while
-- students had completed Sessions 1 and 2 on 2026-10-02 and 2026-10-04. From that
-- moment those students had completed Session 1 with an incomplete activity set,
-- so Session 2 locked behind a lesson they had already finished, with no way to
-- tell the difference from having not done the work.
--
-- The rule now: a required activity only counts against a student who had not
-- already completed that lesson when the activity was created. Adding a
-- requirement affects students who have not yet passed, and leaves everyone
-- already past it alone. Without this, every future content addition is a
-- retroactive lock.

create or replace function public.academy_lesson_required_activities_complete(
  target_student_id uuid,
  target_lesson_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select target_student_id is not null
    and target_lesson_id is not null
    and not exists (
      select 1
      from public.academy_lesson_activities activity
      where activity.lesson_id = target_lesson_id
        and activity.required_for_completion
        and activity.status = 'published'
        and (activity.release_at is null or activity.release_at <= now())
        -- Ignore anything added after this student finished the lesson. That is
        -- the whole point: a requirement published today must not reach back and
        -- block a student who completed the lesson last month. Students who have
        -- not completed it have no completion timestamp, so every requirement
        -- still applies to them and new content keeps its full force.
        and not exists (
          select 1
          from public.academy_lesson_progress progress
          where progress.student_id = target_student_id
            and progress.lesson_id = target_lesson_id
            and progress.completion_status = 'completed'
            and progress.completed_at is not null
            and activity.created_at > progress.completed_at
        )
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
  from public, anon;

notify pgrst, 'reload schema';