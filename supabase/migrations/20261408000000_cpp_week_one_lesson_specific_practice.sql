do $$
declare
  lesson_questions jsonb := $questions$
  [
    {"lesson_number":1,"question_number":1,"title":"Hardware in a robot","instructions":"Which item is hardware in a robot project?","question_type":"multiple_choice","choices":["A physical sensor","A set of written instructions","A flowchart","A variable name"],"correct_answer":"A physical sensor","explanation":"A sensor is a physical component, so it is hardware."},
    {"lesson_number":1,"question_number":2,"title":"What an algorithm describes","instructions":"What does an algorithm give a computer?","question_type":"multiple_choice","choices":["Exact steps in order","A list of computer parts","A screen colour","A guessed result"],"correct_answer":"Exact steps in order","explanation":"An algorithm is a precise sequence of steps."},
    {"lesson_number":1,"question_number":3,"title":"Flowchart decisions","instructions":"Which flowchart shape represents a yes-or-no decision?","question_type":"multiple_choice","choices":["Diamond","Oval","Rectangle","Arrow"],"correct_answer":"Diamond","explanation":"A diamond represents a decision and its branches."},

    {"lesson_number":2,"question_number":1,"title":"IPO processing","instructions":"A light sensor reading is the input and an LED command is the output. What is processing?","question_type":"multiple_choice","choices":["Deciding whether the reading means the room is dark","The sensor itself","The LED wire","The printed output line"],"correct_answer":"Deciding whether the reading means the room is dark","explanation":"Processing applies a rule to the input before choosing an output."},
    {"lesson_number":2,"question_number":2,"title":"Flowchart sequence","instructions":"In a flowchart, what do arrows show?","question_type":"multiple_choice","choices":["The order and direction of steps","The names of variables","The size of a sensor","The final answer only"],"correct_answer":"The order and direction of steps","explanation":"Arrows connect symbols to show the flow of the algorithm."},
    {"lesson_number":2,"question_number":3,"title":"Planning before coding","instructions":"True or false: a flowchart can help find a missing decision before you write C++.","question_type":"true_false","choices":["true","false"],"correct_answer":"true","explanation":"A flowchart makes steps and branches visible before implementation."},

    {"lesson_number":3,"question_number":1,"title":"Program entry point","instructions":"Which function contains the starting statements of a basic C++ program?","question_type":"multiple_choice","choices":["main","setupOnly","begin","print"],"correct_answer":"main","explanation":"A basic C++ program begins running its statements inside main()."},
    {"lesson_number":3,"question_number":2,"title":"End a C++ statement","instructions":"What punctuation normally ends a C++ statement?","question_type":"multiple_choice","choices":["Semicolon (;)","Comma (,)","Colon (:)","Question mark (?)"],"correct_answer":"Semicolon (;)","explanation":"C++ statements such as cout lines end with a semicolon."},
    {"lesson_number":3,"question_number":3,"title":"Finish main","instructions":"What does return 0; indicate at the end of main()?","question_type":"multiple_choice","choices":["The program finished successfully","Print the number zero","Repeat main forever","Read a sensor"],"correct_answer":"The program finished successfully","explanation":"Returning zero from main conventionally signals successful completion."},

    {"lesson_number":4,"question_number":1,"title":"Repeat a known number of times","instructions":"A message must print exactly three times. Which construct is a good fit?","question_type":"multiple_choice","choices":["A for loop","A flowchart diamond","A sensor input","return 0"],"correct_answer":"A for loop","explanation":"A counted for loop is suited to a known number of repetitions."},
    {"lesson_number":4,"question_number":2,"title":"Loop count","instructions":"True or false: a loop that starts at zero and runs while i < 3 executes three times when i increases by one.","question_type":"true_false","choices":["true","false"],"correct_answer":"true","explanation":"The loop uses i values 0, 1, and 2, then stops when i becomes 3."},
    {"lesson_number":4,"question_number":3,"title":"Avoid duplicate instructions","instructions":"Why use a loop instead of copying the same cout line many times?","question_type":"multiple_choice","choices":["One instruction can repeat a chosen number of times","It turns software into hardware","It removes the need for main()","It makes every value a sensor input"],"correct_answer":"One instruction can repeat a chosen number of times","explanation":"A loop expresses repetition once and controls it with a count."},

    {"lesson_number":5,"question_number":1,"title":"Summarise sensor readings","instructions":"A program reads three sensor values and calculates their average. Which IPO step is the calculation?","question_type":"multiple_choice","choices":["Processing","Input","Output","Hardware"],"correct_answer":"Processing","explanation":"Calculating an average transforms the readings, so it is processing."},
    {"lesson_number":5,"question_number":2,"title":"Average calculation","instructions":"What should you do to find the average of three readings?","question_type":"multiple_choice","choices":["Add them and divide the total by three","Multiply them by three","Print only the first reading","Subtract the smallest from the largest"],"correct_answer":"Add them and divide the total by three","explanation":"The arithmetic mean is the total divided by the number of readings."},
    {"lesson_number":5,"question_number":3,"title":"Check a sensor result","instructions":"After printing a sensor average, what is a useful way to check the program?","question_type":"multiple_choice","choices":["Try known readings and compare the output with a hand calculation","Rename the file without running it","Remove the return statement","Guess what the sensor would read"],"correct_answer":"Try known readings and compare the output with a hand calculation","explanation":"Known test values let you verify output against an independently calculated result."}
  ]$questions$::jsonb;
