-- Add a second guided lesson and richer practice content for each Python week.
update public.academy_lessons lesson
set content = lesson.content || case weeks.week_number
  when 1 then '{"explanation":"A program is a precise set of instructions. Python lets you describe those instructions in a readable way.","examples":["name = ''Ada''\nage = 13\nprint(f''Hello, {name}!'')\nprint(f''Next year: {age + 1}'')"],"activities":["Change the name and age.","Add a variable for your favourite subject.","Rewrite the output as one sentence."],"starter_code":"name = ''Your name''\nage = 13\n\nprint(''Hello, '' + name)\nprint(''You are'', age, ''years old.'')"}'::jsonb
  when 2 then '{"explanation":"Conditions let a program choose what to do. Comparisons produce True or False, which an if statement can use.","examples":["score = 72\nif score >= 50:\n    print(''Pass'')\nelse:\n    print(''Try again'')"],"activities":["Test three different scores.","Add a distinction message for scores of 75 or more.","Use and to check two conditions."],"starter_code":"temperature = 28\n\nif temperature > 30:\n    print(''Fan on'')\nelse:\n    print(''Fan off'')"}'::jsonb
  when 3 then '{"explanation":"Loops repeat a useful instruction. Lists keep related values together so a program can process them one at a time.","examples":["scores = [60, 75, 82]\nfor score in scores:\n    print(score)"],"activities":["Add two more scores.","Calculate the total with a loop.","Print only scores greater than 70."],"starter_code":"scores = [60, 75, 82]\n\nfor score in scores:\n    print(''Score:'', score)"}'::jsonb
  when 4 then '{"explanation":"Functions give a name to a reusable idea. Dictionaries keep related labels and values together.","examples":["def greet(name):\n    return f''Hello, {name}''\n\nstudent = {''name'': ''Ada'', ''level'': 1}\nprint(greet(student[''name'']))"],"activities":["Add a second dictionary field.","Create a function that returns a total.","Call the function with two different values."],"starter_code":"def welcome(name):\n    return ''Welcome, '' + name\n\nstudent = {''name'': ''Your name'', ''level'': 1}\nprint(welcome(student[''name'']))"}'::jsonb
  when 5 then '{"explanation":"Files allow a program to keep information after it stops. Exceptions let us respond to problems instead of crashing without an explanation.","examples":["try:\n    with open(''scores.txt'') as file:\n        print(file.read())\nexcept FileNotFoundError:\n    print(''No scores file yet.'')"],"activities":["Create a text file and read it.","Handle a missing file.","Save one new score."],"starter_code":"try:\n    with open(''notes.txt'') as file:\n        print(file.read())\nexcept FileNotFoundError:\n    print(''Create notes.txt first.'')"}'::jsonb
  when 6 then '{"explanation":"A dataset is organised information. Before analysing it, inspect its rows, columns, features, and labels.","examples":["import pandas as pd\ndata = pd.DataFrame({''score'': [7, 8, 10]})\nprint(data.head())\nprint(data.describe())"],"activities":["Identify a possible feature and target.","Add a column to the DataFrame.","Print the column names."],"starter_code":"import pandas as pd\n\ndata = pd.DataFrame({\n    ''score'': [7, 8, 10],\n    ''practice_hours'': [1, 2, 4],\n})\nprint(data)"}'::jsonb
  when 7 then '{"explanation":"Charts help us notice patterns. NumPy and Pandas make it easier to calculate and compare values.","examples":["import matplotlib.pyplot as plt\nhours = [1, 2, 4]\nscores = [7, 8, 10]\nplt.plot(hours, scores)\nplt.show()"],"activities":["Change one value and observe the pattern.","Calculate the average score.","Add a chart title."],"starter_code":"import matplotlib.pyplot as plt\n\nhours = [1, 2, 4]\nscores = [7, 8, 10]\nplt.plot(hours, scores)\nplt.title(''Practice and scores'')\nplt.show()"}'::jsonb
  when 8 then '{"explanation":"Machine learning uses examples to learn a pattern. Features are inputs, and a target is the value we want to predict.","examples":["features = [[1], [2], [4]]\ntargets = [7, 8, 10]\nprint(''Features:'', features)\nprint(''Targets:'', targets)"],"activities":["Name two possible features for a school dataset.","Explain the difference between training and testing.","Describe one way a model can overfit."],"starter_code":"features = [[1], [2], [4]]\ntargets = [7, 8, 10]\n\nprint(''Features:'', features)\nprint(''Targets:'', targets)"}'::jsonb
  when 9 then '{"explanation":"A first model follows a repeatable workflow: choose data, split it, train, test, and make a prediction.","examples":["from sklearn.model_selection import train_test_split\nfrom sklearn.tree import DecisionTreeRegressor"],"activities":["Identify the feature and target.","Change the test size.","Compare a prediction with the real value."],"starter_code":"from sklearn.model_selection import train_test_split\nfrom sklearn.tree import DecisionTreeRegressor\n\nfeatures = [[1], [2], [4], [5]]\ntargets = [7, 8, 10, 11]\nmodel = DecisionTreeRegressor(random_state=1)\nmodel.fit(features, targets)\nprint(model.predict([[3]]))"}'::jsonb
  when 10 then '{"explanation":"Good engineers change one thing at a time, test it, and explain what changed.","activities":["Choose a new feature.","Try a different model setting.","Record one result and one limitation."],"starter_code":"data = {''hours'': [1, 2, 4, 5], ''scores'': [7, 8, 10, 11]}\n\nprint(''Start with a question about this data.'')"}'::jsonb
  when 11 then '{"explanation":"A final project combines the complete workflow: define a question, prepare data, train and test a model, then communicate the result.","activities":["Write your project question.","Name your features and target.","Plan how you will test the result.","Prepare a short demonstration."],"starter_code":"project_question = ''What would I like to predict?''\nfeatures = []\ntarget = []\n\nprint(project_question)"}'::jsonb
  else '{}'::jsonb
