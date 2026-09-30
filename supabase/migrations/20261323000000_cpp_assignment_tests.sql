-- The C++ course had nothing that could be auto-graded. Both example
-- assignments had automated_tests = null, so the grading path was correct end to
-- end and empty in the middle: the edge function had a verified executor
-- contract and no tests to send through it.
--
-- The existing C++ example asked for "hardware evidence", which an executor
-- cannot decide. A photograph of a working robot is evidence a person has to
-- look at, so it is relabelled and kept as a teacher-marked task rather than
-- dressed up as something automatic. What is added here is a task that genuinely
-- is a program: read two numbers, print the sum.
--
-- The cases carry inputs rather than only expected outputs, so a program that
-- prints the right answers without reading anything fails. That is the whole
-- reason the executor is fed stdin.

insert into public.academy_assignments (
  course_id,
  lesson_id,
  title,
  instructions,
  points,
  allowed_submission_types,
  starter_code,
  objectives,
  difficulty,
  status,
  published,
  is_draft,
  automated_tests,
  hints,
  created_by,
  created_at,
  updated_at
)
select
  c.id,
  l.id,
  'C++: read two numbers and print their sum',
  'Write a program that reads two whole numbers from standard input, one per '
    || 'line, and prints their sum. Your program has to read the input to get '
    || 'the marks: a program that prints the right answer whatever you type in '
    || 'will fail these tests.',
  20,
  array['code']::text[],
  E'#include <iostream>\nusing namespace std;\n\nint main() {\n  int a, b;\n  cin >> a >> b;\n  cout << a + b << endl;\n  return 0;\n}\n',
  -- objectives is jsonb on this table, not text[] the way lessons.objectives is.
  '[
    "Read two integers from standard input",
    "Print their sum on one line",
    "Compile and run without errors"
  ]'::jsonb,
  'beginner',
  'draft',
  false,
  true,
  '[
    {
      "name": "reads two numbers and prints their sum",
      "input": ["2", "3"],
      "expected": "5"
    },
    {
      "name": "handles a negative operand",
      "input": ["10", "-4"],
      "expected": "6"
    },
    {
      "name": "handles zero",
      "input": ["0", "0"],
      "expected": "0"
    },
    {
      "name": "handles a larger sum",
      "input": ["1000", "2000"],
      "expected": "3000"
    }
  ]'::jsonb,
  '[
    "cin reads whitespace separated values, so cin >> a >> b; takes one per line.",
    "endl ends the line, which is what the expected output ends with.",
    "If a test fails, run that exact input yourself and compare what you printed."
  ]'::jsonb,
  (select id from auth.users limit 1),
  now(),
  now()
from public.academy_courses c
join public.academy_weeks w on w.course_id = c.id and w.week_number = 2
join public.academy_lessons l on l.week_id = w.id and l.lesson_number = 1
where c.slug = 'cpp-embedded-robotics'
  and not exists (
    select 1
    from public.academy_assignments a
    where a.title = 'C++: read two numbers and print their sum'
  );

-- The hardware task stays, and says plainly that a person marks it.
update public.academy_assignments
set
  title = 'C++: build evidence and reflection',
  instructions = coalesce(
    nullif(instructions, ''),
    'Submit a photograph of your circuit or robot working, plus a short note '
      || 'explaining what you built and what you would change next. A teacher '
      || 'marks this one: a photograph is evidence a person has to look at, so it '
      || 'is not sent to the automatic grader.'
  ),
  automated_tests = null,
  updated_at = now()
where title = 'Example: C++ hardware evidence task';

-- The chain is rebuilt because nothing here changes lesson order, and the
-- constraint on sort_order must hold for anything inserted.
select public.academy_rechain_course_lessons(id)
from public.academy_courses
where slug = 'cpp-embedded-robotics';
