do $$
begin
  if public.academy_seed_author() is null then
    raise exception 'Cannot seed Week 1 assignments: no academy admin or user is available as an author.';
  end if;
end;
$$;

with assignment_seed (
  course_slug,
  title,
  instructions,
  starter_code,
  expected_output,
  objectives,
  points
) as (
  values
    (
      'python-for-ai-machine-learning',
      'Week 1 Python: My First Welcome Card',
      $python_instructions$Create a three-line welcome card using the Week 1 ideas from your workbook: comments and print() with quoted text.

Your program must print these exact lines, in this order:
Hello, Young Innovator!
I am learning Python.
My first program is running!

Use one print() statement per line, then run it and submit your Python code. Optional: Add a comment above your print statements to describe the program.$python_instructions$,
      $python_starter$# TODO: Print the three required lines, one line at a time.
$python_starter$,
      $python_output$Hello, Young Innovator!
I am learning Python.
My first program is running!$python_output$,
      '["Use print() to display text", "Put text inside quotation marks", "Print the required lines in order"]'::jsonb,
      20
    ),
    (
      'cpp-embedded-robotics',
      'Week 1 C++: Turn a Flowchart into Output',
      $cpp_instructions$      Use the Week 1 flowchart idea from your manual: check a light sensor, decide whether it is dark, and choose what the gate should do. Write a C++ program that uses cout to print the four steps below, one step per line. For this first program, print the steps as text; you do not need to read a sensor or write an if statement.

Your program must print these exact lines, in this order:
1. Check the light sensor.
2. Ask: Is it dark?
3. If yes, close the gate.
4. If no, open the gate.

Run the program and submit your C++ code. Optional: Add a // comment above your output to describe the flowchart decision.$cpp_instructions$,
      $cpp_starter$#include <iostream>
using namespace std;

int main() {
    // TODO: Use cout to print the four required steps, one per line.
    return 0;
}
$cpp_starter$,
      $cpp_output$1. Check the light sensor.
2. Ask: Is it dark?
3. If yes, close the gate.
4. If no, open the gate.$cpp_output$,
      '["Use cout to display text", "Represent the algorithm in the correct order", "Compile and run a first C++ program"]'::jsonb,
      20
    )
),
week_one_lessons as (
  select
    c.id as course_id,
    w.id as week_id,
    l.id as lesson_id,
    s.title,
    s.instructions,
    s.starter_code,
    s.expected_output,
    s.objectives,
    s.points
  from assignment_seed s
  join public.academy_courses c on c.slug = s.course_slug
  join public.academy_weeks w on w.course_id = c.id and w.week_number = 1
  join public.academy_lessons l on l.week_id = w.id and l.lesson_number = 1
)
insert into public.academy_assignments (
  course_id,
  week_id,
  lesson_id,
  created_by,
  title,
  instructions,
  objectives,
  points,
  total_points,
  difficulty,
  allowed_submission_types,
  starter_code,
  automated_tests,
  published,
  published_at,
  is_draft,
  status,
  ai_feedback_enabled,
  retry_limit
)
select
  lesson.course_id,
  lesson.week_id,
  lesson.lesson_id,
  public.academy_seed_author(),
  lesson.title,
  lesson.instructions,
  lesson.objectives,
  lesson.points,
  lesson.points,
  'beginner',
  array['code'],
  lesson.starter_code,
  jsonb_build_array(
    jsonb_build_object(
      'name', 'Week 1 program output',
      'input', '[]'::jsonb,
      'expected', lesson.expected_output
    )
  ),
  true,
  now(),
  false,
  'published',
  true,
  3
from week_one_lessons lesson
where not exists (
  select 1
  from public.academy_assignments existing
  where existing.course_id = lesson.course_id
    and existing.title = lesson.title
);

insert into public.academy_lesson_activities (
  lesson_id,
  kind,
  ref_id,
  title,
  points,
  status
)
select
  assignment.lesson_id,
  'assignment',
  assignment.id,
  assignment.title,
  assignment.points,
  'published'
from public.academy_assignments assignment
join public.academy_courses course on course.id = assignment.course_id
where assignment.title in (
    'Week 1 Python: My First Welcome Card',
    'Week 1 C++: Turn a Flowchart into Output'
  )
  and course.slug in (
    'python-for-ai-machine-learning',
    'cpp-embedded-robotics'
  )
  and assignment.lesson_id is not null
on conflict (lesson_id, kind, ref_id) do nothing;

notify pgrst, 'reload schema';
