-- Add meaningful guided modules 3-5 to each Python week.
insert into public.academy_lessons (
  week_id, title, slug, lesson_number, objectives, content, published
)
select
  weeks.id,
  modules.title,
  modules.slug,
  modules.lesson_number,
  modules.objectives,
  modules.content,
  true
from public.academy_weeks weeks
join public.academy_courses courses on courses.id = weeks.course_id
join (
  values
    (1, 3, 'Practice: Variables and Output', 'week-1-practice-variables',
      array['Rewrite a short program using your own values']::text[],
      jsonb_build_object('goal','Rewrite and run a personal introduction.',
        'starter_code',E'name = ''Your name''\nage = 13\nprint(''Hello'', name)\nprint(''Age:'', age)',
        'hints',jsonb_build_array('Store your information in variables.','Use print() for each message.'),
        'challenge','Add a favourite subject and print it.',
        'reflection','What changes when you change a variable value.')),
    (1, 4, 'Guided Task: Build an Introduction', 'week-1-guided-introduction',
      array['Combine strings, numbers, and print']::text[],
      jsonb_build_object('goal','Build a complete introduction program.',
        'starter_code',E'first_name = ''Your name''\ncity = ''Your city''\nprint(first_name)\nprint(city)',
        'hints',jsonb_build_array('Create one variable for each piece of information.','Print each variable.'),
        'challenge','Add a sentence that combines two variables.',
        'reflection','Which values would a program need to remember.')),
    (1, 5, 'Week 1 Challenge: About Me', 'week-1-challenge-about-me',
      array['Build a small program independently']::text[],
      jsonb_build_object('goal','Create an About Me program with at least four variables.',
        'starter_code','',
        'hints',jsonb_build_array('Start with a name variable.','Add an age, school, and interest variable.'),
        'challenge','Make the output easy for another student to read.',
        'reflection','What did you have to debug.')),
    (2, 3, 'Practice: Comparisons', 'week-2-practice-comparisons',
      array['Use comparisons to produce True or False']::text[],
      jsonb_build_object('goal','Compare values and display the result.',
        'starter_code',E'score = 72\nprint(score >= 50)\nprint(score == 100)',
        'hints',jsonb_build_array('A comparison produces True or False.','Try >, <, and ==.'),
        'challenge','Compare two temperatures.',
        'reflection','Why is = different from ==.')),
    (2, 4, 'Guided Task: If and Else', 'week-2-guided-if-else',
      array['Write a two-branch decision']::text[],
      jsonb_build_object('goal','Build a pass-or-try-again checker.',
        'starter_code',E'score = 72\nif score >= 50:\n    print(''Pass'')\nelse:\n    print(''Try again'')',
        'hints',jsonb_build_array('Put the condition after if.','Indent the instructions inside each branch.'),
        'challenge','Add a message for scores of 80 or higher.',
        'reflection','What happens when the condition is false.')),
    (2, 5, 'Week 2 Challenge: Smart Advisor', 'week-2-challenge-advisor',
      array['Combine multiple conditions']::text[],
      jsonb_build_object('goal','Create a simple temperature or grade advisor.',
        'starter_code',E'temperature = 28\n\n# Decide what advice to print',
        'hints',jsonb_build_array('Choose two or three ranges.','Use if and elif before else.'),
        'challenge','Add a second condition using and.',
        'reflection','How did the order of conditions affect the result.')),
    (3, 3, 'Practice: For Loops', 'week-3-practice-for-loops',
      array['Repeat an instruction for each list item']::text[],
      jsonb_build_object('goal','Print every item in a list.',
        'starter_code',E'names = [''Ada'', ''Sam'', ''Musa'']\nfor name in names:\n    print(name)',
        'hints',jsonb_build_array('The loop variable represents one item.','Indent the repeated print.'),
        'challenge','Print a welcome message for each name.',
        'reflection','How many times did the loop run.')),
    (3, 4, 'Guided Task: Total and Average', 'week-3-guided-total-average',
      array['Use a loop to calculate a total']::text[],
      jsonb_build_object('goal','Calculate a total from a list of scores.',
        'starter_code',E'scores = [60, 75, 82]\ntotal = 0\n\nprint(total)',
        'hints',jsonb_build_array('Add each score to total.','Use total += score inside the loop.'),
        'challenge','Calculate and print the average.',
        'reflection','Why must total start at zero.')),
    (3, 5, 'Week 3 Challenge: Score Tracker', 'week-3-challenge-score-tracker',
      array['Combine lists, loops, and conditions']::text[],
      jsonb_build_object('goal','Build a score tracker that reports useful results.',
        'starter_code',E'scores = [45, 67, 88, 39, 72]\n\n# Process the scores',
        'hints',jsonb_build_array('Loop through scores.','Use an if statement to find passing scores.'),
        'challenge','Report the highest score without using max().',
        'reflection','Which part of the program was easiest to test.'))
) as modules(week_number, lesson_number, title, slug, objectives, content)
  on modules.week_number = weeks.week_number