begin
  update public.academy_exercises exercise
  set published = false,
      status = 'archived'
  from public.academy_lessons lesson
  join public.academy_weeks weeks on weeks.id = lesson.week_id
  join public.academy_courses course on course.id = weeks.course_id
  where exercise.lesson_id = lesson.id
    and exercise.practice_session_id is null
    and exercise.question_type in ('multiple_choice', 'true_false', 'short_answer')
    and course.slug = 'cpp-embedded-robotics'
    and weeks.week_number = 1
    and course.published
    and lesson.published
    and lesson.status = 'published';

  insert into public.academy_exercises (
    lesson_id, title, instructions, starter_code, difficulty,
    expected_concepts, hints, explanation, question_type, choices,
    correct_answer, attempt_limit, published, status, sort_order
  )
  select
    lesson.id,
    format('Week 1 · Lesson %s · %s', lesson.lesson_number, question.title),
    question.instructions,
    '',
    'beginner',
    array['Week 1', 'lesson-specific practice'],
    array['Use the idea taught in this lesson.', 'Read each choice carefully.'],
    question.explanation,
    question.question_type,
    question.choices,
    question.correct_answer,
    3,
    true,
    'published',
    question.question_number
  from public.academy_lessons lesson
  join public.academy_weeks weeks on weeks.id = lesson.week_id
  join public.academy_courses course on course.id = weeks.course_id
  join jsonb_to_recordset(lesson_questions) as question(
    lesson_number smallint,
    question_number smallint,
    title text,
    instructions text,
    question_type text,
    choices jsonb,
    correct_answer text,
    explanation text
  ) on question.lesson_number = lesson.lesson_number
  where course.slug = 'cpp-embedded-robotics'
    and weeks.week_number = 1
    and course.published
    and lesson.published
    and lesson.status = 'published'
    and not exists (
      select 1
      from public.academy_exercises existing
      where existing.lesson_id = lesson.id
        and existing.title = format(
          'Week 1 · Lesson %s · %s',
          lesson.lesson_number,
          question.title
        )
    );

  insert into public.academy_lesson_activities (
    lesson_id, kind, ref_id, title, points, status, sort_order,
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
  where course.slug = 'cpp-embedded-robotics'
    and weeks.week_number = 1
    and course.published
    and lesson.published
    and lesson.status = 'published'
    and exercise.status = 'published'
    and exercise.published
    and exercise.practice_session_id is null
    and exercise.title like format('Week 1 · Lesson %s · %%', lesson.lesson_number)
  on conflict (lesson_id, kind, ref_id) do update
  set title = excluded.title,
      points = excluded.points,
      status = excluded.status,
      sort_order = excluded.sort_order,
      required_for_completion = true;

  -- Reset only untouched legacy sessions. Sessions with any submitted answer
  -- keep their original questions and scoring context.
  delete from public.academy_exercises saved_question
  using public.academy_practice_sessions practice_session,
        public.academy_lessons lesson,
        public.academy_weeks weeks,
        public.academy_courses course
  where saved_question.practice_session_id = practice_session.id
    and practice_session.lesson_id = lesson.id
    and lesson.week_id = weeks.id
    and weeks.course_id = course.id
    and course.slug = 'cpp-embedded-robotics'
    and weeks.week_number = 1
    and saved_question.practice_question_number > 3
    and practice_session.completed_at is null
    and not exists (
      select 1
      from public.academy_exercises session_question
      join public.academy_exercise_attempts attempt
        on attempt.exercise_id = session_question.id
       and attempt.student_id = practice_session.student_id
      where session_question.practice_session_id = practice_session.id
    );

  update public.academy_exercises saved_question
  set title = format('Week 1 · Lesson %s · %s', lesson.lesson_number, question.title),
      instructions = question.instructions,
      difficulty = 'beginner',
      expected_concepts = array['Week 1', 'lesson-specific practice'],
      hints = array['Use the idea taught in this lesson.', 'Read each choice carefully.'],
      explanation = question.explanation,
      question_type = question.question_type,
      choices = question.choices,
      correct_answer = question.correct_answer,
      attempt_limit = 3
  from public.academy_practice_sessions practice_session
  join public.academy_lessons lesson on lesson.id = practice_session.lesson_id
  join public.academy_weeks weeks on weeks.id = lesson.week_id
  join public.academy_courses course on course.id = weeks.course_id
  join jsonb_to_recordset(lesson_questions) as question(
    lesson_number smallint,
    question_number smallint,
    title text,
    instructions text,
    question_type text,
    choices jsonb,
    correct_answer text,
    explanation text
  ) on question.lesson_number = lesson.lesson_number
  where saved_question.practice_session_id = practice_session.id
    and saved_question.practice_question_number = question.question_number
    and practice_session.completed_at is null
    and course.slug = 'cpp-embedded-robotics'
    and weeks.week_number = 1
    and not exists (
      select 1
      from public.academy_exercises session_question
      join public.academy_exercise_attempts attempt
        on attempt.exercise_id = session_question.id
       and attempt.student_id = practice_session.student_id
      where session_question.practice_session_id = practice_session.id
    );
end;
$$;

notify pgrst, 'reload schema';
