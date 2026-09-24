-- Python course: add 3 fun, hands-on lessons to EVERY week (11 weeks).
-- New lesson_number per week: 6 = "Lab" (playground + starter code),
-- 7 = "Bug Hunt" (find and fix), 8 = "Mission" (creative build + reflection).
-- All published so students see them immediately. Idempotent: safe to re-run.
-- Each lesson is written to be playful and runnable in the in-browser Python
-- editor (pure Python only for data weeks, because the editor ships base Python).

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, published, sort_order)
select
  weeks.id,
  lab.title,
  lab.slug,
  lab.lesson_number,
  lab.objectives,
  lab.content::jsonb,
  true,
  lab.lesson_number
from public.academy_weeks weeks
join public.academy_courses course on course.id = weeks.course_id
join (
  values
    -- ---------------- WEEK 1: Starting to Code ----------------
    (1, 6, 'Week 1 Lab: Story Machine', 'week-1-lab-story-machine',
      array['Store your own data in variables', 'Print a story using variables', 'Build a program you can re-run with new values'],
      '{"goal":"Build a tiny story generator from your own variables.",
        "explanation":"Real programs separate the DATA from the STORY. You write the story once, then swap the data to make a brand-new story every time you run it.",
        "paragraphs":[
          "A program is just a list of exact steps. Variables are named boxes that hold your data: a name, a place, a favourite snack.",
          "The magic is reusability. Change what goes in the boxes and the same print() lines produce a totally different story. That is the whole idea behind every app you have ever used."
        ],
        "examples":["name = ''Ada''\ncity = ''Lagos''\nprint(name + '' lives in '' + city)","name = ''Musa''\nnext_year = int(input()) if False else 14\nprint(''Next year'' + name + '' will be'' )"],
        "activities":[
          "Create name, city, and hobby variables and print one sentence that uses all three.",
          "Change only the variables (not the print lines) and generate a second story.",
          "Add an age variable and print how old you will be next year using age + 1."
        ],
        "skills":["variables","print","string concatenation","reuse"],
        "starter_code":"name = ''Your name''\ncity = ''Your city''\nhobby = ''reading''\n\nprint(name + '' lives in '' + city)\nprint(name + '' loves '' + hobby)\nprint(''The end.'')",
        "project":"Story Machine",
        "hints":["Store each fact in its own variable first.","Print lines should read the variables, not hard-coded words.","Try changing just the three values at the top and re-run."],
        "challenge":"Add a second character and make a dialogue of at least four lines using only variables.",
        "reflection":"What stayed the same and what changed when you re-ran the story with new values?"}'),
    (1, 7, 'Week 1 Bug Hunt: The Runaway Print', 'week-1-bug-hunt-runaway-print',
      array['Read code and predict its output', 'Spot missing quotes and typos', 'Fix a broken program'],
      '{"goal":"Find and fix three sneaky bugs in a working program.",
        "explanation":"Bug hunting is a game: read the code, guess what it prints, then run it. When the real output differs from your guess, you have found a bug.",
        "paragraphs":[
          "The three classic beginner bugs are: a typo in a name, a missing quote, and a missing plus sign when joining text.",
          "Debugging is detective work, not magic. Read one line at a time and ask: is this exactly what I meant to write?"
        ],
        "examples":["# BUG 1: wrong variable name\nname = ''Ada''\nprint(nme)   # NameError\n\n# BUG 2: missing quote\nprint(''Hello)   # SyntaxError"],
        "activities":[
          "Run the starter code and list every error message you see.",
          "Fix each error one at a time, re-running after every fix.",
          "Introduce one new bug on purpose, then fix it."
        ],
        "skills":["debugging","reading errors","quotes","typos"],
        "starter_code":"# Three bugs hide here. Fix them all!\nnmae = ''Ada''\nprint(''Hello, '' + name\nprint(name, is 13)",
        "project":"Bug Hunt: Runaway Print",
        "hints":["Check every variable name against how it was spelled when created.","Count the quotes on each print line.","A print statement needs a closing parenthesis."],
        "challenge":"Write your own two-bug program and challenge a classmate to fix it.",
        "reflection":"Which bug was hardest to spot by eye, and how did the error message help you?"}'),
    (1, 8, 'Week 1 Mission: About Me Arcade Card', 'week-1-mission-about-me-arcade',
      array['Combine several variables into one program', 'Format output to look nice', 'Extend a program with new fields'],
      '{"goal":"Design a finished About Me card that prints like a game profile screen.",
        "explanation":"Missions are bigger builds. You plan the fields, code them, run it, then keep adding until it feels finished.",
        "paragraphs":[
          "Think like a designer: what fields would a player card show? Name, level, superpower, home base, and a tagline.",
          "Framing makes output readable. Use dashed lines, labels, and consistent spacing so your card looks designed, not dumped."
        ],
        "examples":["print(''================'')\nprint(''  PLAYER CARD '')\nprint(''================'')"],
        "activities":[
          "Choose five fields for your card and store each in a variable.",
          "Print a framed card with a title line and a line per field.",
          "Add a tagline that mixes two variables with your own text."
        ],
        "skills":["variables","print","formatting","design"],
        "starter_code":"# Build your player card\nname = ''Your name''\nlevel = 1\npower = ''curiosity''\n\nprint(''================'')\nprint(''  PLAYER CARD '')\nprint(''================'')\nprint(''Name : '' + name)",
        "project":"About Me Arcade Card",
        "hints":["Build the frame first, then add fields one at a time.","Use + to join a label and a variable.","Run after each new line so nothing breaks."],
        "challenge":"Add a stat bar like Level 5/10 using the repeat operator (name * 3) or a manual string of symbols.",
        "reflection":"What made your card feel like a real screen instead of a list of lines?"}'),

    -- ---------------- WEEK 2: Making Decisions ----------------
    (2, 6, 'Week 2 Lab: Rock, Paper, Scissors', 'week-2-lab-rock-paper-scissors',
      array['Compare two choices with ==', 'Branch on a decision', 'Use and / or to combine tests'],
      '{"goal":"Write a single-player Rock-Paper-Scissors judge.",
        "explanation":"A game judge is just decisions. Compare what the player picked with what the computer picked, then print the result.",
        "paragraphs":[
          "The core rule: a tie happens when both choices are equal. Otherwise one of a few fixed pairs wins (rock beats scissors, etc.).",
          "Start with the easiest branch (the tie) and add one case at a time. Testing one rule at a time keeps bugs tiny."
        ],
        "examples":["player = ''rock''\ncomputer = ''scissors''\n\nif player == computer:\n    print(''Tie!'')\nelif player == ''rock'' and computer == ''scissors'':\n    print(''You win!'')\nelse:\n    print(''Computer wins.'')"],
        "activities":[
          "Handle the tie case first and test it with two equal choices.",
          "Add rock beats scissors and test every pair.",
          "Add paper beats rock and scissors beats paper until every pair is covered."
        ],
        "skills":["==","if/elif/else","and","game logic"],
        "starter_code":"player = ''rock''\ncomputer = ''scissors''\n\n# 1) tie?\n# 2) rock beats scissors\n# 3) else computer wins\nif player == computer:\n    print(''Tie!'')\nelse:\n    print(''Computer wins.'')",
        "project":"Rock, Paper, Scissors",
        "hints":["Write the tie branch first.","Use == (two equals), not = .","Add elif branches one pair at a time and re-run."],
        "challenge":"Change computer to a different value and confirm all three outcomes (tie / you win / computer wins) actually print.",
        "reflection":"Why is it easier to add one decision rule at a time than to write them all at once?"}'),
    (2, 7, 'Week 2 Bug Hunt: Wrong Branch Order', 'week-2-bug-hunt-wrong-branch-order',
      array['Predict which branch runs', 'Fix a wrong comparison', 'Fix inverted logic'],
      '{"goal":"Debug a grade classifier that always prints the wrong level.",
        "explanation":"The first matching branch wins. If the easiest condition is tested first, harder conditions never run.",
        "paragraphs":[
          "Classic bugs: using = instead of ==, and putting a broad check before a narrow one (like checking >= 50 before >= 75).",
          "Trace by hand: pick a value, walk each condition, and see which branch you land in BEFORE running the code."
        ],
        "examples":["# wrong order\nscore = 88\nif score >= 50:\n    print(''Pass'')      # 88 matches here first!\nelif score >= 75:\n    print(''Distinction'')  # never reached"],
        "activities":[
          "Run the starter with score 88 and note what it wrongly prints.",
          "Swap the branch order so 75 is checked before 50.",
          "Re-test 88, 60, and 45 to prove all three print correctly."
        ],
        "skills":["branch order","== vs =","tracing"],
        "starter_code":"score = 88\n\nif score >= 50:\n    print(''Pass'')\nelif score >= 75:\n    print(''Distinction'')\nelse:\n    print(''Try again'')",
        "project":"Bug Hunt: Wrong Branch Order",
        "hints":["The first true condition wins.","Check the higher threshold first.","Test boundary values: 75 exactly and 50 exactly."],
        "challenge":"Find the second bug: the starter also compares with a single = somewhere. Fix it.",
        "reflection":"Why does branch order change the answer even when every condition is spelled correctly?"}'),
    (2, 8, 'Week 2 Mission: Fortune Teller', 'week-2-mission-fortune-teller',
      array['Branch on multiple inputs', 'Combine conditions with and / or', 'Make output feel personal'],
      '{"goal":"Build a fortune teller that reacts to a name and a lucky number.",
        "explanation":"A fortune teller reads inputs, decides, and responds. Use conditions to make different people get different fortunes.",
        "paragraphs":[
          "Decisions can depend on more than one thing: age AND mood, or number AND colour. Use and / or to join tests.",
          "Fun comes from variety. A handful of well-chosen branches makes the program feel alive."
        ],
        "examples":["name = ''Ada''\nlucky = 7\n\nif lucky == 7 and name != '''':\n    print(''A surprise is coming, '' + name)\nelse:\n    print(''Today is a good day to learn.'')"],
        "activities":[
          "Read a name and a lucky number into variables.",
          "Print at least three different fortunes using if / elif / else.",
          "Add one branch that uses and to check two conditions at once."
        ],
        "skills":["if/elif/else","and/or","input-style logic"],
        "starter_code":"name = ''Your name''\nlucky = 7\nmood = ''happy''\n\nif lucky == 7 and mood == ''happy'':\n    print(name + '', a big idea will find you today.'')\nelif mood == ''calm'':\n    print(''Slow and steady wins.'')\nelse:\n    print(''Keep learning. Your break is close.'')",
        "project":"Fortune Teller",
        "hints":["Three branches is plenty.","Combine tests with and.","Re-run with different values to see every fortune."],
        "challenge":"Add a four-way mood switch (happy / calm / tired / excited) that prints a matching fortune each.",
        "reflection":"Which of your fortunes would feel most surprising to a friend, and why?"}'),

    -- ---------------- WEEK 3: Repeating & Organizing Data ----------------
    (3, 6, 'Week 3 Lab: Guess My Number', 'week-3-lab-guess-my-number',
      array['Loop a fixed number of times', 'Compare a guess to a target', 'Count attempts'],
      '{"goal":"Build a number-guessing game loop you can play in the editor.",
        "explanation":"A guessing game needs a loop (keep asking) and a comparison (higher or lower).",
        "paragraphs":[
          "In the browser editor input() waits for typing, so we simulate guesses with a list you edit and loop over.",
          "Each guess gets a check: too high, too low, or correct. Counting attempts uses a variable that grows each loop."
        ],
        "examples":["target = 7\nguesses = [3, 8, 7]\n\nfor guess in guesses:\n    if guess < target:\n        print(guess, ''-> too low'')\nelif guess > target:\n        print(guess, ''-> too high'')\n    else:\n        print(guess, ''-> you got it!'')"],
        "activities":[
          "Change the guesses list and watch the hints change.",
          "Add a counter that prints how many guesses it took.",
          "Make the target something new and replay."
        ],
        "skills":["for loop","list","if/elif/else","counting"],
        "starter_code":"target = 7\nguesses = [3, 8, 7]\nattempts = 0\n\nfor guess in guesses:\n    attempts = attempts + 1\n    if guess < target:\n        print(guess, ''-> too low'')\n    elif guess > target:\n        print(guess, ''-> too high'')\n    else:\n        print(guess, ''-> correct in '' + str(attempts) + '' tries'')",
        "project":"Guess My Number",
        "hints":["Update attempts inside the loop.","Use elif for the middle case.","Print a final message after the loop ends."],
        "challenge":"Change the game so it stops printing hints after the correct guess is found.",
        "reflection":"What does the attempts variable teach you about remembering things across a loop?"}'),
    (3, 7, 'Week 3 Bug Hunt: The Infinite Loop', 'week-3-bug-hunt-infinite-loop',
      array['Spot an off-by-one error', 'Fix a loop that never ends', 'Use range() correctly'],
      '{"goal":"Fix a countdown that never ends and a loop that skips a number.",
        "explanation":"Two classic loop bugs: the counter never reaches its stop value (infinite), or it stops one early (off-by-one).",
        "paragraphs":[
          "If the counter is never updated inside a while loop, the condition stays true forever and the loop never stops.",
          "range(1, 5) stops at 4, not 5. If you wanted five items, you must go one higher."
        ],
        "examples":["# infinite: n never changes\nn = 5\nwhile n > 0:\n    print(n)\n\n# fixed\nn = 5\nwhile n > 0:\n    print(n)\n    n = n - 1"],
        "activities":[
          "Run the starter carefully (it has an infinite loop) and stop it.",
          "Add the missing counter update so it counts 5 to 1.",
          "Check range() end values and fix any skipped numbers."
        ],
        "skills":["while loop","off-by-one","range","updating counters"],
        "starter_code":"# BUG 1: this loop never stops. Fix it.\nn = 5\nwhile n > 0:\n    print(n)\n\n# BUG 2: this prints 1 to 4, we want 1 to 5\nfor i in range(1, 5):\n    print(i)",
        "project":"Bug Hunt: Infinite Loop",
        "hints":["Something inside the loop must change the condition variable.","range(1, 6) includes 5.","Run each fix separately."],
        "challenge":"Rewrite the while countdown using a for loop and range() to prove both can do the same job.",
        "reflection":"How did you know the loop was stuck without reading every printed line?"}'),
    (3, 8, 'Week 3 Mission: Class Score Arena', 'week-3-mission-class-score-arena',
      array['Process a whole list with a loop', 'Compute total, average, max and min', 'Report results clearly'],
      '{"goal":"Turn a list of scores into a full scoreboard with stats.",
        "explanation":"Loops plus lists let one small program process an entire class. Summarising is where data becomes information.",
        "paragraphs":[
          "You need four skills in one loop: total (add each), count (how many), max and min (track the extremes).",
          "The average is total / count. Presenting results with labels makes them readable at a glance."
        ],
        "examples":["scores = [62, 78, 91, 55, 84]\ntotal = 0\nfor s in scores:\n    total += s\nprint(''Average:'', total / len(scores))"],
        "activities":[
          "Loop once to compute the total and the count.",
          "Add average = total / count and print it with a label.",
          "Track the highest and lowest scores inside the same loop."
        ],
        "skills":["for loop","list","sum","average","max/min logic"],
        "starter_code":"scores = [62, 78, 91, 55, 84]\ntotal = 0\nbest = scores[0]\nworst = scores[0]\n\nfor s in scores:\n    total = total + s\n    if s > best:\n        best = s\n    if s < worst:\n        worst = s\n\nprint(''Average:'', total / len(scores))\nprint(''Best : '', best)\nprint(''Worst: '', worst)",
        "project":"Class Score Arena",
        "hints":["Start best and worst at scores[0], not 0.","Do all the counting in a single loop.","Print with labels so results are readable."],
        "challenge":"Print how many scores were 70 or above using a counter inside the loop.",
        "reflection":"Why must best start at scores[0] instead of 0 for a list of negative numbers?"}'),

    -- ---------------- WEEK 4: Reusable Code & Dictionaries ----------------
    (4, 6, 'Week 4 Lab: Superpower Functions', 'week-4-lab-superpower-functions',
      array['Define a function with a parameter', 'Return a value', 'Call a function many times'],
      '{"goal":"Write small functions that turn lines of code into reusable superpowers.",
        "explanation":"A function is a named recipe. Give it inputs (parameters), it does one job, and hands back a result (return).",
        "paragraphs":[
          "def starts a function. The indented lines are its body. return sends a value back to whoever called it.",
          "Reuse is the point: call greet(''Ada'') and greet(''Musa'') without rewriting the greeting logic."
        ],
        "examples":["def greet(name):\n    return ''Hello, '' + name + ''!''\n\nprint(greet(''Ada''))\nprint(greet(''Musa''))"],
        "activities":[
          "Write greet(name) and call it twice with different names.",
          "Write double(n) that returns n * 2 and test it.",
          "Call your functions from inside another print."
        ],
        "skills":["def","parameters","return","reuse"],
        "starter_code":"def greet(name):\n    return ''Hello, '' + name + ''!''\n\ndef double(n):\n    return n * 2\n\nprint(greet(''Your name''))\nprint(double(21))",
        "project":"Superpower Functions",
        "hints":["Remember the colon after def.","return gives a value back; print just shows it.","Change the argument to see different results."],
        "challenge":"Write a function is_even(n) that returns True or False, then print it for several numbers.",
        "reflection":"What did you save by writing the greeting once instead of copying print lines?"}'),
    (4, 7, 'Week 4 Bug Hunt: Missing Return', 'week-4-bug-hunt-missing-return',
      array['Spot a function that returns None', 'Fix a typo in a parameter', 'Trace values through a call'],
      '{"goal":"Fix a function that prints the right answer but returns nothing.",
        "explanation":"print() shows a value on screen. return() hands a value back to the caller. Forgetting return means the caller gets None.",
        "paragraphs":[
          "A function that computes an answer but only prints it cannot be reused in calculations — the caller gets None.",
          "Also watch parameter typos: calling with the wrong argument name raises a TypeError immediately."
        ],
        "examples":["def add(a, b):\n    print(a + b)   # returns None!\n\nresult = add(2, 3)\nprint(result + 1)  # TypeError"],
        "activities":[
          "Run the starter and read the error carefully.",
          "Change print() to return() inside the function.",
          "Re-run and confirm the arithmetic now works."
        ],
        "skills":["return vs print","None","parameters","tracing"],
        "starter_code":"def add(a, b):\n    print(a + b)\n\nresult = add(2, 3)\nprint(result * 10)",
        "project":"Bug Hunt: Missing Return",
        "hints":["The caller is trying to do math with the result.","print does not send a value back.","Swap print for return and re-run."],
        "challenge":"Write a second function multiply(a, b) that returns correctly on the first try.",
        "reflection":"Why does returning a value matter more than printing it when you build bigger programs?"}'),
    (4, 8, 'Week 4 Mission: Student Record Card', 'week-4-mission-student-record-card',
      array['Store labelled data in a dictionary', 'Read values by key', 'Combine a function and a dictionary'],
      '{"goal":"Build a student record with a dictionary and display it with a function.",
        "explanation":"A dictionary holds labelled data: each value has a key (name, grade, city). It is how programs store a real record.",
        "paragraphs":[
          "Lists are ordered by position; dictionaries are found by label. A student card is naturally key-value pairs.",
          "Wrap the display in a function so you can render any student record with one call."
        ],
        "examples":["student = {''name'': ''Ada'', ''level'': 3, ''city'': ''Lagos''}\nprint(student[''name''])\nprint(student.get(''missing'', ''n/a''))"],
        "activities":[
          "Create a dictionary with name, level, and city keys.",
          "Print two fields using square-bracket access.",
          "Wrap the printing in a function that takes the record as a parameter."
        ],
        "skills":["dictionaries","keys","get","functions"],
        "starter_code":"def show(student):\n    print(''Name : '', student[''name''])\n    print(''Level: '', student[''level''])\n    print(''City : '', student[''city''])\n\nstudent = {''name'': ''Your name'', ''level'': 1, ''city'': ''Your city''}\nshow(student)",
        "project":"Student Record Card",
        "hints":["Keys are strings in quotes.","Use student[''key''] to read a field.","Call the function with your dictionary."],
        "challenge":"Add a grades list inside the record and print the number of subjects with len().",
        "reflection":"When would a labelled record beat a plain list of values?"}'),

    -- ---------------- WEEK 5: Files & Errors ----------------
    (5, 6, 'Week 5 Lab: Save & Load High Scores', 'week-5-lab-save-load-high-scores',
      array['Write text to a file', 'Read a file back', 'Handle a missing file gracefully'],
      '{"goal":"Save a high score to a file and load it back safely.",
        "explanation":"Files let a program remember things after it stops running. try/except keeps a missing file from crashing you.",
        "paragraphs":[
          "with open(path, ''w'') writes (overwrites), and ''r'' reads. The with block closes the file for you automatically.",
          "The most common case: the file does not exist yet. Catch FileNotFoundError and start from a default instead of crashing."
        ],
        "examples":["try:\n    with open(''score.txt'') as f:\n        best = int(f.read())\nexcept FileNotFoundError:\n    best = 0"],
        "activities":[
          "Write a score to a file with mode ''w''.",
          "Read it back and print it as an integer.",
          "Handle the missing-file case with try/except."
        ],
        "skills":["open","read","write","try/except"],
        "starter_code":"best = 120\n\n# save\nwith open(''score.txt'', ''w'') as f:\n    f.write(str(best))\n\n# load, with a safe default\ntry:\n    with open(''score.txt'') as f:\n        loaded = int(f.read())\nexcept FileNotFoundError:\n    loaded = 0\n\nprint(''Loaded score:'', loaded)",
        "project":"Save & Load High Scores",
        "hints":["Convert numbers to text with str() before writing.","Convert back with int() after reading.","Test the missing-file path by deleting the file."],
        "challenge":"Beat your saved score in code (add points) and only write the file if the new score is higher.",
        "reflection":"Why is handling a missing file not an edge case but a normal everyday case?"}'),
    (5, 7, 'Week 5 Bug Hunt: Unclosed File & Bad int', 'week-5-bug-hunt-unclosed-file',
      array['Fix a file handle left open', 'Handle a ValueError from int()', 'Choose the right except type'],
      '{"goal":"Fix a program that crashes when the file is empty.",
        "explanation":"int('''') raises ValueError, not FileNotFoundError. Catching only one error type lets the other slip through.",
        "paragraphs":[
          "Two bugs hide here: a file opened without with (never closed) and an int() conversion that fails on empty text.",
          "Catch the errors you actually expect: FileNotFoundError for a missing file, ValueError for bad text."
        ],
        "examples":["# crash on empty file\nvalue = int('''')   # ValueError"],
        "activities":[
          "Run the starter with an empty score.txt and read the error.",
          "Wrap the conversion in try/except ValueError.",
          "Use with so the file always closes."
        ],
        "skills":["with","ValueError","multiple except types"],
        "starter_code":"# BUG: empty file crashes int()\ntry:\n    f = open(''score.txt'')\n    best = int(f.read())\nexcept FileNotFoundError:\n    best = 0\n\nprint(''Best:'', best)",
        "project":"Bug Hunt: Unclosed File",
        "hints":["Read the error name — is it FileNotFoundError or ValueError?","Add a second except clause for ValueError.","Use with open(...) as f: so the file closes itself."],
        "challenge":"Make the loader accept ''no score yet'' as 0 instead of crashing, and prove it with an empty file.",
        "reflection":"Why should you catch the specific error you expect rather than every possible error?"}'),
    (5, 8, 'Week 5 Mission: Mini Diary App', 'week-5-mission-mini-diary-app',
      array['Append lines to a file', 'Read and display saved entries', 'Add basic input validation'],
      '{"goal":"Build a diary that saves entries and shows them back on demand.",
        "explanation":"Append mode (''a'') adds to the end of a file without erasing what is there — exactly what a diary needs.",
        "paragraphs":[
          "Mode ''w'' wipes the file; mode ''a'' keeps history. Choosing the right mode is a design decision, not a detail.",
          "A small menu (1 = write, 2 = read, 3 = quit) makes a tiny program feel like a real app."
        ],
        "examples":["with open(''diary.txt'', ''a'') as f:\n    f.write(''Day 1: learned files\\n'')"],
        "activities":[
          "Append one entry with mode ''a'' and confirm old entries survive.",
          "Read the whole file and print it line by line.",
          "Wrap write/read/quit in a simple menu choice."
        ],
        "skills":["append mode","read all lines","menus","validation"],
        "starter_code":"entries = [''Day 1: learned to save files'', ''Day 2: built a diary'']\n\n# append every entry\nwith open(''diary.txt'', ''a'') as f:\n    for entry in entries:\n        f.write(entry + ''\\n'')\n\n# read them back\ntry:\n    with open(''diary.txt'') as f:\n        print(f.read())\nexcept FileNotFoundError:\n    print(''No diary yet.'')",
        "project":"Mini Diary App",
        "hints":["Use ''a'' not ''w'' to keep history.","Write a newline after each entry.","Handle the first run when the file does not exist."],
        "challenge":"Add a word count per entry and refuse to save empty entries with a friendly message.",
        "reflection":"What happens to your diary if you accidentally use mode w instead of a?"}'),

    -- ---------------- WEEK 6: Meet Your Data ----------------
    (6, 6, 'Week 6 Lab: Class Survey in Pure Python', 'week-6-lab-class-survey-pure-python',
      array['Represent rows as records', 'Filter rows by a condition', 'Compute simple counts'],
      '{"goal":"Build a tiny survey dataset with plain Python and ask it questions.",
        "explanation":"A dataset is just rows of records. Before pandas, learn the shape of data with lists of dictionaries you can see in one screen.",
        "paragraphs":[
          "Each record is one person: a dictionary with keys like name, hours, and score. A list of records is your table.",
          "Questions become filters: how many rows match? Loop once, count the matches, and you have queried your data."
        ],
        "examples":["rows = [{''name'':''Ada'',''hours'':3},{''name'':''Sam'',''hours'':1}]\ncount = 0\nfor r in rows:\n    if r[''hours''] >= 2:\n        count += 1\nprint(count)"],
        "activities":[
          "Create five records with name and hours keys.",
          "Count how many students practised 2 or more hours.",
          "Print the name of each student who practised a lot."
        ],
        "skills":["records","list of dicts","filtering","counting"],
        "starter_code":"survey = [\n    {''name'': ''Ada'',  ''hours'': 3},\n    {''name'': ''Sam'',  ''hours'': 1},\n    {''name'': ''Musa'', ''hours'': 4},\n    {''name'': ''Zoe'',  ''hours'': 2},\n]\n\ncount = 0\nfor row in survey:\n    if row[''hours''] >= 2:\n        count += 1\n\nprint(''Studied 2+ hours:'' , count)",
        "project":"Class Survey in Pure Python",
        "hints":["Each row is a dictionary, so use row[''key''].","Counting is a variable that grows inside the loop.","Try changing the threshold from 2 to 3 and re-run."],
        "challenge":"Find the student with the most hours by tracking a best-so-far record inside the loop.",
        "reflection":"What does one row of your survey represent in the real world?"}'),
    (6, 7, 'Week 6 Bug Hunt: Wrong Key & Shallow Copy', 'week-6-bug-hunt-wrong-key',
      array['Fix a KeyError', 'Avoid counting the header row', 'Trace a loop over records'],
      '{"goal":"Debug a survey reader that crashes on a missing key.",
        "explanation":"row[''hours''] raises KeyError if one record used a different key. Real data is messy; code must cope.",
        "paragraphs":[
          "A single record with the key ''hour'' instead of ''hours'' breaks the whole loop — a classic data-quality bug.",
          "Reading the traceback line number points straight at the offending key. Trust it."
        ],
        "examples":["row = {''name'':''Ada'',''hour'':3}\nprint(row[''hours''])   # KeyError"],
        "activities":[
          "Run the starter and read which key it says is missing.",
          "Find the record with the wrong key and fix it (or use .get()).",
          "Re-run until the count is correct."
        ],
        "skills":["KeyError",".get()","data cleaning","traceback"],
        "starter_code":"survey = [\n    {''name'': ''Ada'',  ''hours'': 3},\n    {''name'': ''Sam'',  ''hour'':  1},   # wrong key!\n    {''name'': ''Musa'', ''hours'': 4},\n]\n\ncount = 0\nfor row in survey:\n    if row[''hours''] >= 2:\n        count += 1\nprint(count)",
        "project":"Bug Hunt: Wrong Key",
        "hints":["One record does not match the others.","You can fix the data, or make the code tolerant with .get(''hours'', 0).","Read the KeyError message; it names the missing key."],
        "challenge":"Use .get() with a default so one messy record no longer crashes the whole report.",
        "reflection":"Is it better to clean the data or make the code defensive? When would you choose each?"}'),
    (6, 8, 'Week 6 Mission: Dataset Health Check', 'week-6-mission-dataset-health-check',
      array['Find missing values', 'Report simple statistics', 'Summarise data for a human'],
      '{"goal":"Write a health-check report for a small dataset before analysing it.",
        "explanation":"Good data work starts by checking the data: missing values, ranges, and obvious mistakes.",
        "paragraphs":[
          "A health check counts rows, checks for blanks, and finds min/max. It takes one loop and saves hours of confusion later.",
          "Present findings as a short labelled report — that is what a real analyst hands over first."
        ],
        "examples":["missing = sum(1 for r in rows if r.get(''hours'') in (None, ''))\nprint(''Missing hours:'', missing)"],
        "activities":[
          "Count total rows and any rows with a missing hours value.",
          "Compute the min and max of the hours column.",
          "Print a three-line labelled health report."
        ],
        "skills":["missing values","min/max","reporting","data quality"],
        "starter_code":"survey = [\n    {''name'': ''Ada'',  ''hours'': 3},\n    {''name'': ''Sam'',  ''hours'': None},\n    {''name'': ''Musa'', ''hours'': 4},\n    {''name'': ''Zoe'',  ''hours'': 2},\n]\n\nmissing = 0\nfor row in survey:\n    if row[''hours''] is None:\n        missing = missing + 1\n\nprint(''Rows     :'', len(survey))\nprint(''Missing  :'', missing)",
        "project":"Dataset Health Check",
        "hints":["Treat None as missing.","Count valid values separately from missing ones.","Label every line of the report."],
        "challenge":"Print the average of the non-missing hours values, skipping the None rows.",
        "reflection":"Why does checking the data first prevent much bigger mistakes later?"}'),

    -- ---------------- WEEK 7: Exploring Data ----------------
    (7, 6, 'Week 7 Lab: Build Your Own Chart (Text)', 'week-7-lab-build-your-own-chart-text',
      array['Compute an average in pure Python', 'Render a simple bar chart with text', 'Compare categories'],
      '{"goal":"Draw a bar chart using nothing but text characters.",
        "explanation":"A chart is just numbers turned into lengths. Before Matplotlib, build one by hand so you understand what charts really do.",
        "paragraphs":[
          "Pick a scale, then repeat a character proportionally: score of 8 becomes eight blocks. That is a bar chart.",
          "Text charts are honest and instant — great for checking a pattern before reaching for a library."
        ],
        "examples":["for name, v in [(''Mon'',3),(''Tue'',6)]:\n    print(name, ''#'' * v)"],
        "activities":[
          "Store days and values in two lists (or a list of pairs).",
          "Loop and print a bar of # characters for each value.",
          "Add a title line and a label per bar."
        ],
        "skills":["averages","scaling","text charts","loops"],
        "starter_code":"days  = [''Mon'', ''Tue'', ''Wed'', ''Thu'']\nscore = [3, 6, 4, 8]\n\nprint(''=== Scores this week ==='')\nfor day, value in zip(days, score):\n    bar = ''#'' * value\n    print(day, bar)",
        "project":"Build Your Own Chart (Text)",
        "hints":["* on a string repeats it.","zip() walks two lists together.","Print a title first so the chart has context."],
        "challenge":"Scale each bar to 20 characters wide using a simple max-based rule so big values fill the line.",
        "reflection":"What can you see in the text chart that a plain list of numbers hid from you?"}'),
    (7, 7, 'Week 7 Bug Hunt: Divide by Zero & Bad Average', 'week-7-bug-hunt-divide-by-zero',
      array['Fix a ZeroDivisionError', 'Guard against an empty list', 'Validate before computing'],
      '{"goal":"Stop the average function from crashing on an empty list.",
        "explanation":"total / count crashes when count is 0. Real code checks its assumptions before dividing.",
        "paragraphs":[
          "An empty dataset is normal (a brand-new class with no scores yet), so it must be handled, not feared.",
          "The fix: if the list is empty, return a safe default instead of dividing."
        ],
        "examples":["def average(values):\n    if not values:\n        return 0\n    return sum(values) / len(values)"],
        "activities":[
          "Run the starter with an empty list and read the error.",
          "Add an early return for the empty case.",
          "Test with one value and many values."
        ],
        "skills":["ZeroDivisionError","guard clauses","edge cases","functions"],
        "starter_code":"def average(values):\n    total = 0\n    for v in values:\n        total = total + v\n    return total / len(values)   # crashes if empty\n\nprint(average([4, 6, 8]))\nprint(average([]))",
        "project":"Bug Hunt: Divide by Zero",
        "hints":["Check the list length before dividing.","An early return handles the empty case in one line.","Empty lists are normal, not exceptional."],
        "challenge":"Make average() return None for an empty list, then have the caller print a friendly message instead.",
        "reflection":"Why is an empty list an everyday case for data code rather than a rare error?"}'),
    (7, 8, 'Week 7 Mission: Sports Stats Dashboard', 'week-7-mission-sports-stats-dashboard',
      array['Compute per-category statistics', 'Sort results', 'Present a ranked report'],
      '{"goal":"Turn a season of results into a ranked stats dashboard.",
        "explanation":"Real dashboards combine three skills: group by category, compute a stat, then sort and present.",
        "paragraphs":[
          "Aggregate (total per team), then rank (sort), then display (labelled table). This is the shape of most analytics jobs.",
          "Sorting your own list teaches you what a library sort is doing for you under the hood."
        ],
        "examples":["stats = {''Lions'': 12, ''Tigers'': 9}\nranked = sorted(stats.items(), key=lambda kv: kv[1], reverse=True)\nfor team, pts in ranked:\n    print(team, pts)"],
        "activities":[
          "Aggregate points per team from a list of results.",
          "Sort teams by points, highest first.",
          "Print a numbered leaderboard with labels."
        ],
        "skills":["aggregation","sorted","lambda","reporting"],
        "starter_code":"results = [\n    (''Lions'', 3), (''Tigers'', 1),\n    (''Lions'', 2), (''Tigers'', 3),\n    (''Sharks'', 3),\n]\n\nstats = {}\nfor team, points in results:\n    stats[team] = stats.get(team, 0) + points\n\nranked = sorted(stats.items(), key=lambda kv: kv[1], reverse=True)\nfor i, (team, pts) in enumerate(ranked, start=1):\n    print(str(i) + ''. ''. + team + '': '' + str(pts))",
        "project":"Sports Stats Dashboard",
        "hints":["dict.get(key, 0) gives a safe starting total.","sorted(..., reverse=True) sorts highest first.","enumerate(..., start=1) gives you rank numbers."],
        "challenge":"Add the number of games each team played and print their average points per game.",
        "reflection":"Which step — aggregate, sort, or display — would break the whole report if it were wrong?"}'),

    -- ---------------- WEEK 8: What Is AI / ML ----------------
    (8, 6, 'Week 8 Lab: Human as a Model Game', 'week-8-lab-human-as-a-model-game',
      array['Explain features and a target', 'Play a guessing game to feel training', 'Describe a rule you discovered'],
      '{"goal":"Discover a hidden rule by guessing — you become the machine learning model.",
        "explanation":"Before code, feel what learning means: look at examples (features), guess the answer (target), get feedback, and adjust your rule.",
        "paragraphs":[
          "The teacher holds a secret rule (like ''only names with 4 letters''). You see examples with answers and refine your guess.",
          "That refine-from-feedback loop IS machine learning. A model does exactly this, just with math instead of intuition."
        ],
        "examples":["examples = [(''Ada'', True), (''Sam'', False), (''Zoe'', True)]\n# your rule: names with 3 letters are True\nfor name, label in examples:\n    print(name, ''guess:'', len(name) == 3, ''actual:'', label)"],
        "activities":[
          "Look at the examples list and write your best guess rule.",
          "Code your rule as a condition and compare against the actual labels.",
          "Count how many your rule got right."
        ],
        "skills":["features","target","rule","accuracy intuition"],
        "starter_code":"examples = [\n    (''Ada'',  True),\n    (''Sam'',  False),\n    (''Zoe'',  True),\n    (''Musa'', False),\n]\n\ndef my_rule(name):\n    return len(name) == 3   # your guess\n\ncorrect = 0\nfor name, actual in examples:\n    guess = my_rule(name)\n    print(name, ''guess:'', guess, ''actual:'', actual)\n    if guess == actual:\n        correct = correct + 1\n\nprint(''Accuracy:'', str(correct) + ''/'' + str(len(examples)))",
        "project":"Human as a Model Game",
        "hints":["features are what you look at (the name); the target is True/False.","Change the rule and watch accuracy change.","Accuracy = correct / total."],
        "challenge":"Find a rule that scores 4/4, then explain in one sentence why guessing a rule that fits the examples does not guarantee it generalises.",
        "reflection":"What is the difference between memorising the answers and learning a rule?"}'),
    (8, 7, 'Week 8 Bug Hunt: Leakage & Wrong Target', 'week-8-bug-hunt-leakage-wrong-target',
      array['Spot a feature that leaks the answer', 'Name the target correctly', 'Explain overfitting in plain words'],
      '{"goal":"Find the cheating feature that makes accuracy look too good.",
        "explanation":"If a feature is really the answer in disguise, your model is cheating — this is data leakage.",
        "paragraphs":[
          "Example: predicting ''passed'' using a feature called final_grade. The answer is already inside the input.",
          "Another bug: training on the wrong target column. Both make results meaningless even when the code runs perfectly."
        ],
        "examples":["# leakage: answer is in the input\nrow = {''name'': ''Ada'', ''passed'': True, ''final_mark'': 95}\nif row[''final_mark''] >= 50:\n    print(row[''passed''])  # trivially always right"],
        "activities":[
          "Read the starter and find which feature gives the answer away.",
          "Remove the leaking feature and re-run.",
          "State the correct target column in one sentence."
        ],
        "skills":["data leakage","target selection","critical thinking"],
        "starter_code":"rows = [\n    {''hours'': 1, ''final_mark'': 45, ''passed'': False},\n    {''hours'': 4, ''final_mark'': 88, ''passed'': True},\n]\n\n# BUG: this feature already contains the answer\ndef predict(row):\n    return row[''final_mark''] >= 50\n\ncorrect = 0\nfor row in rows:\n    if predict(row) == row[''passed'']:\n        correct = correct + 1\nprint(''Accuracy:'', correct, ''/'', len(rows))",
        "project":"Bug Hunt: Leakage & Wrong Target",
        "hints":["Which feature would a teacher already know the answer from?","A feature equal to the target is cheating.","Try predicting from hours only and compare."],
        "challenge":"Rewrite predict() to use only ''hours'' and see the (honest, lower) accuracy. Which result would you trust?",
        "reflection":"Why can 100% accuracy be a red flag instead of a triumph?"}'),
    (8, 8, 'Week 8 Mission: Build a Rule-Based Classifier', 'week-8-mission-rule-based-classifier',
      array['Write your own predict() function', 'Evaluate it against known labels', 'Explain its limits honestly'],
      '{"goal":"Write a classic (non-learning) classifier and measure it fairly.",
        "explanation":"Traditional programming = you write the rules. Machine learning = the data suggests the rules. Build the first kind to compare.",
        "paragraphs":[
          "You will hand-write a predict() function, run it over labelled examples, and score accuracy.",
          "Then you will name one case it gets wrong — the honest bit that separates engineers from hype."
        ],
        "examples":["def predict(hours):\n    return hours >= 3\n\nfor hours, actual in data:\n    print(hours, predict(hours), actual)"],
        "activities":[
          "Write predict() using a threshold you choose.",
          "Loop over the data and count correct predictions.",
          "List one example your rule gets wrong and why."
        ],
        "skills":["predict function","accuracy","thresholds","evaluation"],
        "starter_code":"data = [\n    (1, False), (2, False), (3, True),\n    (4, True),  (5, True),\n]\n\ndef predict(hours):\n    return hours >= 3   # your rule\n\ncorrect = 0\nfor hours, actual in data:\n    if predict(hours) == actual:\n        correct = correct + 1\n\nprint(''Accuracy:'', str(correct) + ''/'' + str(len(data)))",
        "project":"Build a Rule-Based Classifier",
        "hints":["Pick a threshold and test it.","Accuracy = correct / total.","Write down one failure — that is your next improvement."],
        "challenge":"Move the threshold one step left or right and record accuracy each time. Which threshold is best and why?",
        "reflection":"In your own words, what is the difference between programming rules and learning rules?"}'),

    -- ---------------- WEEK 9: Your First Model ----------------
    (9, 6, 'Week 9 Lab: Train/Test Split by Hand', 'week-9-lab-train-test-split-by-hand',
      array['Split data into train and test', 'Fit a simple model by hand', 'Measure accuracy on unseen rows'],
      '{"goal":"Do the train/test split yourself so you never forget why it exists.",
        "explanation":"You hide part of the data from the model, train on the rest, then test on the hidden part. That is how you get an honest score.",
        "paragraphs":[
          "If you test on data the model already saw, the score is fake. The held-out rows are your exam paper.",
          "In Week 9 you will use scikit-learn''s train_test_split; this lab builds the same idea with plain Python first."
        ],
        "examples":["data = [1,2,3,4,5]\nmid = len(data)//2\ntrain, test = data[:mid], data[mid:]\nprint(train, test)"],
        "activities":[
          "Split a list of rows into train and test with slicing.",
          "Learn a threshold from the TRAIN rows only.",
          "Score the model on the held-out TEST rows."
        ],
        "skills":["train/test split","slicing","fit vs predict","honest evaluation"],
        "starter_code":"data = [\n    (1, False), (2, False), (3, True),\n    (4, True),  (5, True),  (6, True),\n]\n\nmid = 4\ntrain = data[:mid]\ntest  = data[mid:]\n\n# learn threshold from TRAIN only\nthreshold = 3\n\ncorrect = 0\nfor hours, actual in test:\n    if (hours >= threshold) == actual:\n        correct = correct + 1\n\nprint(''Train rows:'', len(train), '' Test rows:'', len(test))\nprint(''Test accuracy:'', correct, ''/'', len(test))",
        "project":"Train/Test Split by Hand",
        "hints":["Learn from train, evaluate on test — never mix.","Use list slicing [:mid] and [mid:].","A tiny test set gives a noisy score; that is a real lesson."],
        "challenge":"Try two thresholds (2 and 4) and see which scores better on the SAME test rows. Is that comparison itself fair?",
        "reflection":"Why does scoring on data the model trained on always flatter the model?"}'),
    (9, 7, 'Week 9 Bug Hunt: Fit on Test Data', 'week-9-bug-hunt-fit-on-test-data',
      array['Spot a model fitted on test data', 'Fix the split order', 'Explain why the score was fake'],
      '{"goal":"Catch a workflow that trains and tests on the same rows.",
        "explanation":"fit() must see only training rows. Calling fit() on everything, then scoring on everything, leaks the answers.",
        "paragraphs":[
          "The bug is subtle: the code runs and accuracy looks amazing (often 100%). Suspiciously perfect scores are a smell.",
          "The fix is order: split first, fit on train, predict on test."
        ],
        "examples":["# wrong\nmodel.fit(all_X, all_y)\nscore = accuracy(model.predict(all_X), all_y)  # fake"],
        "activities":[
          "Read the starter and find where fit() is called on all data.",
          "Split first, then fit only on the training rows.",
          "Compare the honest test score before and after the fix."
        ],
        "skills":["fit vs predict leakage","split order","skeptical evaluation"],
        "starter_code":"X = [1, 2, 3, 4, 5, 6]\ny = [0, 0, 1, 1, 1, 1]\n\n# BUG: model sees the test data during training\ndef fit_and_score(X, y):\n    threshold = 3\n    correct = 0\n    for value, actual in zip(X, y):\n        if (value >= threshold) == actual:\n            correct = correct + 1\n    return correct / len(X)\n\nprint(''Accuracy:'', fit_and_score(X, y))",
        "project":"Bug Hunt: Fit on Test Data",
        "hints":["Where does the model get to see the answers?","Split before you learn anything.","A 100% score should make you suspicious, not proud."],
        "challenge":"Restructure so you fit on the first four rows and score on the last two. Report the honest number.",
        "reflection":"How would you explain data leakage to a younger student in one sentence?"}'),
    (9, 8, 'Week 9 Mission: First Classifier Report', 'week-9-mission-first-classifier-report',
      array['Train a real model workflow', 'Report accuracy honestly', 'Write a one-paragraph conclusion'],
      '{"goal":"Produce a complete mini report: data, split, score, and a plain-English conclusion.",
        "explanation":"An ML result is not the model — it is the data, the split, the score, and what the score actually means.",
        "paragraphs":[
          "Your report has four parts: what the data is, how you split it, what accuracy you got, and one honest limitation.",
          "This mirrors how the C++ course logs debug results and how real ML cards are written."
        ],
        "examples":["report = {\n  ''rows'': 6, ''train'': 4, ''test'': 2,\n  ''accuracy'': 0.5,\n  ''limitation'': ''very small test set''\n}"],
        "activities":[
          "Record rows, train size, and test size.",
          "Compute and record the test accuracy.",
          "Write one limitation sentence (small data, noisy test, etc.)."
        ],
        "skills":["evaluation report","accuracy","limitations","communication"],
        "starter_code":"train = [(1, 0), (2, 0), (3, 1), (4, 1)]\ntest  = [(5, 1), (6, 1)]\nthreshold = 3\n\ncorrect = 0\nfor hours, actual in test:\n    if (hours >= threshold) == actual:\n        correct = correct + 1\naccuracy = correct / len(test)\n\nprint(''--- Model report ---'')\nprint(''Train rows :'', len(train))\nprint(''Test rows  :'', len(test))\nprint(''Accuracy   :'', accuracy)\nprint(''Limitation : only 2 test rows, so the score jumps around'')",
        "project":"First Classifier Report",
        "hints":["Print a labelled, structured report.","Say the limitation out loud — honesty is part of the grade.","Keep the threshold learned from train, not test."],
        "challenge":"Halve your test set and see how much the accuracy swings. Write one sentence on why bigger test sets matter.",
        "reflection":"What does your accuracy number NOT tell you about the real world?"}'),

    -- ---------------- WEEK 10: Build With Less Help ----------------
    (10, 6, 'Week 10 Lab: Choose Your Features', 'week-10-lab-choose-your-features',
      array['Pick features for a target', 'Compare two feature sets', 'Justify your choice in words'],
      '{"goal":"Experiment with which inputs best predict a target, on purpose.",
        "explanation":"Feature choice IS the modelling decision. Better inputs beat clever algorithms almost every time.",
        "paragraphs":[
          "Run the same simple model with one feature, then with two, and compare honest test scores.",
          "Record what you changed — one change per run — so you know what caused the difference."
        ],
        "examples":["# feature set A: hours only\n# feature set B: hours + sleep\n# same model, same test rows, compare scores"],
        "activities":[
          "Build a small dataset with two candidate features.",
          "Score a model using feature A only, then A + B.",
          "Write one sentence on which set you would ship and why."
        ],
        "skills":["feature selection","controlled experiment","comparison"],
        "starter_code":"rows = [\n    # hours, sleep, passed\n    (1, 4, 0), (2, 5, 0), (3, 7, 1),\n    (4, 7, 1), (5, 8, 1), (2, 6, 0),\n]\n\ndef score_with(features_index):\n    threshold = 3\n    correct = 0\n    for row in rows:\n        value = row[features_index]\n        actual = row[2]\n        if (value >= threshold) == actual:\n            correct = correct + 1\n    return correct / len(rows)\n\nprint(''hours only :'', score_with(0))\nprint(''sleep only :'', score_with(1))",
        "project":"Choose Your Features",
        "hints":["Keep the model identical; change only the feature.","One change per experiment.","Explain the winner in plain words."],
        "challenge":"Add a deliberately useless feature (row index) and confirm it does not help. That is feature sanity-checking.",
        "reflection":"How did you keep the experiment fair when you compared two feature sets?"}'),
    (10, 7, 'Week 10 Bug Hunt: Overfitting by Memory', 'week-10-bug-hunt-overfitting-by-memory',
      array['Recognise a model that memorises', 'Test on unseen rows', 'Explain overfitting simply'],
      '{"goal":"Expose a model that just memorises the training rows and fails on new ones.",
        "explanation":"Overfitting = brilliant on data you have seen, useless on data you have not. It memorises instead of learning a pattern.",
        "paragraphs":[
          "The starter model stores every training answer in a lookup table. Score it on training rows (perfect) and test rows (awful).",
          "This gap between train score and test score is the classic overfitting tell."
        ],
        "examples":["model = {1:0, 2:0, 3:1, 4:1}\nprint(model.get(3))     # perfect\nprint(model.get(9))     # None = fails on new"],
        "activities":[
          "Score the memoriser on the training rows (expect perfect).",
          "Score the same model on fresh rows it never saw.",
          "Compare the two scores and name the gap."
        ],
        "skills":["overfitting","train vs test gap","generalisation"],
        "starter_code":"train = [(1, 0), (2, 0), (3, 1), (4, 1)]\ntest  = [(5, 1), (6, 1), (0, 0)]\n\n# memorises every training row\nmodel = {row[0]: row[1] for row in train}\n\ntrain_correct = sum(1 for v, a in train if model.get(v) == a)\ntest_correct  = sum(1 for v, a in test  if model.get(v, -1) == a)\n\nprint(''Train score:'', train_correct, ''/'', len(train))\nprint(''Test  score:'', test_correct,  ''/'', len(test))",
        "project":"Bug Hunt: Overfitting by Memory",
        "hints":["A dictionary keyed on the exact input is pure memorisation.","Fresh inputs miss the key and fall back to the default.","The gap between the two scores is the lesson."],
        "challenge":"Replace the memoriser with a simple threshold rule and compare both train and test scores. Which generalises?",
        "reflection":"Why does memorising perfectly count as a failure in machine learning?"}'),
    (10, 8, 'Week 10 Mission: Model Selection Challenge', 'week-10-mission-model-selection-challenge',
      array['Run several candidate rules', 'Evaluate each fairly', 'Pick and defend a winner'],
      '{"goal":"Compete three hand-built models and defend the best one with evidence.",
        "explanation":"Engineers choose between options using evidence, not vibes. Run the same test set against three candidates.",
        "paragraphs":[
          "Candidate A: hours threshold. Candidate B: sleep threshold. Candidate C: hours AND sleep.",
          "Score all three on the SAME held-out rows, tabulate, and pick the winner with a reason."
        ],
        "examples":["results = {''A'': 0.66, ''B'': 0.83, ''C'': 0.83}\nbest = max(results, key=results.get)\nprint(''Winner:'', best)"],
        "activities":[
          "Implement three predict functions with different rules.",
          "Score each on identical test rows.",
          "Print a results table and state your winner with a reason."
        ],
        "skills":["model comparison","fair evaluation","decision making"],
        "starter_code":"test = [\n    (1, 4, 0), (2, 5, 0),\n    (3, 7, 1), (4, 8, 1),\n]\n\ndef model_a(hours, sleep):  return hours >= 3\ndef model_b(hours, sleep):  return sleep >= 6\ndef model_c(hours, sleep):  return hours >= 3 and sleep >= 6\n\ndef accuracy(model):\n    correct = 0\n    for hours, sleep, actual in test:\n        if model(hours, sleep) == actual:\n            correct = correct + 1\n    return correct / len(test)\n\nprint(''A hours     :'', accuracy(model_a))\nprint(''B sleep     :'', accuracy(model_b))\nprint(''C hours+sleep:'', accuracy(model_c))",
        "project":"Model Selection Challenge",
        "hints":["Keep the test rows identical for all three.","Print a labelled table.","Ties are real — say which you would pick and why."],
        "challenge":"Add a deliberately broken model D that always predicts True and confirm it scores worse. Sabotage teaches evaluation.",
        "reflection":"If two models tie on accuracy, what other evidence would you use to choose?"}'),

    -- ---------------- WEEK 11: Your Own Project ----------------
    (11, 6, 'Week 11 Lab: Project Planner', 'week-11-lab-project-planner',
      array['Frame a data question', 'List features and a target', 'Sketch a test plan'],
      '{"goal":"Plan your final project on paper (and in code) before writing any model code.",
        "explanation":"Projects fail from vague planning, not from hard code. A sharp question plus a test plan saves you hours.",
        "paragraphs":[
          "Write: the question, the features, the target, the data source, and how you will score success.",
          "Then stub the plan in code as a dictionary so you can tick items off as you go."
        ],
        "examples":["plan = {\n  ''question'': ''Will it rain tomorrow?'',\n  ''features'': [''cloud'', ''humidity''],\n  ''target'': ''rain''\n}"],
        "activities":[
          "Write your data question as a single sentence.",
          "List 2-3 features and one target.",
          "Create a plan dictionary with question, features, target, and success metric."
        ],
        "skills":["problem framing","features","target","planning"],
        "starter_code":"plan = {\n    ''question'': ''What do I want to predict?'',\n    ''features'': [''feature_1'', ''feature_2''],\n    ''target'': ''target_column'',\n    ''success_metric'': ''accuracy'',\n    ''limitation'': ''my data is small'',\n}\n\nprint(''--- Project plan ---'')\nfor key, value in plan.items():\n    print(key + '': '', value)",
        "project":"Project Planner",
        "hints":["A good question is answerable with yes/no or a number.","Features are inputs you would actually have at prediction time.","State the metric before you run anything."],
        "challenge":"Rewrite a vague question (''something about students'') into a sharp, testable one and save both versions in the plan.",
        "reflection":"How much time would this five-minute plan save you on a two-hour build?"}'),
    (11, 7, 'Week 11 Bug Hunt: Pipeline in the Wrong Order', 'week-11-bug-hunt-pipeline-wrong-order',
      array['Order the ML pipeline correctly', 'Fix a workflow bug', 'Explain each step'],
      '{"goal":"Reorder a scrambled data-to-prediction pipeline so it actually works.",
        "explanation":"The pipeline has a fixed order: prepare data, split, fit on train, evaluate on test, then present. Scrambling it breaks the result.",
        "paragraphs":[
          "The starter shuffles the steps: it evaluates before fitting and fits on the test rows.",
          "Rewrite the steps in the correct order and the scores become trustworthy again."
        ],
        "examples":["# correct order\n# 1 prepare  2 split  3 fit(train)  4 predict(test)  5 report"],
        "activities":[
          "Read the scrambled comments and label each step.",
          "Reorder the code into prepare/split/fit/predict/report.",
          "Confirm the final accuracy prints without leaking."
        ],
        "skills":["pipeline order","split then fit","debugging workflow"],
        "starter_code":"data = [(1, 0), (2, 0), (3, 1), (4, 1), (5, 1)]\n\n# scrambled steps — reorder them\n# 3 fit on TRAIN\n# 1 prepare data\n# 5 report\n# 2 split\n# 4 predict on TEST\n\ntrain, test = data[:3], data[3:]\nthreshold = 3\ncorrect = sum(1 for v, a in test if (v >= threshold) == a)\nprint(''Steps: prepare, split, fit, predict, report'')\nprint(''Accuracy:'', correct / len(test))",
        "project":"Bug Hunt: Pipeline in the Wrong Order",
        "hints":["You cannot predict before you fit.","You cannot fit on the test rows.","Number the five steps, then rearrange the code to match."],
        "challenge":"Write the five-step pipeline as a checklist string in your code and assert (check) that each step appears in order.",
        "reflection":"Which single step, if done out of order, would make every other result untrustworthy?"}'),
    (11, 8, 'Week 11 Mission: Demo Script Builder', 'week-11-mission-demo-script-builder',
      array['Summarise a project for an audience', 'Structure a three-part demo', 'Present limitations honestly'],
      '{"goal":"Build the script for your final project demo — question, result, and honest limits.",
        "explanation":"A project is only finished when you can explain it. Structure every demo as: the question, what you did, what you found, and what is still weak.",
        "paragraphs":[
          "Audiences remember stories with a clear arc. Your arc: here is the problem, here is my data, here is the result, here is what I would do next.",
          "Honest limitations raise your credibility. Nobody believes a perfect story."
        ],
        "examples":["script = ''''''Question: ...\nData: ...\nResult: ...\nLimitation: ...\nNext: ...''''''"],
        "activities":[
          "Write one sentence for each of the five script parts.",
          "Store them in a dictionary and print them as a numbered script.",
          "Time yourself reading it aloud — aim for under three minutes."
        ],
        "skills":["communication","demo structure","limitations","confidence"],
        "starter_code":"script = {\n    ''1_question'': ''What did I try to predict and why?'',\n    ''2_data'':     ''Where did my data come from?'',\n    ''3_method'':   ''How did I split and test it?'',\n    ''4_result'':   ''What accuracy did I get and what does it mean?'',\n    ''5_limits'':   ''What is weak, and what would I improve next?'',\n}\n\nprint(''=== My 3-minute demo script ==='')\nfor step, line in script.items():\n    print(step + '': '' + line)",
        "project":"Demo Script Builder",
        "hints":["Five short beats beat one long paragraph.","Always end with a real next step.","Read it aloud; cut anything you stumble over."],
         "challenge":"Add a one-line ''hook'' opener that makes a listener want to hear the rest, then put it first.",
        "reflection":"Which part of your demo script are you least sure about — and how will you firm it up?"}')
) as lab(week_number, lesson_number, title, slug, objectives, content)
  on lab.week_number = weeks.week_number
where course.slug = 'python-for-ai-machine-learning'
  on conflict (week_id, lesson_number) do update set
    title = excluded.title,
    slug = excluded.slug,
    objectives = excluded.objectives,
    content = excluded.content,
    published = true,
    sort_order = excluded.sort_order;
