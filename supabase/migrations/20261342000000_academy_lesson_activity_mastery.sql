-- Give every published Python and Embedded lesson a complete, scored practice
-- set, and require students to finish its activities before completing it.

alter table public.academy_lesson_activities
  add column if not exists required_for_completion boolean not null default false;

-- The existing weekly question bank is authored against the course materials.
-- Reuse each week's three questions for every lesson in that week, filling only
-- lessons that do not already have three objective-scored questions.
with question_bank as (
  select
    course.id as course_id,
    weeks.id as week_id,
    exercise.id as exercise_id,
    exercise.title,
    exercise.instructions,
    exercise.difficulty,
    exercise.expected_concepts,
    exercise.hints,
    exercise.explanation,
    exercise.question_type,
    exercise.choices,
    exercise.correct_answer,
    exercise.sort_order
  from public.academy_exercises exercise
  join public.academy_lessons bank_lesson
    on bank_lesson.id = exercise.lesson_id
  join public.academy_weeks weeks
    on weeks.id = bank_lesson.week_id
  join public.academy_courses course
    on course.id = weeks.course_id
  where exercise.published
    and exercise.status = 'published'
    and exercise.question_type in ('multiple_choice', 'true_false', 'short_answer')
    and (
      (course.slug = 'python-for-ai-machine-learning'
        and bank_lesson.lesson_number in (6, 7, 8))
      or
      (course.slug = 'cpp-embedded-robotics'
        and bank_lesson.lesson_number = 2)
    )
),
lesson_targets as (
  select
    lesson.id as lesson_id,
    lesson.title as lesson_title,
    lesson.lesson_number,
    lesson.week_id,
    weeks.week_number,
    course.id as course_id,
    greatest(
      0,
      3 - count(exercise.id) filter (
        where exercise.published
          and exercise.status = 'published'
          and exercise.question_type in ('multiple_choice', 'true_false', 'short_answer')
      )
    ) as needed
  from public.academy_lessons lesson
  join public.academy_weeks weeks on weeks.id = lesson.week_id
  join public.academy_courses course on course.id = weeks.course_id
  left join public.academy_exercises exercise on exercise.lesson_id = lesson.id
  where course.slug in (
      'python-for-ai-machine-learning',
      'cpp-embedded-robotics'
    )
    and course.published
    and lesson.published
    and lesson.status = 'published'
  group by
    lesson.id,
    lesson.title,
    lesson.lesson_number,
    lesson.week_id,
    weeks.week_number,
    course.id
),
missing_questions as (
  select
    target.lesson_id,
    target.lesson_title,
    target.lesson_number,
    target.week_number,
    bank.*,
    row_number() over (
      partition by target.lesson_id
      order by bank.sort_order, bank.title, bank.exercise_id
    ) as question_number
  from lesson_targets target
  join question_bank bank
    on bank.course_id = target.course_id
   and bank.week_id = target.week_id
  where target.needed > 0
    and not exists (
      select 1
      from public.academy_exercises existing
      where existing.lesson_id = target.lesson_id
        and existing.title = format(
          'Week %s · Lesson %s · %s',
          target.week_number,
          target.lesson_number,
          bank.title
        )
    )
)
insert into public.academy_exercises (
  lesson_id,
  title,
  instructions,
  starter_code,
  difficulty,
  expected_concepts,
  hints,
  explanation,
  question_type,
  choices,
  correct_answer,
  attempt_limit,
  published,
  status,
  sort_order
)
select
  missing.lesson_id,
  format(
    'Week %s · Lesson %s · %s',
    missing.week_number,
    missing.lesson_number,
    missing.title
  ),
  missing.instructions,
  '',
  missing.difficulty,
  missing.expected_concepts,
  missing.hints,
  missing.explanation,
  missing.question_type,
  missing.choices,
  missing.correct_answer,
  99,
  true,
  'published',
  missing.sort_order
from missing_questions missing
join lesson_targets target on target.lesson_id = missing.lesson_id
where missing.question_number <= target.needed;

do $$
declare
  lessons_below_activity_target integer;
