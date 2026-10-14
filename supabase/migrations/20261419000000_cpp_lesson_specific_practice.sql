-- The weekly C++ question bank was copied to all five lessons in each week,
-- making the same three questions appear repeatedly. Keep that bank on the
-- checkpoint lesson; other lessons use the lesson-grounded practice generator.
with repeated_questions as (
  select exercise.id
  from public.academy_exercises exercise
  join public.academy_lessons lesson on lesson.id = exercise.lesson_id
  join public.academy_weeks weeks on weeks.id = lesson.week_id
  join public.academy_courses course on course.id = weeks.course_id
  where course.slug = 'cpp-embedded-robotics'
    and weeks.week_number > 1
    and lesson.lesson_number <> 2
    and exercise.practice_session_id is null
    and exercise.question_type in (
      'multiple_choice',
      'true_false',
      'short_answer'
    )
    and exercise.title like format(
      'Week %s · Lesson %s · %%',
      weeks.week_number,
      lesson.lesson_number
    )
)
update public.academy_lesson_activities activity
set status = 'archived',
    required_for_completion = false
from repeated_questions repeated
where activity.kind = 'practice'
  and activity.ref_id = repeated.id;

update public.academy_exercises exercise
set published = false,
    status = 'archived'
from public.academy_lessons lesson
join public.academy_weeks weeks on weeks.id = lesson.week_id
join public.academy_courses course on course.id = weeks.course_id
where exercise.lesson_id = lesson.id
  and course.slug = 'cpp-embedded-robotics'
  and weeks.week_number > 1
  and lesson.lesson_number <> 2
  and exercise.practice_session_id is null
  and exercise.question_type in (
    'multiple_choice',
    'true_false',
    'short_answer'
  )
  and exercise.title like format(
    'Week %s · Lesson %s · %%',
    weeks.week_number,
    lesson.lesson_number
  )
  and exercise.status = 'published'
  and exercise.published;
