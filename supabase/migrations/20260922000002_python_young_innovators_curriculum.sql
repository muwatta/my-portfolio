-- Published curriculum mapped from the Python for Young Innovators workbook.
insert into public.academy_courses (slug, title, description, duration_weeks, published)
values (
  'python-for-ai-machine-learning',
  'Python for Young Innovators: From First Program to Your First AI Project',
  'An 11-week, 44-hour practical Python and machine-learning course for secondary school students.',
  11,
  true
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  duration_weeks = excluded.duration_weeks,
  published = excluded.published;

insert into public.academy_weeks (course_id, week_number, title)
select course.id, curriculum.week_number, curriculum.title
from public.academy_courses course
join (
  values
    (1, 'Starting to Code'),
    (2, 'Making Decisions'),
    (3, 'Repeating & Organizing Data'),
    (4, 'Reusable Code & Dictionaries'),
    (5, 'Files & Errors'),
    (6, 'Meet Your Data'),
    (7, 'Exploring Data'),
    (8, 'What Is AI and Machine Learning, Really?'),
    (9, 'Your First Model'),
    (10, 'Build With Less Help'),
    (11, 'Your Own Project')
) as curriculum(week_number, title) on true
where course.slug = 'python-for-ai-machine-learning'
on conflict (course_id, week_number) do update set
  title = excluded.title;

update public.academy_lessons existing
set
  title = curriculum.lesson_title,
  slug = curriculum.slug,
  objectives = curriculum.objectives,
  content = curriculum.content::jsonb,
  published = true
from public.academy_weeks weeks
join public.academy_courses course on course.id = weeks.course_id
join (
  values
    (1, 'Session 1: What Is Programming? Your First Lines of Python', 'week-1-starting-to-code',
      array['Explain what a computer program is', 'Explain what Python is', 'Write, run, and comment a Python program'],
      '{"goal":"Write, save, and run a working Python program.","skills":["print","comments","variables","data types","input"],"project":"About Me and Mini Calculator"}'),
    (2, 'Making Decisions with Python', 'week-2-making-decisions',
      array['Use operators and comparisons', 'Write if, elif, and else branches', 'Use logical operators'],
      '{"goal":"Write branching programs that make decisions.","skills":["operators","comparisons","if","elif","else","logical operators"],"project":"Pass or Fail and Weather Advisor"}'),
    (3, 'Repeating and Organizing Data', 'week-3-repeating-and-organizing-data',
      array['Use for and while loops', 'Work with lists and indexes', 'Summarize a list of numbers'],
      '{"goal":"Process a collection of values with loops.","skills":["for loops","while loops","lists","indexing","basic debugging"],"project":"Class Score Tracker"}'),
    (4, 'Reusable Code and Dictionaries', 'week-4-reusable-code-and-dictionaries',
      array['Define and call functions', 'Use parameters and return values', 'Store labeled data in dictionaries'],
      '{"goal":"Write reusable functions and represent records with dictionaries.","skills":["functions","parameters","return values","dictionaries"],"project":"Student Record program"}'),
    (5, 'Files, Errors, and Review', 'week-5-files-and-errors',
      array['Read and write text files', 'Handle simple exceptions', 'Review core Python skills'],
      '{"goal":"Build a program that saves data, loads it, and handles a simple error.","skills":["reading files","writing files","exception handling"],"project":"Save and Load Scores"}'),
    (6, 'Meet Your Data with Pandas', 'week-6-meet-your-data',
      array['Explain datasets, rows, columns, features, and labels', 'Load a CSV with Pandas', 'Describe the shape and columns of a dataset'],
      '{"goal":"Load and inspect a small CSV dataset.","skills":["datasets","rows","columns","features","labels","CSV","Pandas"],"project":"Load and explore class attendance or exam scores"}'),
    (7, 'Exploring Data with NumPy and Charts', 'week-7-exploring-data',
      array['Use basic Pandas and NumPy operations', 'Compute simple averages', 'Create a simple Matplotlib chart'],
      '{"goal":"Explore a dataset and communicate a pattern with a chart.","skills":["Pandas","NumPy","Matplotlib","averages","charts"],"project":"Build a chart from real data"}'),
    (8, 'What Is AI and Machine Learning, Really?', 'week-8-what-is-ai-and-machine-learning',
      array['Explain traditional programming and machine learning', 'Distinguish features from targets', 'Explain training, testing, prediction, and overfitting'],
      '{"goal":"Explain what a model is in plain language.","concepts":["model","training","prediction","feature","target","classification","regression","accuracy","overfitting"],"project":"Human as a Model unplugged activity"}'),
    (9, 'Your First Machine-Learning Model', 'week-9-your-first-model',
      array['Split data into training and testing sets', 'Train a scikit-learn model', 'Test accuracy and make a prediction'],
      '{"goal":"Train, test, and use a real scikit-learn model with guidance.","skills":["scikit-learn","train_test_split","fit","predict","accuracy"],"project":"Guided classification using a student or Iris dataset"}'),
    (10, 'Build With Less Help', 'week-10-build-with-less-help',
      array['Choose features and a target', 'Evaluate a model', 'Adapt a guided workflow to a new dataset'],
      '{"goal":"Adapt the Week 9 workflow to a new problem with less guidance.","skills":["features","target","evaluation","experimentation"],"project":"Guided-but-lighter classification or regression project"}'),
    (11, 'Your Own AI/ML Project', 'week-11-your-own-project',
      array['Build and debug an independent project', 'Use the full data-to-prediction pipeline', 'Explain and present project decisions'],
      '{"goal":"Build, explain, and present a small machine-learning project independently.","skills":["problem definition","data preparation","model training","testing","debugging","presentation"],"project":"Independent final project"}')
) as curriculum(week_number, lesson_title, slug, objectives, content)
  on curriculum.week_number = weeks.week_number
where existing.week_id = weeks.id
  and existing.lesson_number = 1
  and course.slug = 'python-for-ai-machine-learning';

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
  weeks.id,
  curriculum.lesson_title,
  curriculum.slug,
  1,
  curriculum.objectives,
  curriculum.content::jsonb,
  true
from public.academy_weeks weeks
join public.academy_courses course on course.id = weeks.course_id
join (
  values
    (
      1,
      'Session 1: What Is Programming? Your First Lines of Python',
      'week-1-starting-to-code',
      array['Explain what a computer program is', 'Explain what Python is', 'Write, run, and comment a Python program'],
      '{"goal":"Write, save, and run a working Python program.","skills":["print","comments","variables","data types","input"],"project":"About Me and Mini Calculator"}'
    ),
    (
      2,
      'Making Decisions with Python',
      'week-2-making-decisions',
      array['Use operators and comparisons', 'Write if, elif, and else branches', 'Use logical operators'],
      '{"goal":"Write branching programs that make decisions.","skills":["operators","comparisons","if","elif","else","logical operators"],"project":"Pass or Fail and Weather Advisor"}'
    ),
    (
      3,
      'Repeating and Organizing Data',
      'week-3-repeating-and-organizing-data',
      array['Use for and while loops', 'Work with lists and indexes', 'Summarize a list of numbers'],
      '{"goal":"Process a collection of values with loops.","skills":["for loops","while loops","lists","indexing","basic debugging"],"project":"Class Score Tracker"}'
    ),
    (
      4,
      'Reusable Code and Dictionaries',
      'week-4-reusable-code-and-dictionaries',
      array['Define and call functions', 'Use parameters and return values', 'Store labeled data in dictionaries'],
      '{"goal":"Write reusable functions and represent records with dictionaries.","skills":["functions","parameters","return values","dictionaries"],"project":"Student Record program"}'
    ),
    (
      5,
      'Files, Errors, and Review',
      'week-5-files-and-errors',
      array['Read and write text files', 'Handle simple exceptions', 'Review core Python skills'],
      '{"goal":"Build a program that saves data, loads it, and handles a simple error.","skills":["reading files","writing files","exception handling"],"project":"Save and Load Scores"}'
    ),
    (
      6,
      'Meet Your Data with Pandas',
      'week-6-meet-your-data',
      array['Explain datasets, rows, columns, features, and labels', 'Load a CSV with Pandas', 'Describe the shape and columns of a dataset'],
      '{"goal":"Load and inspect a small CSV dataset.","skills":["datasets","rows","columns","features","labels","CSV","Pandas"],"project":"Load and explore class attendance or exam scores"}'
    ),
    (
      7,
      'Exploring Data with NumPy and Charts',
      'week-7-exploring-data',
      array['Use basic Pandas and NumPy operations', 'Compute simple averages', 'Create a simple Matplotlib chart'],
      '{"goal":"Explore a dataset and communicate a pattern with a chart.","skills":["Pandas","NumPy","Matplotlib","averages","charts"],"project":"Build a chart from real data"}'
    ),
    (
      8,
      'What Is AI and Machine Learning, Really?',
      'week-8-what-is-ai-and-machine-learning',
      array['Explain traditional programming and machine learning', 'Distinguish features from targets', 'Explain training, testing, prediction, and overfitting'],
      '{"goal":"Explain what a model is in plain language.","concepts":["model","training","prediction","feature","target","classification","regression","accuracy","overfitting"],"project":"Human as a Model unplugged activity"}'
    ),
    (
      9,
      'Your First Machine-Learning Model',
      'week-9-your-first-model',
      array['Split data into training and testing sets', 'Train a scikit-learn model', 'Test accuracy and make a prediction'],
      '{"goal":"Train, test, and use a real scikit-learn model with guidance.","skills":["scikit-learn","train_test_split","fit","predict","accuracy"],"project":"Guided classification using a student or Iris dataset"}'
    ),
    (
      10,
      'Build With Less Help',
      'week-10-build-with-less-help',
      array['Choose features and a target', 'Evaluate a model', 'Adapt a guided workflow to a new dataset'],
      '{"goal":"Adapt the Week 9 workflow to a new problem with less guidance.","skills":["features","target","evaluation","experimentation"],"project":"Guided-but-lighter classification or regression project"}'
    ),
    (
      11,
      'Your Own AI/ML Project',
      'week-11-your-own-project',
      array['Build and debug an independent project', 'Use the full data-to-prediction pipeline', 'Explain and present project decisions'],
      '{"goal":"Build, explain, and present a small machine-learning project independently.","skills":["problem definition","data preparation","model training","testing","debugging","presentation"],"project":"Independent final project"}'
    )
) as curriculum(week_number, lesson_title, slug, objectives, content)
  on curriculum.week_number = weeks.week_number
where course.slug = 'python-for-ai-machine-learning'
  and not exists (
    select 1
    from public.academy_lessons existing
    where existing.week_id = weeks.id
      and existing.lesson_number = 1
  );
