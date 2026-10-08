with question_bank (
  week_number,
  title,
  instructions,
  question_type,
  choices,
  correct_answer,
  explanation
) as (
  values
    (1, 'Check your location', 'Which command shows the current directory?', 'multiple_choice',
     '["pwd", "ls", "cat", "help"]'::jsonb, 'pwd',
     'pwd prints the current working directory.'),
    (1, 'Look before you open', 'True or false: ls lists the files and folders in a directory.', 'true_false',
     '["true", "false"]'::jsonb, 'true',
     'ls shows what is inside the current directory.'),
    (1, 'Read command help', 'Which command lists the commands available in this practice terminal?', 'multiple_choice',
     '["help", "pwd", "touch", "rm"]'::jsonb, 'help',
     'help lists the commands supported by this sandbox.'),
    (2, 'Create an empty file', 'Which command creates an empty file named ideas.txt?', 'multiple_choice',
     '["touch ideas.txt", "mkdir ideas.txt", "cat ideas.txt", "cd ideas.txt"]'::jsonb,
     'touch ideas.txt', 'touch creates an empty file.'),
    (2, 'Create a folder', 'True or false: mkdir robot creates a directory named robot.', 'true_false',
     '["true", "false"]'::jsonb, 'true',
     'mkdir creates a directory.'),
    (2, 'Remove safely', 'In this practice terminal, what does rm remove?', 'multiple_choice',
     '["A named file", "Every file in a folder", "The whole computer", "A command from help"]'::jsonb,
     'A named file', 'The sandbox permits removing a named file and refuses to remove a directory.'),
    (3, 'Search inside a file', 'Which command finds lines containing error in notes.txt?', 'multiple_choice',
     '["grep error notes.txt", "find error notes.txt", "cat error notes.txt", "ls error notes.txt"]'::jsonb,
     'grep error notes.txt', 'grep searches file contents for matching text.'),
    (3, 'Find a file by name', 'True or false: find -name md searches for files by name.', 'true_false',
     '["true", "false"]'::jsonb, 'true',
     'find -name searches for files whose names match the requested text.'),
    (3, 'Choose a search tool', 'Which command searches file contents rather than filenames?', 'multiple_choice',
     '["grep", "find -name", "pwd", "mkdir"]'::jsonb, 'grep',
     'grep searches inside files; find -name searches for files by name.'),
    (4, 'Count file contents', 'Which three quantities does wc report for a file?', 'multiple_choice',
     '["Lines, words, and characters", "Folders, files, and paths", "Names, dates, and owners", "Matches, errors, and commands"]'::jsonb,
     'Lines, words, and characters', 'wc reports line, word, and character counts.'),
    (4, 'Preview a file', 'True or false: head can show only the first few lines of a file.', 'true_false',
     '["true", "false"]'::jsonb, 'true',
     'head previews the beginning of a file.'),
    (4, 'Use the right command', 'Which command is best for previewing the start of a long file?', 'multiple_choice',
     '["head", "wc", "touch", "rm"]'::jsonb, 'head',
     'head displays the first lines without printing the entire file.'),
    (5, 'Review previous commands', 'Which command shows commands entered earlier in this terminal session?', 'multiple_choice',
     '["history", "whoami", "date", "man"]'::jsonb, 'history',
     'history displays commands entered earlier in the current session.'),
    (5, 'Read a command manual', 'True or false: man grep explains how to use grep.', 'true_false',
     '["true", "false"]'::jsonb, 'true',
     'man opens the built-in manual entry for a supported command.'),
    (5, 'Check the user name', 'Which command tells you the current user name?', 'multiple_choice',
     '["whoami", "history", "head", "find"]'::jsonb, 'whoami',
     'whoami prints the current user name.')
),
terminal_lessons as (
  select lesson.id as lesson_id, lesson.lesson_number, weeks.week_number
  from public.academy_lessons lesson
  join public.academy_weeks weeks on weeks.id = lesson.week_id
  join public.academy_courses course on course.id = weeks.course_id
  where course.slug = 'terminal-and-command-line'
    and course.published
    and lesson.published
    and lesson.status = 'published'
)
insert into public.academy_exercises (
  lesson_id,
  title,
  instructions,
  starter_code,
  difficulty,
  expected_concepts,
  hints,
  explanation,
  question_type,
  choices,
  correct_answer,
  attempt_limit,
  published,
  status,
  sort_order
)
select
  lesson.lesson_id,
  format('Week %s · Lesson %s · %s', lesson.week_number, lesson.lesson_number, question.title),
  question.instructions,
  '',
  'beginner',
  array['terminal', 'command line'],
  array['Use the command practiced in this lesson.', 'Read the command output carefully.'],
  question.explanation,
  question.question_type,
  question.choices,
  question.correct_answer,
  3,
  true,
  'published',
  row_number() over (
    partition by lesson.lesson_id
    order by question.title
  )::integer
from terminal_lessons lesson
join question_bank question on question.week_number = lesson.week_number
where not exists (
  select 1
  from public.academy_exercises existing
  where existing.lesson_id = lesson.lesson_id
    and existing.title = format(
      'Week %s · Lesson %s · %s',
      lesson.week_number,
      lesson.lesson_number,
      question.title
    )
);

do $$
declare
  lessons_below_question_target integer;
begin
  select count(*)
    into lessons_below_question_target
  from public.academy_lessons lesson
  join public.academy_weeks weeks on weeks.id = lesson.week_id
  join public.academy_courses course on course.id = weeks.course_id
  where course.slug = 'terminal-and-command-line'
    and course.published
    and lesson.published
    and lesson.status = 'published'
    and (
      select count(*)
      from public.academy_exercises exercise
      where exercise.lesson_id = lesson.id
        and exercise.published
        and exercise.status = 'published'
        and exercise.question_type in (
          'multiple_choice',
          'true_false',
          'short_answer'
        )
        and exercise.practice_session_id is null
    ) < 3;

  if lessons_below_question_target > 0 then
    raise warning
      'Terminal practice provisioning left % published lessons with fewer than three scored questions.',
      lessons_below_question_target;
  end if;
end;
$$;

insert into public.academy_lesson_activities (
  lesson_id,
  kind,
  ref_id,
  title,
  points,
  status,
  sort_order,
  required_for_completion
)
select
  exercise.lesson_id,
  'practice',
  exercise.id,
  exercise.title,
  5,
  'published',
  exercise.sort_order,
  true
from public.academy_exercises exercise
join public.academy_lessons lesson on lesson.id = exercise.lesson_id
join public.academy_weeks weeks on weeks.id = lesson.week_id
join public.academy_courses course on course.id = weeks.course_id
where course.slug = 'terminal-and-command-line'
  and course.published
  and lesson.published
  and lesson.status = 'published'
  and exercise.published
  and exercise.status = 'published'
  and exercise.question_type in ('multiple_choice', 'true_false', 'short_answer')
  and exercise.practice_session_id is null
on conflict (lesson_id, kind, ref_id) do update
set title = excluded.title,
    points = excluded.points,
    status = excluded.status,
    sort_order = excluded.sort_order,
    required_for_completion = excluded.required_for_completion;

notify pgrst, 'reload schema';
