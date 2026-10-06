-- Graded assignments for the pure-Python weeks of the AI/ML course.
--
-- The course has eleven weeks and a single published assignment. These add one for
-- each of weeks 1 to 5, testing only what that week teaches: printing, a
-- conditional, a list, a function, and string handling.
--
-- Weeks 6 to 11 deliberately have none yet. They teach Pandas, NumPy, charts and
-- machine learning, and a student cannot run any of it today: the browser runtime
-- calls loadPyodide with no packages argument, so it has the standard library only,
-- and the server-side executor compiles with g++, so it cannot run Python either.
-- An assignment whose reference solution cannot be executed by the student is dead
-- content, so the runtime is fixed before those weeks get any.
--
-- Expected values were produced by running each reference solution and normalising
-- its stdout the way the executor does, not written by hand: eight cases across five
-- assignments, all passing locally before any row was written.
--
-- Not marked required_for_completion. Deterministic grading needs an executor that
-- can run Python, which does not exist yet, so requiring these would gate lesson
-- completion on infrastructure that is not there.

insert into public.academy_assignments (
  course_id,
  week_id,
  created_by,
  title,
  instructions,
  starter_code,
  points,
  total_points,
  allowed_submission_types,
  retry_limit,
  automated_tests,
  published,
  is_draft,
  status,
  release_at
)
select
  course.id,
  week.id,
  coalesce(
    (select existing.created_by
       from public.academy_assignments existing
      where existing.course_id = course.id
        and existing.created_by is not null
      order by existing.created_at
      limit 1),
    public.academy_primary_admin_id()
  ),
  seed.title,
  seed.instructions,
  seed.starter_code,
  seed.points,
  seed.points,
  array['code']::text[],
  3,
  seed.automated_tests,
  true,
  false,
  'published',
  now()
from (
  values
  (1, 'Python Week 1: print your first lines', E'Use print to output three lines exactly as written:

1. Ready
2. Check the sensor
3. Report', E'# TODO: print the three required lines
', 20, E'[{"name":"prints three lines","input":[],"expected":"Ready\\nCheck the sensor\\nReport"}]'::jsonb),
  (2, 'Python Week 2: a temperature warning', E'Read a temperature and warn when it is freezing.

Print "Freezing warning" when the temperature is at or below 0, otherwise print "Temperature OK".', E'temperature = int(input())
# TODO: print the matching message
', 25, E'[{"name":"at zero warns","input":["0"],"expected":"Freezing warning"},{"name":"above zero is fine","input":["12"],"expected":"Temperature OK"}]'::jsonb),
  (3, 'Python Week 3: sum a list of readings', E'Read five readings, one per line. Print their total, then their average to two decimal places.', E'# TODO: read five readings, print the total then the average
', 25, E'[{"name":"totals and averages","input":["10","20","30","40","50"],"expected":"150\\n30.00"}]'::jsonb),
  (4, 'Python Week 4: reuse a threshold tool', E'Write a function is_bright that returns True when a reading is 400 or more.

Read one reading and print "bright" or "dim".', E'# TODO: write is_bright, then print bright or dim
', 30, E'[{"name":"at threshold is bright","input":["400"],"expected":"bright"},{"name":"below threshold is dim","input":["120"],"expected":"dim"}]'::jsonb),
  (5, 'Python Week 5: count words in a line', E'Read one line of text and print how many words it contains.', E'# TODO: count the words and print the number
', 30, E'[{"name":"counts four words","input":["the quick brown fox"],"expected":"4"},{"name":"counts one word","input":["hello"],"expected":"1"}]'::jsonb)
) as seed(week_number, title, instructions, starter_code, points, automated_tests)
join public.academy_courses course on course.slug = 'python-for-ai-machine-learning'
join public.academy_weeks week
  on week.course_id = course.id
 and week.week_number = seed.week_number
where not exists (
  select 1 from public.academy_assignments existing
  where existing.course_id = course.id
    and existing.title = seed.title
);

notify pgrst, 'reload schema';