end
from public.academy_weeks weeks
where lesson.week_id = weeks.id
  and weeks.course_id = (select id from public.academy_courses where slug = 'python-for-ai-machine-learning')
  and lesson.lesson_number = 1;

insert into public.academy_lessons (
  week_id, title, slug, lesson_number, objectives, content, published
)
select
  weeks.id,
  sessions.title,
  sessions.slug,
  2,
  sessions.objectives,
  sessions.content::jsonb,
  true
from public.academy_weeks weeks
join public.academy_courses courses on courses.id = weeks.course_id
join (
  values
    (1, 'Session 2: Build Your First Python Program', 'week-1-session-2', array['Combine variables and output'], '{"goal":"Create a short personal introduction program.","starter_code":"name = ''Your name''\nage = 13\nprint(''Hello, '' + name)\nprint(''Next year you will be'', age + 1)"}'),
    (2, 'Session 2: Build a Decision Program', 'week-2-session-2', array['Combine comparisons and branches in a useful program'], '{"goal":"Create a program that makes a decision from a stored score.","starter_code":"score = 72\nif score >= 50:\n    print(''Pass'')\nelse:\n    print(''Try again'')"}'),
    (3, 'Session 2: Build a List Processor', 'week-3-session-2', array['Use a loop to process every item in a list'], '{"goal":"Write a program that summarises list data.","starter_code":"numbers = [3, 5, 8, 10]\ntotal = 0\nfor number in numbers:\n    total += number\nprint(total)"}'),
    (4, 'Session 2: Create Reusable Tools', 'week-4-session-2', array['Use a function and dictionary together'], '{"goal":"Create a reusable function for a student record.","starter_code":"def describe(student):\n    return student[''name''] + '' is learning '' + student[''subject'']\n\nstudent = {''name'': ''Ada'', ''subject'': ''Python''}\nprint(describe(student))"}'),
    (5, 'Session 2: Save and Recover Data', 'week-5-session-2', array['Save text and handle a missing file'], '{"goal":"Build a small file-based notes program.","starter_code":"try:\n    with open(''notes.txt'') as file:\n        print(file.read())\nexcept FileNotFoundError:\n    print(''No notes found yet.'')"}'),
    (6, 'Session 2: Inspect a Dataset', 'week-6-session-2', array['Inspect rows and columns with Pandas'], '{"goal":"Ask useful questions of a small dataset.","starter_code":"import pandas as pd\n\ndata = pd.DataFrame({''name'': [''Ada'', ''Sam''], ''score'': [8, 10]})\nprint(data.head())\nprint(data[''score''].mean())"}'),
    (7, 'Session 2: Tell a Story with a Chart', 'week-7-session-2', array['Create a chart that communicates a pattern'], '{"goal":"Use a chart to explain a dataset.","starter_code":"import matplotlib.pyplot as plt\n\nlabels = [''Week 1'', ''Week 2'', ''Week 3'']\nscores = [6, 8, 10]\nplt.bar(labels, scores)\nplt.show()"}'),
    (8, 'Session 2: Prepare Data for a Model', 'week-8-session-2', array['Choose features and a target for a model'], '{"goal":"Turn a real question into features and a target.","starter_code":"features = [[1], [2], [3]]\ntarget = [4, 6, 8]\nprint(features, target)"}'),
    (9, 'Session 2: Test a Prediction', 'week-9-session-2', array['Train a model and compare its prediction'], '{"goal":"Make and inspect a first prediction.","starter_code":"from sklearn.linear_model import LinearRegression\n\nmodel = LinearRegression()\nmodel.fit([[1], [2], [3]], [2, 4, 6])\nprint(model.predict([[4]]))"}'),
    (10, 'Session 2: Improve an Experiment', 'week-10-session-2', array['Run an experiment and record its result'], '{"goal":"Improve a model workflow one change at a time.","starter_code":"experiment = ''Change one feature or setting.''\nresult = ''Record what happened.''\nprint(experiment)\nprint(result)"}'),
    (11, 'Session 2: Present Your Project', 'week-11-session-2', array['Explain a project from question to result'], '{"goal":"Prepare a clear project demonstration.","starter_code":"print(''My question:'')\nprint(''My features:'')\nprint(''My result:'')"}')
) as sessions(week_number, title, slug, objectives, content)
  on sessions.week_number = weeks.week_number
where courses.slug = 'python-for-ai-machine-learning'
  and not exists (
    select 1 from public.academy_lessons existing
    where existing.week_id = weeks.id and existing.lesson_number = 2
  );
