-- A terminal course, because the request was for one and because every
-- professional developer works in a terminal every day.
-- 
-- The terminal is sandboxed in the browser: a virtual filesystem held in
-- memory and a fixed list of eighteen commands. It cannot reach a real file,
-- run a real process, or make a network request, so it is safe for a lesson
-- to tell a student to try rm.
-- 
-- Every command named in every lesson task was checked against the command
-- list before this file was written, so no lesson asks for something the
-- sandbox does not have.
-- 
-- The course.
insert into public.academy_courses (
    slug, title, description, short_description, duration_weeks,
    published, is_active, is_programming_course, course_family, course_type,
    language, sort_order
  )
  values (
    'terminal-and-command-line',
    'Terminal and Command Line Basics',
    'Every professional developer works in a terminal. This course teaches it from an empty prompt: moving around, looking at files, making new ones, finding text and chaining commands together. Every lesson has a terminal in the page, so you type real commands and see real results.',
    'Type commands instead of clicking. Learn the terminal by using it.',
    5,
    true,
    true,
    true,
    'programming',
    'programming',
    'shell',
    3
  )
  on conflict (slug) do update set
    title = excluded.title,
    description = excluded.description,
    short_description = excluded.short_description,
    duration_weeks = excluded.duration_weeks,
    language = excluded.language,
    is_active = true,
    published = true,
    updated_at = now();

insert into public.academy_subjects (slug, name, description)
values ('terminal', 'Terminal and Command Line', 'Using a command line instead of clicking.')
on conflict (slug) do update set name = excluded.name, description = excluded.description;

update public.academy_courses
set subject_id = (select id from public.academy_subjects where slug = 'terminal')
where slug = 'terminal-and-command-line';