where courses.slug = 'python-for-ai-machine-learning'
  and not exists (
    select 1 from public.academy_lessons existing
    where existing.week_id = weeks.id
      and existing.lesson_number = modules.lesson_number
  );

insert into public.academy_lessons (
  week_id, title, slug, lesson_number, objectives, content, published
)
select
  weeks.id,
  case lesson_numbers.lesson_number
    when 3 then 'Practice: ' || modules.topic
    when 4 then 'Guided Task: ' || modules.topic
    else 'Week ' || weeks.week_number || ' Challenge'
  end,
  'week-' || weeks.week_number || '-module-' || lesson_numbers.lesson_number,
  lesson_numbers.lesson_number,
  modules.objectives,
  jsonb_build_object(
    'goal', 'Practise ' || modules.topic || ' with a small working program.',
    'starter_code', modules.starter_code,
    'hints', jsonb_build_array(
      'Start with the smallest working version.',
      'Run the code after each small change.',
      'Read the error message carefully before changing more code.'
    ),
    'challenge', modules.challenge,
    'reflection', 'What did you test, change, and learn?'
  ),
  true
from public.academy_weeks weeks
join public.academy_courses courses on courses.id = weeks.course_id
cross join lateral generate_series(3, 5) as lesson_numbers(lesson_number)
cross join lateral (
  select
    case weeks.week_number
      when 4 then 'Functions'
      when 5 then 'Files and Errors'
      when 6 then 'Pandas Data'
      when 7 then 'Charts'
      when 8 then 'Features and Targets'
      when 9 then 'Model Predictions'
      when 10 then 'Experiments'
      else 'Project Planning'
    end as topic,
    case weeks.week_number
      when 4 then array['Define and call a reusable function']::text[]
      when 5 then array['Read data and handle a missing file']::text[]
      when 6 then array['Inspect rows and columns in a dataset']::text[]
      when 7 then array['Create and explain a chart']::text[]
      when 8 then array['Choose features and a target']::text[]
      when 9 then array['Train and test a first model']::text[]
      when 10 then array['Run and record a controlled experiment']::text[]
      else array['Plan a complete project workflow']::text[]
    end as objectives,
    case weeks.week_number
      when 4 then E'def greet(name):\n    return ''Hello, '' + name\n\nprint(greet(''Your name''))'
      when 5 then E'try:\n    with open(''notes.txt'') as file:\n        print(file.read())\nexcept FileNotFoundError:\n    print(''No file yet.'')'
      when 6 then E'data = {''score'': [7, 8, 10]}\nprint(data)'
      when 7 then E'values = [6, 8, 10]\nprint(values)'
      when 8 then E'features = [[1], [2], [4]]\ntarget = [7, 8, 10]\nprint(features, target)'
      when 9 then E'features = [[1], [2], [3]]\ntarget = [2, 4, 6]\nprint(''Ready to train'')'
      when 10 then E'experiment = ''Change one thing.''\nprint(experiment)'
      else E'question = ''What do I want to discover?''\nprint(question)'
    end,
    case weeks.week_number
      when 4 then 'Create a function that calculates an average.'
      when 5 then 'Save one note before reading it.'
      when 6 then 'Add a second column and describe it.'
      when 7 then 'Use a chart to communicate one pattern.'
      when 8 then 'Explain why your target is useful.'
      when 9 then 'Compare one prediction with its real value.'
      when 10 then 'Record one result and one limitation.'
      else 'Write a project question and success test.'
      end as starter_code,
      case lesson_numbers.lesson_number
        when 3 then 'Apply the week skill to a small guided task.'
        when 4 then 'Add one useful change and explain what it does.'
        else 'Build a small solution without copying the example.'
      end as challenge
) as modules
where courses.slug = 'python-for-ai-machine-learning'
  and weeks.week_number between 4 and 11
  and not exists (
    select 1 from public.academy_lessons existing
    where existing.week_id = weeks.id
      and existing.lesson_number = lesson_numbers.lesson_number
  );