begin
  select count(*)
    into lessons_below_activity_target
  from public.academy_lessons lesson
  join public.academy_weeks weeks on weeks.id = lesson.week_id
  join public.academy_courses course on course.id = weeks.course_id
  where course.slug in (
      'python-for-ai-machine-learning',
      'cpp-embedded-robotics'
    )
    and course.published
    and lesson.published
    and lesson.status = 'published'
    and (
      select count(*)
      from public.academy_exercises exercise
      where exercise.lesson_id = lesson.id
        and exercise.published
        and exercise.status = 'published'
        and exercise.question_type in (
          'multiple_choice',
          'true_false',
          'short_answer'
        )
    ) < 3;

  if lessons_below_activity_target > 0 then
    raise exception
      'Cannot provision lesson mastery activities: % published lessons still have fewer than three scored practice questions.',
      lessons_below_activity_target;
  end if;
end;
$$;

-- Publish and attach each objective-scored practice question as a required,
-- five-point lesson activity. Assignment activities are required on submission.
insert into public.academy_lesson_activities (
  lesson_id,
  kind,
  ref_id,
  title,
  points,
  status,
  sort_order,
  required_for_completion
)
select
  exercise.lesson_id,
  'practice',
  exercise.id,
  exercise.title,
  5,
  'published',
  exercise.sort_order,
  true
from public.academy_exercises exercise
join public.academy_lessons lesson on lesson.id = exercise.lesson_id
join public.academy_weeks weeks on weeks.id = lesson.week_id
join public.academy_courses course on course.id = weeks.course_id
where course.slug in (
    'python-for-ai-machine-learning',
    'cpp-embedded-robotics'
  )
  and course.published
  and lesson.published
  and lesson.status = 'published'
  and exercise.published
  and exercise.status = 'published'
  and exercise.question_type in ('multiple_choice', 'true_false', 'short_answer')
on conflict (lesson_id, kind, ref_id) do update
set title = excluded.title,
    points = excluded.points,
    status = excluded.status,
    sort_order = excluded.sort_order,
    required_for_completion = true;

insert into public.academy_lesson_activities (
  lesson_id,
  kind,
  ref_id,
  title,
  points,
  status,
  sort_order,
  required_for_completion
)
select
  assignment.lesson_id,
  'assignment',
  assignment.id,
  assignment.title,
  assignment.points,
  'published',
  100,
  true
from public.academy_assignments assignment
join public.academy_courses course on course.id = assignment.course_id
where course.slug in (
    'python-for-ai-machine-learning',
    'cpp-embedded-robotics'
  )
  and assignment.lesson_id is not null
  and assignment.published
  and not assignment.is_draft
  and assignment.status = 'published'
  and (assignment.release_at is null or assignment.release_at <= now())
on conflict (lesson_id, kind, ref_id) do update
set title = excluded.title,
    points = excluded.points,
    status = excluded.status,
    required_for_completion = true;

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

-- A pre-migration completion must not let a student bypass newly required work.
create or replace function public.academy_lesson_is_unlocked_for_student(
  p_student_id uuid,
  p_lesson_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_course_id uuid;
  v_prerequisite_lesson_id uuid;
  v_prerequisite_completed boolean;
  v_active_enrollment boolean;
begin
  if p_student_id is null or p_lesson_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.academy_admins
    where user_id = p_student_id
  )
  or exists (
    select 1
    from public.academy_profiles
    where id = p_student_id
      and role = 'teacher'
  )
  then
    return true;
  end if;

  select weeks.course_id, lesson.prerequisite_lesson_id
    into v_course_id, v_prerequisite_lesson_id
  from public.academy_lessons lesson
  join public.academy_weeks weeks on weeks.id = lesson.week_id
  where lesson.id = p_lesson_id;

  if v_course_id is null then
    return false;
  end if;

  select exists (
    select 1
    from public.academy_enrollments enrollment
    where enrollment.student_id = p_student_id
      and enrollment.course_id = v_course_id
      and enrollment.status = 'active'
  )
  into v_active_enrollment;

  if not v_active_enrollment then
    return false;
  end if;

  if v_prerequisite_lesson_id is null then
    return true;
  end if;

  select exists (
    select 1
    from public.academy_lesson_progress progress
    where progress.student_id = p_student_id
      and progress.lesson_id = v_prerequisite_lesson_id
      and progress.completion_status = 'completed'
  )
  into v_prerequisite_completed;

  return v_prerequisite_completed
    and public.academy_lesson_required_activities_complete(
      p_student_id,
      v_prerequisite_lesson_id
    );
