insert into public.academy_schools (name, code, state, city)
values
  ('CIMAI', 'CIMAI', 'Kwara', 'Ilorin'),
  ('SMS', 'SMS', 'Plateau', 'Jos'),
  ('MMS', 'MMS', 'Lagos', 'Lagos'),
  ('DGHIA', 'DGHIA', 'Plateau', 'Jos'),
  ('Haneef', 'Haneef', 'Plateau', 'Jos')
on conflict (code) do update
set name = excluded.name,
    state = excluded.state,
    city = excluded.city,
    is_active = true;

update public.academy_profiles profile
set state = school.state,
    city = school.city
from public.academy_schools school
where profile.school_id = school.id
  and school.code in ('CIMAI', 'SMS', 'MMS', 'DGHIA', 'Haneef');

-- Older profiles can have a selected course on their profile but no matching
-- enrollment row. Restore only students without any active enrollment so this
-- does not change the course choice of a currently enrolled student.
insert into public.academy_enrollments (student_id, course_id, status)
select profile.id, profile.current_course_id, 'active'
from public.academy_profiles profile
join public.academy_courses course
  on course.id = profile.current_course_id
where profile.role = 'student'
  and profile.current_course_id is not null
  and course.published
  and course.is_active
  and not exists (
    select 1
    from public.academy_enrollments enrollment
    where enrollment.student_id = profile.id
      and enrollment.status = 'active'
  )
on conflict (student_id, course_id) do update
set status = 'active';

do $$
declare
  assignment_seed record;
  selected_course_id uuid;
  selected_week_id uuid;
  selected_lesson_id uuid;
  selected_assignment_id uuid;
begin
  if public.academy_seed_author() is null then
    raise warning 'Week 1 assignments were not published: no Academy author is available.';
  else

  for assignment_seed in
    select *
    from (
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
          $cpp_instructions$Use the Week 1 flowchart idea from your manual: check a light sensor, decide whether it is dark, and choose what the gate should do. Write a C++ program that uses cout to print the four steps below, one step per line. For this first program, print the steps as text; you do not need to read a sensor or write an if statement.

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
    ) as seeds(course_slug, title, instructions, starter_code, expected_output, objectives, points)
  loop
    select course.id, week.id, lesson.id
      into selected_course_id, selected_week_id, selected_lesson_id
    from public.academy_courses course
    join public.academy_weeks week
      on week.course_id = course.id
     and week.week_number = 1
    join public.academy_lessons lesson
      on lesson.week_id = week.id
     and lesson.lesson_number = 1
    where course.slug = assignment_seed.course_slug
      and course.published
      and course.is_active;

    if selected_lesson_id is null then
      raise warning 'Week 1 assignment for course % was skipped: its first lesson is missing or unpublished.',
        assignment_seed.course_slug;
      continue;
    end if;

    select assignment.id
      into selected_assignment_id
    from public.academy_assignments assignment
    where assignment.course_id = selected_course_id
      and assignment.title = assignment_seed.title
    limit 1;

    if selected_assignment_id is null then
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
      values (
        selected_course_id,
        selected_week_id,
        selected_lesson_id,
        public.academy_seed_author(),
        assignment_seed.title,
        assignment_seed.instructions,
        assignment_seed.objectives,
        assignment_seed.points,
        assignment_seed.points,
        'beginner',
        array['code'],
        assignment_seed.starter_code,
        jsonb_build_array(
          jsonb_build_object(
            'name', 'Week 1 program output',
            'input', '[]'::jsonb,
            'expected', assignment_seed.expected_output
          )
        ),
        true,
        now(),
        false,
        'published',
        true,
        3
      )
      returning id into selected_assignment_id;
    else
      update public.academy_assignments
      set lesson_id = selected_lesson_id,
          week_id = selected_week_id,
          published = true,
          published_at = coalesce(published_at, now()),
          is_draft = false,
          status = 'published',
          updated_at = now()
      where id = selected_assignment_id;
    end if;

    insert into public.academy_lesson_activities (
      lesson_id,
      kind,
      ref_id,
      title,
      points,
      status
    )
    values (
      selected_lesson_id,
      'assignment',
      selected_assignment_id,
      assignment_seed.title,
      assignment_seed.points,
      'published'
    )
    on conflict (lesson_id, kind, ref_id) do update
    set title = excluded.title,
        points = excluded.points,
        status = 'published';
  end loop;
  end if;
end;
$$;

notify pgrst, 'reload schema';
