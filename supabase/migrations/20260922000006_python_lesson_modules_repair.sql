-- Add four interactive modules to every Python week.
-- Safe to rerun: existing lesson numbers are left unchanged.
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
  case module_number
    when 2 then 'See It: ' || topic
    when 3 then 'Rewrite It: ' || topic
    when 4 then 'Guided Practice: ' || topic
    else 'Challenge: ' || topic
  end,
  'week-' || weeks.week_number || '-module-' || module_number,
  module_number,
  case module_number
    when 2 then array['Explain the main idea in your own words']::text[]
    when 3 then array['Rewrite and run a short example']::text[]
    when 4 then array['Complete a guided coding task']::text[]
    else array['Build a small solution independently']::text[]
  end,
  jsonb_build_object(
    'goal', case module_number
      when 2 then 'Understand ' || lower(topic) || ' by studying a working example.'
      when 3 then 'Rewrite the example and test your own changes.'
      when 4 then 'Use ' || lower(topic) || ' in a guided program.'
      else 'Create a small project using ' || lower(topic) || '.'
    end,
    'explanation', 'Read the example, change one part, run it, and observe what happens.',
    'starter_code', starter_code,
    'hints', jsonb_build_array(
      'Start with the smallest working change.',
      'Run the program after each change.',
      'Read the error message before changing more code.'
    ),
    'challenge', case module_number
      when 2 then 'Change one value and predict the new output.'
      when 3 then 'Rewrite the program with your own names and values.'
      when 4 then 'Add one useful improvement to the guided program.'
      else 'Build a new example without copying the complete solution.'
    end,
    'reflection', 'What did you change, test, and learn?'
  ),
  true
from public.academy_weeks weeks
join public.academy_courses courses on courses.id = weeks.course_id
cross join lateral generate_series(2, 5) as module_numbers(module_number)
cross join lateral (
  select
    case weeks.week_number
      when 1 then 'Variables and output'
      when 2 then 'Decisions and conditions'
      when 3 then 'Loops and lists'
      when 4 then 'Functions and dictionaries'
      when 5 then 'Files and errors'
      when 6 then 'Pandas data'
      when 7 then 'Charts and patterns'
      when 8 then 'Features and targets'
      when 9 then 'Machine-learning models'
      when 10 then 'Experiments and evaluation'
      else 'Project planning'
    end as topic,
    case weeks.week_number
      when 1 then E'name = ''Ada''\nage = 13\nprint(name, age)'
      when 2 then E'score = 72\nif score >= 50:\n    print(''Pass'')\nelse:\n    print(''Try again'')'
      when 3 then E'scores = [60, 75, 82]\nfor score in scores:\n    print(score)'
      when 4 then E'def greet(name):\n    return ''Hello, '' + name\n\nprint(greet(''Ada''))'
      when 5 then E'try:\n    print(''Read a file here'')\nexcept FileNotFoundError:\n    print(''File not found'')'
      when 6 then E'data = {''score'': [7, 8, 10]}\nprint(data)'
      when 7 then E'values = [6, 8, 10]\nprint(values)'
      when 8 then E'features = [[1], [2], [4]]\ntarget = [7, 8, 10]\nprint(features, target)'
      when 9 then E'features = [[1], [2], [3]]\ntarget = [2, 4, 6]\nprint(''Ready to train'')'
      when 10 then E'experiment = ''Change one thing.''\nprint(experiment)'
      else E'question = ''What do I want to discover?''\nprint(question)'
    end as starter_code
) module_content
where courses.slug = 'python-for-ai-machine-learning'
  and not exists (
    select 1
    from public.academy_lessons existing
    where existing.week_id = weeks.id
      and existing.lesson_number = module_number
  )
on conflict (week_id, lesson_number) do nothing;