end;
$$;

revoke execute on function public.academy_lesson_is_unlocked_for_student(uuid, uuid)
  from public, anon;
grant execute on function public.academy_lesson_is_unlocked_for_student(uuid, uuid)
  to authenticated;

-- Completion is a server-side gate: all required published practice must have a
-- passing attempt, and each required assignment must have a submitted attempt.
create or replace function public.academy_require_lesson_activities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.completed_at is not null then
    return new;
  end if;

  if public.academy_is_teacher() or public.academy_is_admin() then
    return new;
  end if;

  if not public.academy_lesson_required_activities_complete(
    new.student_id,
    new.lesson_id
  ) then
    raise exception
      'Complete every required practice question and submit each assignment before completing this lesson.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists academy_require_lesson_activities
  on public.academy_lesson_progress;
create trigger academy_require_lesson_activities
before insert or update on public.academy_lesson_progress
for each row
execute function public.academy_require_lesson_activities();

revoke execute on function public.academy_require_lesson_activities()
  from public, anon, authenticated;

-- Score each successful practice once per question and each graded assignment
-- once per assignment, preventing repeated submissions from farming points.
create or replace function public.academy_award_practice_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.passed > 0
    and not exists (
      select 1
      from public.academy_leaderboard_points points
      where points.student_id = new.student_id
        and points.source_type = 'practice'
        and (
          points.source_id = new.exercise_id
          or exists (
            select 1
            from public.academy_exercise_attempts prior_attempt
            where prior_attempt.id = points.source_id
              and prior_attempt.exercise_id = new.exercise_id
          )
        )
    )
  then
    perform public.academy_award_verified_activity(
      new.student_id,
      'practice',
      new.exercise_id,
      5,
      'first-practice'
    );
  end if;
  return new;
end;
$$;

create or replace function public.academy_award_assignment_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assignment_points integer;
  points_to_award integer;
begin
  if new.review_state <> 'published' or new.final_score is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
    and old.review_state = 'published'
    and old.final_score is not distinct from new.final_score
  then
    return new;
  end if;

  select assignment.points
    into assignment_points
  from public.academy_assignments assignment
  where assignment.id = new.assignment_id;

  if assignment_points is null or assignment_points <= 0 then
    return new;
  end if;

  if exists (
    select 1
    from public.academy_leaderboard_points points
    where points.student_id = new.student_id
      and points.source_type = 'assignment'
      and points.source_id = new.assignment_id
  ) then
    return new;
  end if;

  points_to_award := round(
    assignment_points::numeric
      * greatest(0, least(new.final_score, coalesce(nullif(new.max_score, 0), 100)))
      / coalesce(nullif(new.max_score, 0), 100)
  )::integer;

  if points_to_award > 0 then
    perform public.academy_award_verified_activity(
      new.student_id,
      'assignment',
      new.assignment_id,
      points_to_award,
      null
    );
  end if;
  return new;
end;
$$;

create or replace function public.academy_award_project_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed_at is not null
    and (tg_op = 'INSERT' or old.completed_at is null)
    and not exists (
      select 1
      from public.academy_leaderboard_points points
      where points.student_id = new.student_id
        and points.source_type = 'project'
        and points.source_id = new.milestone_id
    )
  then
    perform public.academy_award_verified_activity(
      new.student_id,
      'project',
      new.milestone_id,
      10,
      null
    );
  end if;
  return new;
end;
$$;

drop trigger if exists academy_assignment_points
  on public.academy_submission_results;
create trigger academy_assignment_points
after insert or update of review_state, final_score
on public.academy_submission_results
for each row
execute function public.academy_award_assignment_points();

drop trigger if exists academy_project_points
  on public.academy_project_progress;
create trigger academy_project_points
after insert or update on public.academy_project_progress
for each row
execute function public.academy_award_project_points();

revoke execute on function public.academy_award_assignment_points()
  from public, anon, authenticated;
revoke execute on function public.academy_award_project_points()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
