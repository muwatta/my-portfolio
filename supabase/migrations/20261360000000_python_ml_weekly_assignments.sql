-- Graded assignments for weeks 6 to 11 of the AI/ML course.
--
-- These were held back until the browser runtime could actually execute them. The
-- Python worker used to call loadPyodide with no packages argument, so Pandas,
-- NumPy and scikit-learn were unreachable and any assignment for these weeks would
-- have been unpassable content. It now fetches them on first import, so these are
-- worth having.
--
-- Nothing graded depends on drawing a chart. A rendered figure cannot be compared as
-- stdout, so where a week involves one the task prints the numbers the chart would
-- show. Weeks 7 and 10 say so explicitly rather than letting a student assume the
-- picture is what is checked.
--
-- Expected values were produced by running each reference solution against pandas
-- 3.0.6, numpy 2.5.3 and scikit-learn 1.9.1 and normalising its stdout the way the
-- executor does: six cases, all passing locally before any row was written. The
-- regression figures are the real ones, not placeholders.
--
-- Still not marked required_for_completion. Deterministic grading runs on the
-- executor, which compiles with g++ and cannot execute Python, so automated results
-- are not available for this course yet.

insert into public.academy_assignments (
  course_id, week_id, created_by, title, instructions, starter_code,
  points, total_points, allowed_submission_types, retry_limit,
  automated_tests, published, is_draft, status, release_at
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
  (6, 'Week 6: summarise a dataset with Pandas', E'Read five readings, one per line, into a Pandas Series.

Print the mean and then the maximum, each to two decimal places.', E'# TODO: read the readings into a Series and print the mean then the maximum
', 30, E'[{"name":"prints the summary","input":["10","20","30","40","60"],"expected":"32.00\\n60.00"}]'::jsonb),
  (7, 'Week 7: normalise an array with NumPy', E'Read three values into a NumPy array and scale each one so the largest becomes 1.0.

Print the three values separated by spaces, each to two decimal places. If you draw a chart as well, that is fine, but the printed values are what is checked.', E'# TODO: read the values, scale them so the largest is 1.0, and print them
', 30, E'[{"name":"scales to the maximum","input":["2","4","8"],"expected":"0.25 0.50 1.00"}]'::jsonb),
  (8, 'Week 8: separate features from the target', E'Each of the next four lines is a house: rooms, age, price.

Read them into a Pandas DataFrame with the columns rooms, age and price. Then print the number of rows and the number of columns, separated by a space.', E'# TODO: read the houses into a DataFrame and print its shape
', 30, E'[{"name":"reads the shape","input":["3 12 240","4 20 310","5 8 275"],"expected":"3 3"}]'::jsonb),
  (9, 'Week 9: train a first linear model', E'Read three study hours and three scores. Fit a linear regression of score on hours.

Print the two coefficients to two decimal places: the intercept first, then the slope.', E'# TODO: fit a linear regression and print the intercept then the slope
', 30, E'[{"name":"prints the coefficients","input":["1 50","2 55","3 65"],"expected":"41.67\\n7.50"}]'::jsonb),
  (10, 'Week 10: compare two experiments', E'Read four training hours and their result. Fit a model on the first three rows only.

Predict the fourth row and print that prediction to two decimal places.', E'# TODO: train on the first three rows and predict the fourth
', 30, E'[{"name":"predicts the held-out row","input":["1 20","2 24","3 27","5 35"],"expected":"34.17"}]'::jsonb),
  (11, 'Week 11: present your project result', E'Summarise your project in three lines.

1. The problem you set out to solve.
2. The data you used.
3. What you would try next.

Write one line for each, in that order.', E'# TODO: print three lines: the problem, the data, and the next step
', 40, E'[{"name":"prints three lines","input":[],"expected":"Predict house prices from room count\\nA dataset of 200 homes\\nAdd more features and cross validate"}]'::jsonb)
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