insert into public.academy_weeks (course_id, week_number, title, description, published, sort_order)
select id, 1, 'Meeting the Terminal', 'the prompt, typing, and your first commands', true, 1
from public.academy_courses where slug = 'terminal-and-command-line'
on conflict (course_id, week_number) do update set
  title = excluded.title, description = excluded.description, published = true;

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 1: Your First Commands', 'lesson-1-your-first-commands', 1,
  array['Type a command, press Enter, and read what comes back.'],
  jsonb_build_object(
    'goal', 'Type a command, press Enter, and read what comes back.',
    'explanation', 'A terminal is a place you type instructions. You type one line, press Enter, and the computer does exactly that.',
    'paragraphs', jsonb_build_array('A terminal is a place you type instructions. You type one line, press Enter, and the computer does exactly that.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#notes.txt
the terminal is a place you type
',
    'examples', jsonb_build_array('Run help, then pwd. Read both answers before moving on.'),
    'activities', jsonb_build_array('Run help, then pwd. Read both answers before moving on.'),
    'skills', jsonb_build_array('prompt', 'help', 'pwd'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run help, then pwd. Read both answers before moving on.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 1
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 1);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 2: Listing What Is There', 'lesson-2-listing-what-is-there', 2,
  array['Use ls to see the files in a directory.'],
  jsonb_build_object(
    'goal', 'Use ls to see the files in a directory.',
    'explanation', 'Before you can open a file you need to know it exists. ls is how you look.',
    'paragraphs', jsonb_build_array('Before you can open a file you need to know it exists. ls is how you look.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#notes.txt
hello from the terminal
#photos/sunset.jpg
',
    'examples', jsonb_build_array('Run ls. Then run ls / to see the whole filesystem from the root.'),
    'activities', jsonb_build_array('Run ls. Then run ls / to see the whole filesystem from the root.'),
    'skills', jsonb_build_array('ls', 'listing', 'paths'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run ls. Then run ls / to see the whole filesystem from the root.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 1
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 2);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 3: Moving Around', 'lesson-3-moving-around', 3,
  array['Use cd to change directory and pwd to check where you are.'],
  jsonb_build_object(
    'goal', 'Use cd to change directory and pwd to check where you are.',
    'explanation', 'cd changes where you are. pwd tells you where you are. Run pwd often.',
    'paragraphs', jsonb_build_array('cd changes where you are. pwd tells you where you are. Run pwd often.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#notes.txt
start here
#projects/readme.md
#photos/sunset.jpg
',
    'examples', jsonb_build_array('cd into projects, run pwd, then cd back to /.'),
    'activities', jsonb_build_array('cd into projects, run pwd, then cd back to /.'),
    'skills', jsonb_build_array('cd', 'pwd', 'navigation'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'cd into projects, run pwd, then cd back to /.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 1
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 3);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 4: Reading a File', 'lesson-4-reading-a-file', 4,
  array['Print a file with cat.'],
  jsonb_build_object(
    'goal', 'Print a file with cat.',
    'explanation', 'cat prints a file. If it prints nothing, it is empty or you are in the wrong directory.',
    'paragraphs', jsonb_build_array('cat prints a file. If it prints nothing, it is empty or you are in the wrong directory.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#notes.txt
the first line
the second line
the third line
',
    'examples', jsonb_build_array('Run cat notes.txt, then try to cat a file that does not exist and read the error.'),
    'activities', jsonb_build_array('Run cat notes.txt, then try to cat a file that does not exist and read the error.'),
    'skills', jsonb_build_array('cat', 'files', 'errors'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run cat notes.txt, then try to cat a file that does not exist and read the error.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 1
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 4);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 5: Week 1 Practice', 'lesson-5-week-1-practice', 5,
  array['Combine everything from this week without looking anything up.'],
  jsonb_build_object(
    'goal', 'Combine everything from this week without looking anything up.',
    'explanation', 'Knowing a command is not the same as knowing it. Do it without notes and see what you remember.',
    'paragraphs', jsonb_build_array('Knowing a command is not the same as knowing it. Do it without notes and see what you remember.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#notes.txt
line one
line two
line three
#projects/readme.md
#projects/main.py
',
    'examples', jsonb_build_array('Run pwd, then ls, then cd projects, then ls again, then cd back to /.'),
    'activities', jsonb_build_array('Run pwd, then ls, then cd projects, then ls again, then cd back to /.'),
    'skills', jsonb_build_array('practice', 'confidence', 'recall'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run pwd, then ls, then cd projects, then ls again, then cd back to /.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 1
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 5);

insert into public.academy_weeks (course_id, week_number, title, description, published, sort_order)
select id, 2, 'Creating and Removing', 'making files and directories, and deleting safely', true, 2
from public.academy_courses where slug = 'terminal-and-command-line'
on conflict (course_id, week_number) do update set
  title = excluded.title, description = excluded.description, published = true;

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 1: Making Directories', 'lesson-1-making-directories', 1,
  array['Use mkdir to organise files into folders.'],
  jsonb_build_object(
    'goal', 'Use mkdir to organise files into folders.',
    'explanation', 'One directory full of files is hard to work in. Folders are how you stay organised.',
    'paragraphs', jsonb_build_array('One directory full of files is hard to work in. Folders are how you stay organised.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#notes.txt
start here
',
    'examples', jsonb_build_array('Run mkdir projects, then run mkdir projects/day-one, then ls projects to see it worked.'),
    'activities', jsonb_build_array('Run mkdir projects, then run mkdir projects/day-one, then ls projects to see it worked.'),
    'skills', jsonb_build_array('mkdir', 'organisation', 'undefined'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run mkdir projects, then run mkdir projects/day-one, then ls projects to see it worked.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 2
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 1);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 2: Making Files', 'lesson-2-making-files', 2,
  array['Use touch to make an empty file you can fill later.'],
  jsonb_build_object(
    'goal', 'Use touch to make an empty file you can fill later.',
    'explanation', 'touch makes a file with nothing in it. That is a fine place to start thinking.',
    'paragraphs', jsonb_build_array('touch makes a file with nothing in it. That is a fine place to start thinking.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#notes.txt
an existing file
',
    'examples', jsonb_build_array('Make an empty file called ideas.txt, then ls to confirm it exists.'),
    'activities', jsonb_build_array('Make an empty file called ideas.txt, then ls to confirm it exists.'),
    'skills', jsonb_build_array('touch', 'empty files', 'undefined'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Make an empty file called ideas.txt, then ls to confirm it exists.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 2
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 2);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 3: Deleting Things', 'lesson-3-deleting-things', 3,
  array['Use rm, and understand that it does not ask twice.'],
  jsonb_build_object(
    'goal', 'Use rm, and understand that it does not ask twice.',
    'explanation', 'In a real terminal rm does not check with you first. In this sandbox it cannot reach anything real, but the habit is worth learning here.',
    'paragraphs', jsonb_build_array('In a real terminal rm does not check with you first. In this sandbox it cannot reach anything real, but the habit is worth learning here.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#scratch.txt
this file is temporary
#keep.txt
this one matters
',
    'examples', jsonb_build_array('Run rm scratch.txt, then run it again and read the error it prints.'),
    'activities', jsonb_build_array('Run rm scratch.txt, then run it again and read the error it prints.'),
    'skills', jsonb_build_array('rm', 'deleting', 'care'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run rm scratch.txt, then run it again and read the error it prints.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 2
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 3);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 4: Putting Files Into Order', 'lesson-4-putting-files-into-order', 4,
  array['Build a small folder structure step by step.'],
  jsonb_build_object(
    'goal', 'Build a small folder structure step by step.',
    'explanation', 'Real projects are made of directories and files. Making the structure is a real task, not a formality.',
    'paragraphs', jsonb_build_array('Real projects are made of directories and files. Making the structure is a real task, not a formality.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#notes.txt
plan the structure first
',
    'examples', jsonb_build_array('Run mkdir robot, then mkdir robot/src, then touch robot/src/main.c and touch robot/src/motor.c.'),
    'activities', jsonb_build_array('Run mkdir robot, then mkdir robot/src, then touch robot/src/main.c and touch robot/src/motor.c.'),
    'skills', jsonb_build_array('mkdir', 'structure', 'planning'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run mkdir robot, then mkdir robot/src, then touch robot/src/main.c and touch robot/src/motor.c.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 2
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 4);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 5: Week 2 Practice', 'lesson-5-week-2-practice', 5,
  array['Build a whole structure from nothing.'],
  jsonb_build_object(
    'goal', 'Build a whole structure from nothing.',
    'explanation', 'Do it without notes. If you get stuck, help is one command away and that is fine.',
    'paragraphs', jsonb_build_array('Do it without notes. If you get stuck, help is one command away and that is fine.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#notes.txt
structure first
',
    'examples', jsonb_build_array('Run mkdir robot, then mkdir robot/src robot/data robot/docs, then touch a file inside each, then ls robot.'),
    'activities', jsonb_build_array('Run mkdir robot, then mkdir robot/src robot/data robot/docs, then touch a file inside each, then ls robot.'),
    'skills', jsonb_build_array('practice', 'structure', 'recall'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run mkdir robot, then mkdir robot/src robot/data robot/docs, then touch a file inside each, then ls robot.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 2
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 5);

insert into public.academy_weeks (course_id, week_number, title, description, published, sort_order)
select id, 3, 'Finding Things', 'searching inside files and finding files by name', true, 3
from public.academy_courses where slug = 'terminal-and-command-line'
on conflict (course_id, week_number) do update set
  title = excluded.title, description = excluded.description, published = true;

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 1: Finding Text With grep', 'lesson-1-finding-text-with-grep', 1,
  array['Find every line in a file that contains something.'],
  jsonb_build_object(
    'goal', 'Find every line in a file that contains something.',
    'explanation', 'grep reads a file line by line and prints the ones that match. It is the single most useful command there is.',
    'paragraphs', jsonb_build_array('grep reads a file line by line and prints the ones that match. It is the single most useful command there is.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#log.txt
sensor online
reading 240
sensor offline
reading 610
sensor online
reading 480
',
    'examples', jsonb_build_array('Run grep sensor log.txt. Then grep reading log.txt.'),
    'activities', jsonb_build_array('Run grep sensor log.txt. Then grep reading log.txt.'),
    'skills', jsonb_build_array('grep', 'search', 'text'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run grep sensor log.txt. Then grep reading log.txt.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 3
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 1);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 2: Line Numbers and Matches', 'lesson-2-line-numbers-and-matches', 2,
  array['Read grep output as line numbers and content.'],
  jsonb_build_object(
    'goal', 'Read grep output as line numbers and content.',
    'explanation', 'grep prints the line number before the line, so a match is a pointer, not just a word.',
    'paragraphs', jsonb_build_array('grep prints the line number before the line, so a match is a pointer, not just a word.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#log.txt
boot
sensor online
reading 240
sensor offline
reading 610
',
    'examples', jsonb_build_array('grep reading log.txt and note the line numbers. Which line is the reading of 610?'),
    'activities', jsonb_build_array('grep reading log.txt and note the line numbers. Which line is the reading of 610?'),
    'skills', jsonb_build_array('grep', 'line numbers', 'reading output'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'grep reading log.txt and note the line numbers. Which line is the reading of 610?',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 3
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 2);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 3: When Nothing Matches', 'lesson-3-when-nothing-matches', 3,
  array['Understand an empty result is information, not a failure.'],
  jsonb_build_object(
    'goal', 'Understand an empty result is information, not a failure.',
    'explanation', 'grep printing nothing means no line matched. That is a real answer, and it tells you the text is not there.',
    'paragraphs', jsonb_build_array('grep printing nothing means no line matched. That is a real answer, and it tells you the text is not there.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#log.txt
sensor online
reading 240
',
    'examples', jsonb_build_array('grep for something that is not in the file, then grep for something that is. Compare.'),
    'activities', jsonb_build_array('grep for something that is not in the file, then grep for something that is. Compare.'),
    'skills', jsonb_build_array('grep', 'empty results', 'diagnosis'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'grep for something that is not in the file, then grep for something that is. Compare.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 3
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 3);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 4: Finding Files by Name', 'lesson-4-finding-files-by-name', 4,
  array['Use find to search for files rather than text.'],
  jsonb_build_object(
    'goal', 'Use find to search for files rather than text.',
    'explanation', 'grep looks inside files. find looks for the files themselves, by name.',
    'paragraphs', jsonb_build_array('grep looks inside files. find looks for the files themselves, by name.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#notes.txt
one
#src/main.py
#src/util.py
#data/values.csv
',
    'examples', jsonb_build_array('Run find -name py to find files ending in py. Then find -name csv.'),
    'activities', jsonb_build_array('Run find -name py to find files ending in py. Then find -name csv.'),
    'skills', jsonb_build_array('find', 'filenames', 'search'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run find -name py to find files ending in py. Then find -name csv.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 3
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 4);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 5: Week 3 Practice', 'lesson-5-week-3-practice', 5,
  array['Answer a question about a small project using only grep and find.'],
  jsonb_build_object(
    'goal', 'Answer a question about a small project using only grep and find.',
    'explanation', 'Searching is how you answer questions about code you did not write.',
    'paragraphs', jsonb_build_array('Searching is how you answer questions about code you did not write.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#src/main.py
def start():
    print("starting")

def stop():
    print("stopping")
#data/values.csv
id,name
1,sensor
2,motor
',
    'examples', jsonb_build_array('Find which files contain stop. Then find every file that ends in py.'),
    'activities', jsonb_build_array('Find which files contain stop. Then find every file that ends in py.'),
    'skills', jsonb_build_array('practice', 'grep', 'find'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Find which files contain stop. Then find every file that ends in py.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 3
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 5);

insert into public.academy_weeks (course_id, week_number, title, description, published, sort_order)
select id, 4, 'Reading Well', 'wc, head and making sense of long output', true, 4
from public.academy_courses where slug = 'terminal-and-command-line'
on conflict (course_id, week_number) do update set
  title = excluded.title, description = excluded.description, published = true;

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 1: Counting a File', 'lesson-1-counting-a-file', 1,
  array['Use wc to count lines, words and characters.'],
  jsonb_build_object(
    'goal', 'Use wc to count lines, words and characters.',
    'explanation', 'wc answers three questions at once: how many lines, how many words, how many characters.',
    'paragraphs', jsonb_build_array('wc answers three questions at once: how many lines, how many words, how many characters.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#story.txt
one two three
four five
six
',
    'examples', jsonb_build_array('Run wc story.txt and say which number is which.'),
    'activities', jsonb_build_array('Run wc story.txt and say which number is which.'),
    'skills', jsonb_build_array('wc', 'counting', 'output'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run wc story.txt and say which number is which.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 4
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 1);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 2: Previewing With head', 'lesson-2-previewing-with-head', 2,
  array['Look at the start of a long file without printing all of it.'],
  jsonb_build_object(
    'goal', 'Look at the start of a long file without printing all of it.',
    'explanation', 'head prints the first few lines. On a long file that is usually all you need.',
    'paragraphs', jsonb_build_array('head prints the first few lines. On a long file that is usually all you need.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#log.txt
line 1
line 2
line 3
line 4
line 5
line 6
line 7
line 8
line 9
line 10
',
    'examples', jsonb_build_array('Run head log.txt. Then head -n 3 log.txt.'),
    'activities', jsonb_build_array('Run head log.txt. Then head -n 3 log.txt.'),
    'skills', jsonb_build_array('head', 'preview', 'long files'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run head log.txt. Then head -n 3 log.txt.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 4
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 2);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 3: Counting What Matters', 'lesson-3-counting-what-matters', 3,
  array['Combine head and wc to size up a file quickly.'],
  jsonb_build_object(
    'goal', 'Combine head and wc to size up a file quickly.',
    'explanation', 'One command answers one question. Running two in a row answers a bigger one.',
    'paragraphs', jsonb_build_array('One command answers one question. Running two in a row answers a bigger one.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#log.txt
error one
fine
error two
fine
error three
',
    'examples', jsonb_build_array('Run wc log.txt, then grep error log.txt, then wc again on nothing. Notice wc needs a file.'),
    'activities', jsonb_build_array('Run wc log.txt, then grep error log.txt, then wc again on nothing. Notice wc needs a file.'),
    'skills', jsonb_build_array('wc', 'head', 'combining'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run wc log.txt, then grep error log.txt, then wc again on nothing. Notice wc needs a file.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 4
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 3);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 4: A File Worth Reading', 'lesson-4-a-file-worth-reading', 4,
  array['Preview a log before deciding to read all of it.'],
  jsonb_build_object(
    'goal', 'Preview a log before deciding to read all of it.',
    'explanation', 'Good habit: look at the shape of a file before you commit to it.',
    'paragraphs', jsonb_build_array('Good habit: look at the shape of a file before you commit to it.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#sensor.log
boot ok
reading 210
reading 480
reading 300
reading 620
reading 250
done
',
    'examples', jsonb_build_array('Run wc sensor.log, then head -n 3 sensor.log, then read the whole thing.'),
    'activities', jsonb_build_array('Run wc sensor.log, then head -n 3 sensor.log, then read the whole thing.'),
    'skills', jsonb_build_array('head', 'wc', 'judgement'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run wc sensor.log, then head -n 3 sensor.log, then read the whole thing.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 4
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 4);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 5: Week 4 Practice', 'lesson-5-week-4-practice', 5,
  array['Inspect a project without reading everything.'],
  jsonb_build_object(
    'goal', 'Inspect a project without reading everything.',
    'explanation', 'Nobody reads every file. Knowing which file matters is the skill.',
    'paragraphs', jsonb_build_array('Nobody reads every file. Knowing which file matters is the skill.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#a.txt
alpha
beta
#b.txt
alpha
gamma
#c.txt
beta
gamma
delta
',
    'examples', jsonb_build_array('Count each file, then find which files contain gamma.'),
    'activities', jsonb_build_array('Count each file, then find which files contain gamma.'),
    'skills', jsonb_build_array('practice', 'wc', 'head'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Count each file, then find which files contain gamma.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 4
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 5);

insert into public.academy_weeks (course_id, week_number, title, description, published, sort_order)
select id, 5, 'Working Comfortably', 'history, whoami, date, man and resetting', true, 5
from public.academy_courses where slug = 'terminal-and-command-line'
on conflict (course_id, week_number) do update set
  title = excluded.title, description = excluded.description, published = true;

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 1: Your Command History', 'lesson-1-your-command-history', 1,
  array['Use history to see what you have typed, and the arrow keys to reuse it.'],
  jsonb_build_object(
    'goal', 'Use history to see what you have typed, and the arrow keys to reuse it.',
    'explanation', 'You will type the same command more than once. history remembers it for you.',
    'paragraphs', jsonb_build_array('You will type the same command more than once. history remembers it for you.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#notes.txt
remember the useful ones
',
    'examples', jsonb_build_array('Run three commands, then run history. Try the up arrow in the input box.'),
    'activities', jsonb_build_array('Run three commands, then run history. Try the up arrow in the input box.'),
    'skills', jsonb_build_array('history', 'recall', 'speed'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run three commands, then run history. Try the up arrow in the input box.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 5
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 1);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 2: Who Am I and What Time Is It', 'lesson-2-who-am-i-and-what-time-is-it', 2,
  array['Use whoami and date for quick orientation.'],
  jsonb_build_object(
    'goal', 'Use whoami and date for quick orientation.',
    'explanation', 'Small commands that answer small questions quickly, and that you will use constantly.',
    'paragraphs', jsonb_build_array('Small commands that answer small questions quickly, and that you will use constantly.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#notes.txt
orientation first
',
    'examples', jsonb_build_array('Run whoami, then date, then clear the screen.'),
    'activities', jsonb_build_array('Run whoami, then date, then clear the screen.'),
    'skills', jsonb_build_array('whoami', 'date', 'clear'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run whoami, then date, then clear the screen.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 5
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 2);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 3: Reading the Manual', 'lesson-3-reading-the-manual', 3,
  array['Use man to ask what a command does.'],
  jsonb_build_object(
    'goal', 'Use man to ask what a command does.',
    'explanation', 'You do not have to remember every flag. man tells you.',
    'paragraphs', jsonb_build_array('You do not have to remember every flag. man tells you.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#notes.txt
look it up rather than guess
',
    'examples', jsonb_build_array('Run man grep, then man cd. Try man for a command that does not exist.'),
    'activities', jsonb_build_array('Run man grep, then man cd. Try man for a command that does not exist.'),
    'skills', jsonb_build_array('man', 'help', 'self-sufficient'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Run man grep, then man cd. Try man for a command that does not exist.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 5
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 3);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 4: Starting Over', 'lesson-4-starting-over', 4,
  array['Use reset to get a clean filesystem back.'],
  jsonb_build_object(
    'goal', 'Use reset to get a clean filesystem back.',
    'explanation', 'Experiments are easier when you know you can undo the whole thing.',
    'paragraphs', jsonb_build_array('Experiments are easier when you know you can undo the whole thing.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#notes.txt
start clean
',
    'examples', jsonb_build_array('Make a file called mess.txt, then reset, then ls to see it is gone.'),
    'activities', jsonb_build_array('Make a file called mess.txt, then reset, then ls to see it is gone.'),
    'skills', jsonb_build_array('reset', 'experimentation', 'recovery'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Make a file called mess.txt, then reset, then ls to see it is gone.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 5
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 4);

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, status, published)
select w.id, 'Lesson 5: Week 5 Practice', 'lesson-5-week-5-practice', 5,
  array['Find a file, read part of it, and explain what it holds.'],
  jsonb_build_object(
    'goal', 'Find a file, read part of it, and explain what it holds.',
    'explanation', 'This is a real job: understand an unfamiliar file in under a minute.',
    'paragraphs', jsonb_build_array('This is a real job: understand an unfamiliar file in under a minute.'),
    -- Lines shaped "# path text" become the files the terminal starts with.
    'starter_code', '#readings.csv
id,value,label
1,240,soil
2,480,light
3,300,battery
4,620,distance
',
    'examples', jsonb_build_array('Count readings.csv, preview it, and grep for battery to find its row.'),
    'activities', jsonb_build_array('Count readings.csv, preview it, and grep for battery to find its row.'),
    'skills', jsonb_build_array('practice', 'wc', 'head'),
    'hints', jsonb_build_array('If a command prints nothing, check where you are with pwd.'),
    'project', 'Count readings.csv, preview it, and grep for battery to find its row.',
    'reflection', 'What did the command change, and how would you check that it worked?'
  ),
  'published', true
from public.academy_weeks w
where w.course_id = (select id from public.academy_courses where slug = 'terminal-and-command-line')
  and w.week_number = 5
  and not exists (select 1 from public.academy_lessons l where l.week_id = w.id and l.lesson_number = 5);

-- Five lessons a week here too, and chained so the order is enforced.
select public.academy_rechain_course_lessons(id)
from public.academy_courses where slug = 'terminal-and-command-line';
