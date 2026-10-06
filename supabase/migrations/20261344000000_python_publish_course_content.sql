-- Publish draft and scheduled Python-course learning content immediately while
-- preserving content explicitly archived by an instructor.
with python_course as (
  select id
  from public.academy_courses
  where slug = 'python-for-ai-machine-learning'
)
update public.academy_lessons lesson
set status = 'published',
    published = true,
    release_at = now()
from public.academy_weeks weeks, python_course course
where weeks.id = lesson.week_id
  and weeks.course_id = course.id
  and lesson.status <> 'archived'
  and (lesson.status <> 'published' or lesson.published is not true);

with python_course as (
  select id
  from public.academy_courses
  where slug = 'python-for-ai-machine-learning'
)
update public.academy_exercises exercise
set status = 'published',
    published = true,
    release_at = now()
from public.academy_lessons lesson
join public.academy_weeks weeks on weeks.id = lesson.week_id
join python_course course on course.id = weeks.course_id
where exercise.lesson_id = lesson.id
  and exercise.status <> 'archived'
  and (exercise.status <> 'published' or exercise.published is not true);

with python_course as (
  select id
  from public.academy_courses
  where slug = 'python-for-ai-machine-learning'
)
update public.academy_assignments assignment
set status = 'published',
    published = true,
    is_draft = false,
    release_at = now()
from python_course course
where assignment.course_id = course.id
  and assignment.status <> 'archived'
  and (
    assignment.status <> 'published'
    or assignment.published is not true
    or assignment.is_draft
  );

with python_course as (
  select id
  from public.academy_courses
  where slug = 'python-for-ai-machine-learning'
)
update public.academy_lesson_activities activity
set status = 'published',
    release_at = now()
from public.academy_lessons lesson
join public.academy_weeks weeks on weeks.id = lesson.week_id
join python_course course on course.id = weeks.course_id
where activity.lesson_id = lesson.id
  and activity.status <> 'archived'
  and activity.status <> 'published';
