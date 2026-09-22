insert into public.academy_courses (slug, title, description, duration_weeks, published)
values (
  'python-for-ai-machine-learning',
  'Python for AI & Machine Learning',
  'An 11-week path from Python foundations to a first AI/ML project.',
  11,
  true
)
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  duration_weeks = excluded.duration_weeks,
  published = excluded.published;

insert into public.academy_weeks (course_id, week_number, title)
select c.id, weeks.week_number, weeks.title
from public.academy_courses c
cross join (
  values
    (1, 'Python foundations'),
    (2, 'Programming thinking'),
    (3, 'Data handling'),
    (4, 'Functions and reusable code'),
    (5, 'NumPy and arrays'),
    (6, 'Pandas and datasets'),
    (7, 'Visualizing data'),
    (8, 'AI concepts'),
    (9, 'Machine learning basics'),
    (10, 'Model evaluation'),
    (11, 'Final AI/ML project')
) as weeks(week_number, title)
where c.slug = 'python-for-ai-machine-learning'
on conflict (course_id, week_number) do update
set title = excluded.title;

insert into public.academy_lessons (
  week_id,
  title,
  slug,
  lesson_number,
  objectives,
  content,
  published
)
select
  w.id,
  lesson.title,
  lesson.slug,
  lesson.lesson_number,
  lesson.objectives,
  lesson.content::jsonb,
  true
from public.academy_weeks w
join public.academy_courses c
  on c.id = w.course_id
cross join (
  values
    (
      1,
      1,
      'Python foundations: values and variables',
      'python-foundations-values-and-variables',
      array[
        'Name values with variables',
        'Recognize common Python data types'
      ],
      '{"explanation":"Programs become easier to reason about when we give useful names to values.","examples":["name = ''Ada''","age = 13","print(name, age)"],"connection":"Clear data names are the first step toward working with datasets."}'
    ),
    (
      4,
      1,
      'Functions: reusable thinking',
      'functions-reusable-thinking',
      array[
        'Define a function',
        'Use parameters and return values'
      ],
      '{"explanation":"A function packages a small idea so you can test it, reuse it, and improve it.","examples":["def average(a, b):\n    return (a + b) / 2"],"connection":"Machine learning workflows are built from many small reusable transformations."}'
    ),
    (
      6,
      1,
      'Pandas: reading a dataset',
      'pandas-reading-a-dataset',
      array[
        'Describe rows and columns',
        'Inspect missing or surprising values'
      ],
      '{"explanation":"A dataset is a collection of observations. Pandas gives us tools to inspect those observations.","examples":["import pandas as pd\ndata = pd.DataFrame({''score'': [7, 8, 10]})\nprint(data.describe())"],"connection":"Before training a model, you need to understand the data it will learn from."}'
    )
) as lesson(
  week_number,
  lesson_number,
  title,
  slug,
  objectives,
  content
)
where c.slug = 'python-for-ai-machine-learning'
  and w.week_number = lesson.week_number
on conflict (week_id, lesson_number) do update
set
  title = excluded.title,
  slug = excluded.slug,
  objectives = excluded.objectives,
  content = excluded.content,
  published = excluded.published;

insert into public.academy_projects (course_id, title, description)
select
  c.id,
  'My first AI/ML investigation',
  'Choose a small question, explore data, train a model, and explain what you discovered.'
from public.academy_courses c
where c.slug = 'python-for-ai-machine-learning'
  and not exists (
    select 1
    from public.academy_projects p
    where p.course_id = c.id
  );

insert into public.academy_project_milestones (
  project_id,
  milestone_number,
  title
)
select
  p.id,
  milestones.milestone_number,
  milestones.title
from public.academy_projects p
cross join (
  values
    (1, 'Choose a problem'),
    (2, 'Find and prepare a dataset'),
    (3, 'Load and explore data'),
    (4, 'Select features and target'),
    (5, 'Train and test a model'),
    (6, 'Evaluate and explain results')
) as milestones(milestone_number, title)
where not exists (
  select 1
  from public.academy_project_milestones m
  where m.project_id = p.id
    and m.milestone_number = milestones.milestone_number
);

