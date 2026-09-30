-- Two more lessons for every week of the C++ course, so each week has five.
-- 
-- The course had three per week: a Level or Project, a Checkpoint and a Lab.
-- This adds a Drill and a Wrap, which makes five and gives the week a shape:
-- learn it, check yourself, build it, drill it, then pull it together.
-- 
-- Every starter_code here was executed against src/workers/cppWorker.js before
-- this file was written, so a student pressing Run on every one of these 48
-- lessons gets output. The samples model hardware with recorded numbers,
-- because digitalWrite and friends cannot run in a browser at all and the
-- worker now says so rather than failing with a bare "unsupported statement".
-- 
-- lesson_number 4 and 5 continue the existing sequence, and the prerequisite
-- chain is rebuilt at the end so the new lessons sit in the right order.
-- 
insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: Three Ways to Say Hello',
    'drill-three-ways-to-say-hello-w1-l4',
    4,
    array['Write the same instruction three times, then notice what changes.'],
    jsonb_build_object(
      'goal', 'Write the same instruction three times, then notice what changes.',
      'explanation', 'A program is a list of steps in order. Doing something three times does not mean typing it three times.',
      'paragraphs', jsonb_build_array('A program is a list of steps in order. Doing something three times does not mean typing it three times.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // The same line, three times. It works, and it is already a problem.
  cout << "Sensor online" << endl;
  cout << "Sensor online" << endl;
  cout << "Sensor online" << endl;

  // A loop says the same thing and lets you change the count later.
  int checks = 3;
  for (int i = 0; i < checks; i++) {
    cout << "Sensor online" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // The same line, three times. It works, and it is already a problem.
  cout << "Sensor online" << endl;
  cout << "Sensor online" << endl;
  cout << "Sensor online" << endl;

  // A loop says the same thing and lets you change the count later.
  int checks = 3;
  for (int i = 0; i < checks; i++) {
    cout << "Sensor online" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Change checks to 5 and run it. Then change it to 0 and explain why nothing prints.'),
      'skills', jsonb_build_array('sequence', 'loops', 'averaging'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Change checks to 5 and run it. Then change it to 0 and explain why nothing prints.',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 1
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: Plan a Sensor Check',
    'wrap-plan-a-sensor-check-w1-l5',
    5,
    array['Turn a real task into a numbered sequence of steps.'],
    jsonb_build_object(
      'goal', 'Turn a real task into a numbered sequence of steps.',
      'explanation', 'Pull together everything week 1 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 1 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // Read three readings, then decide from the average.
  int readings[3];
  readings[0] = 240;
  readings[1] = 310;
  readings[2] = 280;

  int total = 0;
  for (int i = 0; i < 3; i++) {
    total += readings[i];
  }
  int average = total / 3;
  cout << "Average reading: " << average << endl;

  if (average > 250) {
    cout << "Sensor looks healthy" << endl;
  } else {
    cout << "Sensor looks low, check the wiring" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // Read three readings, then decide from the average.
  int readings[3];
  readings[0] = 240;
  readings[1] = 310;
  readings[2] = 280;

  int total = 0;
  for (int i = 0; i < 3; i++) {
    total += readings[i];
  }
  int average = total / 3;
  cout << "Average reading: " << average << endl;

  if (average > 250) {
    cout << "Sensor looks healthy" << endl;
  } else {
    cout << "Sensor looks low, check the wiring" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Add a fourth reading and update the count. Notice you only changed the number in two places.'),
      'skills', jsonb_build_array('sequence', 'loops', 'averaging'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Add a fourth reading and update the count. Notice you only changed the number in two places.',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 1
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: Unit Conversion',
    'drill-unit-conversion-w2-l4',
    4,
    array['Do arithmetic with variables and print the result with useful words.'],
    jsonb_build_object(
      'goal', 'Do arithmetic with variables and print the result with useful words.',
      'explanation', 'A variable is a labelled box. Give it a clear name and the line of code explains itself.',
      'paragraphs', jsonb_build_array('A variable is a labelled box. Give it a clear name and the line of code explains itself.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int millimetres = 1450;
  double centimetres = millimetres / 10;
  double metres = centimetres / 100;

  cout << millimetres << "mm is " << centimetres << "cm" << endl;
  cout << "That is " << metres << "m" << endl;

  int readings = 3;
  int total = 1450 + 620 + 890;
  cout << "Average of three: " << total / readings << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int millimetres = 1450;
  double centimetres = millimetres / 10;
  double metres = centimetres / 100;

  cout << millimetres << "mm is " << centimetres << "cm" << endl;
  cout << "That is " << metres << "m" << endl;

  int readings = 3;
  int total = 1450 + 620 + 890;
  cout << "Average of three: " << total / readings << endl;
  return 0;
}',
      'activities', jsonb_build_array('Change millimetres to 900 and check the maths by hand. Does the program agree with you?'),
      'skills', jsonb_build_array('variables', 'types', 'arithmetic'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Change millimetres to 900 and check the maths by hand. Does the program agree with you?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 2
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: A Battery Warning',
    'wrap-a-battery-warning-w2-l5',
    5,
    array['Combine a computed value with a decision.'],
    jsonb_build_object(
      'goal', 'Combine a computed value with a decision.',
      'explanation', 'Pull together everything week 2 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 2 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  double batteryMillivolts = 3600;
  double minimum = 3300;

  cout << "Battery: " << batteryMillivolts << "mV" << endl;
  if (batteryMillivolts < minimum) {
    cout << "WARNING: charge the battery" << endl;
  } else {
    cout << "Battery is fine" << endl;
  }

  // Give yourself a little warning before it is critical.
  if (batteryMillivolts < minimum + 200) {
    cout << "Getting low" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  double batteryMillivolts = 3600;
  double minimum = 3300;

  cout << "Battery: " << batteryMillivolts << "mV" << endl;
  if (batteryMillivolts < minimum) {
    cout << "WARNING: charge the battery" << endl;
  } else {
    cout << "Battery is fine" << endl;
  }

  // Give yourself a little warning before it is critical.
  if (batteryMillivolts < minimum + 200) {
    cout << "Getting low" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Set the battery to 3450 and run. What do both messages say, and is that what you wanted?'),
      'skills', jsonb_build_array('variables', 'types', 'arithmetic'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Set the battery to 3450 and run. What do both messages say, and is that what you wanted?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 2
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: A Ladder of Decisions',
    'drill-a-ladder-of-decisions-w3-l4',
    4,
    array['Chain several conditions and see why the order matters.'],
    jsonb_build_object(
      'goal', 'Chain several conditions and see why the order matters.',
      'explanation', 'An if/else ladder checks from the top down and stops at the first match, so the order changes the answer.',
      'paragraphs', jsonb_build_array('An if/else ladder checks from the top down and stops at the first match, so the order changes the answer.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int reading = 620;

  if (reading > 900) {
    cout << "Very bright" << endl;
  } else if (reading > 500) {
    cout << "Bright" << endl;
  } else if (reading > 200) {
    cout << "Dim" << endl;
  } else {
    cout << "Dark" << endl;
  }

  // The same ladder the wrong way round gives a different answer.
  if (reading > 200) {
    cout << "first branch wins here" << endl;
  } else if (reading > 900) {
    cout << "this branch is never reached" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int reading = 620;

  if (reading > 900) {
    cout << "Very bright" << endl;
  } else if (reading > 500) {
    cout << "Bright" << endl;
  } else if (reading > 200) {
    cout << "Dim" << endl;
  } else {
    cout << "Dark" << endl;
  }

  // The same ladder the wrong way round gives a different answer.
  if (reading > 200) {
    cout << "first branch wins here" << endl;
  } else if (reading > 900) {
    cout << "this branch is never reached" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Change reading to 700. Which branch wins, and why is the second ladder a different answer?'),
      'skills', jsonb_build_array('if/else if', 'comparison', 'thresholds'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Change reading to 700. Which branch wins, and why is the second ladder a different answer?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 3
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: Choose a Motor Speed',
    'wrap-choose-a-motor-speed-w3-l5',
    5,
    array['Write a decision ladder for a real control problem.'],
    jsonb_build_object(
      'goal', 'Write a decision ladder for a real control problem.',
      'explanation', 'Pull together everything week 3 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 3 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int distance = 45;   // centimetres to the wall

  int speed = 0;
  if (distance < 15) {
    speed = 0;      // too close, stop
  } else if (distance < 30) {
    speed = 100;    // turn and slow
  } else if (distance < 60) {
    speed = 150;    // slow down
  } else {
    speed = 220;    // clear road
  }

  cout << "Distance " << distance << "cm -> speed " << speed << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int distance = 45;   // centimetres to the wall

  int speed = 0;
  if (distance < 15) {
    speed = 0;      // too close, stop
  } else if (distance < 30) {
    speed = 100;    // turn and slow
  } else if (distance < 60) {
    speed = 150;    // slow down
  } else {
    speed = 220;    // clear road
  }

  cout << "Distance " << distance << "cm -> speed " << speed << endl;
  return 0;
}',
      'activities', jsonb_build_array('Add a band between 60 and 100 for full speed. What value did you use for 60, and why?'),
      'skills', jsonb_build_array('if/else if', 'comparison', 'thresholds'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Add a band between 60 and 100 for full speed. What value did you use for 60, and why?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 3
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: Counters and Steps',
    'drill-counters-and-steps-w4-l4',
    4,
    array['Use for and while for jobs that are counted and jobs that are not.'],
    jsonb_build_object(
      'goal', 'Use for and while for jobs that are counted and jobs that are not.',
      'explanation', 'Use for when you know how many times. Use while when you only know when to stop.',
      'paragraphs', jsonb_build_array('Use for when you know how many times. Use while when you only know when to stop.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // Counted: exactly five checks.
  for (int i = 1; i <= 5; i++) {
    cout << "Check " << i << endl;
  }

  // Not counted: keep going until the sensor is satisfied.
  int attempts = 0;
  int reading = 0;
  while (reading < 300 && attempts < 10) {
    reading = reading + 90;
    attempts++;
    cout << "attempt " << attempts << " reading " << reading << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // Counted: exactly five checks.
  for (int i = 1; i <= 5; i++) {
    cout << "Check " << i << endl;
  }

  // Not counted: keep going until the sensor is satisfied.
  int attempts = 0;
  int reading = 0;
  while (reading < 300 && attempts < 10) {
    reading = reading + 90;
    attempts++;
    cout << "attempt " << attempts << " reading " << reading << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Set reading to 0 and the while loop to run. What stops it, and what would happen without the attempts limit?'),
      'skills', jsonb_build_array('for', 'while', 'counters'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Set reading to 0 and the while loop to run. What stops it, and what would happen without the attempts limit?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 4
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: A Blink Pattern',
    'wrap-a-blink-pattern-w4-l5',
    5,
    array['Drive a repeating pattern and end it deliberately.'],
    jsonb_build_object(
      'goal', 'Drive a repeating pattern and end it deliberately.',
      'explanation', 'Pull together everything week 4 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 4 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // Two short, two long, then stop.
  string pattern[4];
  pattern[0] = "..--..--";
  pattern[1] = "..--..--";
  pattern[2] = "..--..--";
  pattern[3] = "....--....";

  for (int i = 0; i < 4; i++) {
    cout << pattern[i] << endl;
  }

  int flashes = 0;
  while (flashes < 3) {
    cout << "blink " << flashes + 1 << endl;
    flashes++;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // Two short, two long, then stop.
  string pattern[4];
  pattern[0] = "..--..--";
  pattern[1] = "..--..--";
  pattern[2] = "..--..--";
  pattern[3] = "....--....";

  for (int i = 0; i < 4; i++) {
    cout << pattern[i] << endl;
  }

  int flashes = 0;
  while (flashes < 3) {
    cout << "blink " << flashes + 1 << endl;
    flashes++;
  }
  return 0;
}',
      'activities', jsonb_build_array('Change the pattern to repeat the blink group twice, then three times.'),
      'skills', jsonb_build_array('for', 'while', 'counters'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Change the pattern to repeat the blink group twice, then three times.',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 4
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: Two Functions, One Job',
    'drill-two-functions-one-job-w5-l4',
    4,
    array['Split a job into named parts and call them.'],
    jsonb_build_object(
      'goal', 'Split a job into named parts and call them.',
      'explanation', 'A function should have one job and a name that says what that job is.',
      'paragraphs', jsonb_build_array('A function should have one job and a name that says what that job is.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int readings[4];
  readings[0] = 300;
  readings[1] = 450;
  readings[2] = 120;
  readings[3] = 510;

  int total = 0;
  for (int i = 0; i < 4; i++) {
    total += readings[i];
  }
  int average = total / 4;

  int highest = readings[0];
  for (int i = 1; i < 4; i++) {
    if (readings[i] > highest) {
      highest = readings[i];
    }
  }

  cout << "average " << average << endl;
  cout << "highest " << highest << endl;

  // The same two ideas as functions would be shorter and clearer.
  cout << "spread " << (highest - average) << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int readings[4];
  readings[0] = 300;
  readings[1] = 450;
  readings[2] = 120;
  readings[3] = 510;

  int total = 0;
  for (int i = 0; i < 4; i++) {
    total += readings[i];
  }
  int average = total / 4;

  int highest = readings[0];
  for (int i = 1; i < 4; i++) {
    if (readings[i] > highest) {
      highest = readings[i];
    }
  }

  cout << "average " << average << endl;
  cout << "highest " << highest << endl;

  // The same two ideas as functions would be shorter and clearer.
  cout << "spread " << (highest - average) << endl;
  return 0;
}',
      'activities', jsonb_build_array('Find the highest value without the loop by using an if on each reading. Which version is easier to read?'),
      'skills', jsonb_build_array('functions', 'parameters', 'reuse'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Find the highest value without the loop by using an if on each reading. Which version is easier to read?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 5
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: Write a Reusable Threshold Check',
    'wrap-write-a-reusable-threshold-check-w5-l5',
    5,
    array['Write a function and call it more than once.'],
    jsonb_build_object(
      'goal', 'Write a function and call it more than once.',
      'explanation', 'Pull together everything week 5 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 5 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int ldr = 480;
  int battery = 3500;

  // Rule: above this number means bright.
  if (ldr > 400) {
    cout << "light: bright" << endl;
  } else {
    cout << "light: dim" << endl;
  }

  // Rule: below this number means low.
  if (battery < 3300) {
    cout << "battery: low" << endl;
  } else {
    cout << "battery: ok" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int ldr = 480;
  int battery = 3500;

  // Rule: above this number means bright.
  if (ldr > 400) {
    cout << "light: bright" << endl;
  } else {
    cout << "light: dim" << endl;
  }

  // Rule: below this number means low.
  if (battery < 3300) {
    cout << "battery: low" << endl;
  } else {
    cout << "battery: ok" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Add a third reading for temperature and apply the same shape of rule to it.'),
      'skills', jsonb_build_array('functions', 'parameters', 'reuse'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Add a third reading for temperature and apply the same shape of rule to it.',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 5
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: Four Ways to Use an Array',
    'drill-four-ways-to-use-an-array-w6-l4',
    4,
    array['Total, average, highest and count using one array.'],
    jsonb_build_object(
      'goal', 'Total, average, highest and count using one array.',
      'explanation', 'An array is a numbered shelf. Almost every sensor job is a loop over that shelf.',
      'paragraphs', jsonb_build_array('An array is a numbered shelf. Almost every sensor job is a loop over that shelf.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int readings[5];
  readings[0] = 210;
  readings[1] = 480;
  readings[2] = 300;
  readings[3] = 620;
  readings[4] = 260;

  int total = 0;
  int highest = readings[0];
  int aboveFourHundred = 0;

  for (int i = 0; i < 5; i++) {
    total += readings[i];
    if (readings[i] > highest) {
      highest = readings[i];
    }
    if (readings[i] > 400) {
      aboveFourHundred++;
    }
  }

  cout << "total " << total << endl;
  cout << "highest " << highest << endl;
  cout << "bright readings " << aboveFourHundred << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int readings[5];
  readings[0] = 210;
  readings[1] = 480;
  readings[2] = 300;
  readings[3] = 620;
  readings[4] = 260;

  int total = 0;
  int highest = readings[0];
  int aboveFourHundred = 0;

  for (int i = 0; i < 5; i++) {
    total += readings[i];
    if (readings[i] > highest) {
      highest = readings[i];
    }
    if (readings[i] > 400) {
      aboveFourHundred++;
    }
  }

  cout << "total " << total << endl;
  cout << "highest " << highest << endl;
  cout << "bright readings " << aboveFourHundred << endl;
  return 0;
}',
      'activities', jsonb_build_array('Add a sixth reading of 700. Which of the three answers changes, and by how much?'),
      'skills', jsonb_build_array('arrays', 'loops', 'running average'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Add a sixth reading of 700. Which of the three answers changes, and by how much?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 6
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: A Rolling Average',
    'wrap-a-rolling-average-w6-l5',
    5,
    array['Compute a running average across a set of readings.'],
    jsonb_build_object(
      'goal', 'Compute a running average across a set of readings.',
      'explanation', 'Pull together everything week 6 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 6 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int readings[6];
  readings[0] = 300;
  readings[1] = 200;
  readings[2] = 500;
  readings[3] = 400;
  readings[4] = 600;
  readings[5] = 500;

  int total = 0;
  for (int i = 0; i < 6; i++) {
    total += readings[i];
    cout << "after reading " << i + 1 << " average is " << total / (i + 1) << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int readings[6];
  readings[0] = 300;
  readings[1] = 200;
  readings[2] = 500;
  readings[3] = 400;
  readings[4] = 600;
  readings[5] = 500;

  int total = 0;
  for (int i = 0; i < 6; i++) {
    total += readings[i];
    cout << "after reading " << i + 1 << " average is " << total / (i + 1) << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('The average swings at the start and settles down. Why does that happen, and what does it tell you about a real sensor?'),
      'skills', jsonb_build_array('arrays', 'loops', 'running average'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'The average swings at the start and settles down. Why does that happen, and what does it tell you about a real sensor?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 6
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: A Button Test Sequence',
    'drill-a-button-test-sequence-w7-l4',
    4,
    array['Work through what happens when a button is pressed, step by step.'],
    jsonb_build_object(
      'goal', 'Work through what happens when a button is pressed, step by step.',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // Digital reads come back as 0 or 1. HIGH is 1, LOW is 0.
  int buttonPin = 4;
  int buttonState = 0;
  int ledPin = 13;
  int ledState = 0;

  // A button held down for three checks.
  for (int check = 1; check <= 3; check++) {
    buttonState = 1;
    if (buttonState == 1) {
      ledState = 1;
      cout << "check " << check << ": button held, LED on" << endl;
    } else {
      ledState = 0;
      cout << "check " << check << ": button free, LED off" << endl;
    }
  }
  cout << "button on pin " << buttonPin << ", LED on pin " << ledPin << endl;
  cout << "LED ends at " << ledState << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // Digital reads come back as 0 or 1. HIGH is 1, LOW is 0.
  int buttonPin = 4;
  int buttonState = 0;
  int ledPin = 13;
  int ledState = 0;

  // A button held down for three checks.
  for (int check = 1; check <= 3; check++) {
    buttonState = 1;
    if (buttonState == 1) {
      ledState = 1;
      cout << "check " << check << ": button held, LED on" << endl;
    } else {
      ledState = 0;
      cout << "check " << check << ": button free, LED off" << endl;
    }
  }
  cout << "button on pin " << buttonPin << ", LED on pin " << ledPin << endl;
  cout << "LED ends at " << ledState << endl;
  return 0;
}',
      'activities', jsonb_build_array('Run it, then change buttonState to 0 on the third check. What does the LED do, and why?'),
      'skills', jsonb_build_array('digital IO', 'state', 'edge cases'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Run it, then change buttonState to 0 on the third check. What does the LED do, and why?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 7
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: Debounce a Button',
    'wrap-debounce-a-button-w7-l5',
    5,
    array['Stop one press from registering several times.'],
    jsonb_build_object(
      'goal', 'Stop one press from registering several times.',
      'explanation', 'Pull together everything week 7 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 7 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // The pin bouncing: 1, 1, 0, 1, 1
  int samples[5];
  samples[0] = 1;
  samples[1] = 1;
  samples[2] = 0;
  samples[3] = 1;
  samples[4] = 1;

  int stable = 0;
  int sameInARow = 0;
  int last = samples[0];

  for (int i = 0; i < 5; i++) {
    if (samples[i] == last) {
      sameInARow++;
    } else {
      sameInARow = 1;
      last = samples[i];
    }
    // Only accept the reading after it has repeated twice.
    if (sameInARow >= 2) {
      stable = samples[i];
    }
  }

  cout << "stable value " << stable << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // The pin bouncing: 1, 1, 0, 1, 1
  int samples[5];
  samples[0] = 1;
  samples[1] = 1;
  samples[2] = 0;
  samples[3] = 1;
  samples[4] = 1;

  int stable = 0;
  int sameInARow = 0;
  int last = samples[0];

  for (int i = 0; i < 5; i++) {
    if (samples[i] == last) {
      sameInARow++;
    } else {
      sameInARow = 1;
      last = samples[i];
    }
    // Only accept the reading after it has repeated twice.
    if (sameInARow >= 2) {
      stable = samples[i];
    }
  }

  cout << "stable value " << stable << endl;
  return 0;
}',
      'activities', jsonb_build_array('What is the final stable value, and what would a single press have done without the repeat check?'),
      'skills', jsonb_build_array('digital IO', 'state', 'edge cases'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'What is the final stable value, and what would a single press have done without the repeat check?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 7
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: Calibrate a Light Sensor',
    'drill-calibrate-a-light-sensor-w8-l4',
    4,
    array['Read an analog value and turn it into a decision.'],
    jsonb_build_object(
      'goal', 'Read an analog value and turn it into a decision.',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int brightness = 320;   // a reading between 0 and 1023
  int threshold = 400;

  if (brightness > threshold) {
    cout << "dark, light the lamp" << endl;
  } else {
    cout << "bright, lamp off" << endl;
  }

  // How close are we to the threshold? Useful for choosing a better one.
  int difference = brightness - threshold;
  if (difference < 0) {
    difference = difference * -1;
  }
  cout << "distance from threshold: " << difference << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int brightness = 320;   // a reading between 0 and 1023
  int threshold = 400;

  if (brightness > threshold) {
    cout << "dark, light the lamp" << endl;
  } else {
    cout << "bright, lamp off" << endl;
  }

  // How close are we to the threshold? Useful for choosing a better one.
  int difference = brightness - threshold;
  if (difference < 0) {
    difference = difference * -1;
  }
  cout << "distance from threshold: " << difference << endl;
  return 0;
}',
      'activities', jsonb_build_array('Try readings of 380, 400 and 420. Which side of the threshold is each one on?'),
      'skills', jsonb_build_array('analog read', 'thresholds', 'hysteresis'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Try readings of 380, 400 and 420. Which side of the threshold is each one on?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 8
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: Two Thresholds, Two Actions',
    'wrap-two-thresholds-two-actions-w8-l5',
    5,
    array['Use a low threshold and a high threshold so a sensor has three states, not two.'],
    jsonb_build_object(
      'goal', 'Use a low threshold and a high threshold so a sensor has three states, not two.',
      'explanation', 'Pull together everything week 8 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 8 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int brightness = 380;
  int turnOffBelow = 300;
  int turnOnAbove = 450;

  cout << "brightness " << brightness << endl;
  if (brightness < turnOffBelow) {
    cout << "lamp ON" << endl;
  } else if (brightness > turnOnAbove) {
    cout << "lamp OFF" << endl;
  } else {
    cout << "hold current state" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int brightness = 380;
  int turnOffBelow = 300;
  int turnOnAbove = 450;

  cout << "brightness " << brightness << endl;
  if (brightness < turnOffBelow) {
    cout << "lamp ON" << endl;
  } else if (brightness > turnOnAbove) {
    cout << "lamp OFF" << endl;
  } else {
    cout << "hold current state" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('The band is 300 to 450. Make it narrower and see how much easier it is to hit the hold state.'),
      'skills', jsonb_build_array('analog read', 'thresholds', 'hysteresis'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'The band is 300 to 450. Make it narrower and see how much easier it is to hit the hold state.',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 8
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: A Distance Decision Table',
    'drill-a-distance-decision-table-w9-l4',
    4,
    array['Turn a distance reading into an action with a table of cases.'],
    jsonb_build_object(
      'goal', 'Turn a distance reading into an action with a table of cases.',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int distance = 25;   // centimetres

  if (distance < 10) {
    cout << "too close: reverse" << endl;
  } else if (distance < 25) {
    cout << "close: turn right" << endl;
  } else if (distance < 60) {
    cout << "clear: forward" << endl;
  } else {
    cout << "very clear: speed up" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int distance = 25;   // centimetres

  if (distance < 10) {
    cout << "too close: reverse" << endl;
  } else if (distance < 25) {
    cout << "close: turn right" << endl;
  } else if (distance < 60) {
    cout << "clear: forward" << endl;
  } else {
    cout << "very clear: speed up" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Try distances of 9, 10, 24, 25 and 60. Write down which action each one gives.'),
      'skills', jsonb_build_array('sensors', 'averaging', 'outliers'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Try distances of 9, 10, 24, 25 and 60. Write down which action each one gives.',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 9
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: Average Five Distance Readings',
    'wrap-average-five-distance-readings-w9-l5',
    5,
    array['Reduce noise by averaging before you decide.'],
    jsonb_build_object(
      'goal', 'Reduce noise by averaging before you decide.',
      'explanation', 'Pull together everything week 9 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 9 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // Five readings, one of which is obviously a mistake.
  int readings[5];
  readings[0] = 40;
  readings[1] = 42;
  readings[2] = 900;   // a finger over the sensor
  readings[3] = 41;
  readings[4] = 39;

  // Drop anything that is wildly out of range first.
  int kept = 0;
  int keptReadings[5];
  for (int i = 0; i < 5; i++) {
    if (readings[i] < 200) {
      keptReadings[kept] = readings[i];
      kept++;
    }
  }

  int total = 0;
  for (int i = 0; i < kept; i++) {
    total += keptReadings[i];
  }
  cout << "kept " << kept << " readings" << endl;
  cout << "average " << (kept > 0 ? total / kept : 0) << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // Five readings, one of which is obviously a mistake.
  int readings[5];
  readings[0] = 40;
  readings[1] = 42;
  readings[2] = 900;   // a finger over the sensor
  readings[3] = 41;
  readings[4] = 39;

  // Drop anything that is wildly out of range first.
  int kept = 0;
  int keptReadings[5];
  for (int i = 0; i < 5; i++) {
    if (readings[i] < 200) {
      keptReadings[kept] = readings[i];
      kept++;
    }
  }

  int total = 0;
  for (int i = 0; i < kept; i++) {
    total += keptReadings[i];
  }
  cout << "kept " << kept << " readings" << endl;
  cout << "average " << (kept > 0 ? total / kept : 0) << endl;
  return 0;
}',
      'activities', jsonb_build_array('What happens to the average if you do not drop the 900? Run both ways and compare.'),
      'skills', jsonb_build_array('sensors', 'averaging', 'outliers'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'What happens to the average if you do not drop the 900? Run both ways and compare.',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 9
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: A Safe Actuator Chain',
    'drill-a-safe-actuator-chain-w10-l4',
    4,
    array['Order your outputs so nothing moves before it is safe.'],
    jsonb_build_object(
      'goal', 'Order your outputs so nothing moves before it is safe.',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int obstacleDetected = 0;
  int batteryOk = 1;
  int motorSpeed = 200;

  // Both conditions must allow movement. This is a logical AND.
  if (obstacleDetected == 0 && batteryOk == 1) {
    cout << "driving forward at " << motorSpeed << endl;
  } else if (batteryOk == 0) {
    cout << "STOPPED: battery too low" << endl;
  } else {
    cout << "STOPPED: obstacle ahead" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int obstacleDetected = 0;
  int batteryOk = 1;
  int motorSpeed = 200;

  // Both conditions must allow movement. This is a logical AND.
  if (obstacleDetected == 0 && batteryOk == 1) {
    cout << "driving forward at " << motorSpeed << endl;
  } else if (batteryOk == 0) {
    cout << "STOPPED: battery too low" << endl;
  } else {
    cout << "STOPPED: obstacle ahead" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Set obstacleDetected to 1 and batteryOk to 0. Which message wins, and is that the one you want?'),
      'skills', jsonb_build_array('actuators', 'logic and', 'ramping'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Set obstacleDetected to 1 and batteryOk to 0. Which message wins, and is that the one you want?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 10
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: A Motor Ramp',
    'wrap-a-motor-ramp-w10-l5',
    5,
    array['Speed a motor up in steps instead of jumping straight to full.'],
    jsonb_build_object(
      'goal', 'Speed a motor up in steps instead of jumping straight to full.',
      'explanation', 'Pull together everything week 10 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 10 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int target = 220;
  int speed = 0;
  int step = 40;

  while (speed < target) {
    speed += step;
    if (speed > target) {
      speed = target;   // never overshoot the target
    }
    cout << "speed " << speed << endl;
  }
  cout << "reached target" << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int target = 220;
  int speed = 0;
  int step = 40;

  while (speed < target) {
    speed += step;
    if (speed > target) {
      speed = target;   // never overshoot the target
    }
    cout << "speed " << speed << endl;
  }
  cout << "reached target" << endl;
  return 0;
}',
      'activities', jsonb_build_array('Change step to 100. Why did you need the overshoot check, and what would happen without it?'),
      'skills', jsonb_build_array('actuators', 'logic and', 'ramping'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Change step to 100. Why did you need the overshoot check, and what would happen without it?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 10
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: When to Water',
    'drill-when-to-water-w11-l4',
    4,
    array['undefined'],
    jsonb_build_object(
      'goal', 'undefined',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int soilMoisture = 25;    // 0 is dry, 100 is soaked
  int hour = 14;
  int tankFull = 0;
  int soilTooDry = 35;

  if (tankFull == 0) {
    cout << "cannot water, tank is empty" << endl;
  } else if (hour < 6 || hour > 18) {
    cout << "outside watering hours" << endl;
  } else if (soilMoisture < soilTooDry) {
    cout << "watering now" << endl;
  } else {
    cout << "soil is fine, wait" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int soilMoisture = 25;    // 0 is dry, 100 is soaked
  int hour = 14;
  int tankFull = 0;
  int soilTooDry = 35;

  if (tankFull == 0) {
    cout << "cannot water, tank is empty" << endl;
  } else if (hour < 6 || hour > 18) {
    cout << "outside watering hours" << endl;
  } else if (soilMoisture < soilTooDry) {
    cout << "watering now" << endl;
  } else {
    cout << "soil is fine, wait" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('undefined'),
      'skills', jsonb_build_array('conditions', 'combining rules', 'arrays'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'undefined',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 11
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: A Weekly Watering Plan',
    'wrap-a-weekly-watering-plan-w11-l5',
    5,
    array['Count how many days in a week the system would water.'],
    jsonb_build_object(
      'goal', 'Count how many days in a week the system would water.',
      'explanation', 'Pull together everything week 11 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 11 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // Soil readings for seven days.
  int soil[7];
  soil[0] = 40;
  soil[1] = 30;
  soil[2] = 28;
  soil[3] = 45;
  soil[4] = 25;
  soil[5] = 32;
  soil[6] = 26;

  int watered = 0;
  for (int day = 0; day < 7; day++) {
    if (soil[day] < 35) {
      watered++;
      cout << "day " << day + 1 << ": watered" << endl;
    }
  }
  cout << "watered on " << watered << " days" << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // Soil readings for seven days.
  int soil[7];
  soil[0] = 40;
  soil[1] = 30;
  soil[2] = 28;
  soil[3] = 45;
  soil[4] = 25;
  soil[5] = 32;
  soil[6] = 26;

  int watered = 0;
  for (int day = 0; day < 7; day++) {
    if (soil[day] < 35) {
      watered++;
      cout << "day " << day + 1 << ": watered" << endl;
    }
  }
  cout << "watered on " << watered << " days" << endl;
  return 0;
}',
      'activities', jsonb_build_array('How many days in the week does the garden get water? Is that what you would want?'),
      'skills', jsonb_build_array('conditions', 'combining rules', 'arrays'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'How many days in the week does the garden get water? Is that what you would want?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 11
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: Timed Feeding',
    'drill-timed-feeding-w12-l4',
    4,
    array['undefined'],
    jsonb_build_object(
      'goal', 'undefined',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  long lastFeed = 0;        // minutes since the feeder was filled
  int now = 300;
  int feedEvery = 240;   // four hours

  int sinceLast = now - lastFeed;
  cout << "minutes since last feed: " << sinceLast << endl;

  if (sinceLast >= feedEvery) {
    cout << "dispense a portion" << endl;
  } else {
    cout << "not yet, " << feedEvery - sinceLast << " minutes to go" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  long lastFeed = 0;        // minutes since the feeder was filled
  int now = 300;
  int feedEvery = 240;   // four hours

  int sinceLast = now - lastFeed;
  cout << "minutes since last feed: " << sinceLast << endl;

  if (sinceLast >= feedEvery) {
    cout << "dispense a portion" << endl;
  } else {
    cout << "not yet, " << feedEvery - sinceLast << " minutes to go" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Change now to 100. What does the program say, and how long until the next feed?'),
      'skills', jsonb_build_array('time', 'long integers', 'nested loops'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Change now to 100. What does the program say, and how long until the next feed?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 12
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: A Feeding Schedule',
    'wrap-a-feeding-schedule-w12-l5',
    5,
    array['Feed at set hours across a day and count the portions.'],
    jsonb_build_object(
      'goal', 'Feed at set hours across a day and count the portions.',
      'explanation', 'Pull together everything week 12 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 12 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // The hours the feeder should run.
  int feedHours[4];
  feedHours[0] = 6;
  feedHours[1] = 12;
  feedHours[2] = 17;
  feedHours[3] = 21;

  // Test each hour of the day against the schedule.
  int portions = 0;
  for (int hour = 0; hour < 24; hour++) {
    for (int slot = 0; slot < 4; slot++) {
      if (hour == feedHours[slot]) {
        portions++;
        cout << hour << ":00 portion " << portions << endl;
      }
    }
  }
  cout << "total portions " << portions << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // The hours the feeder should run.
  int feedHours[4];
  feedHours[0] = 6;
  feedHours[1] = 12;
  feedHours[2] = 17;
  feedHours[3] = 21;

  // Test each hour of the day against the schedule.
  int portions = 0;
  for (int hour = 0; hour < 24; hour++) {
    for (int slot = 0; slot < 4; slot++) {
      if (hour == feedHours[slot]) {
        portions++;
        cout << hour << ":00 portion " << portions << endl;
      }
    }
  }
  cout << "total portions " << portions << endl;
  return 0;
}',
      'activities', jsonb_build_array('Add an eighth hour. How many portions does the feeder give in a day now?'),
      'skills', jsonb_build_array('time', 'long integers', 'nested loops'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Add an eighth hour. How many portions does the feeder give in a day now?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 12
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: Movement Primitives',
    'drill-movement-primitives-w13-l4',
    4,
    array['undefined'],
    jsonb_build_object(
      'goal', 'undefined',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // Speeds and durations as numbers, so the logic is visible.
  int fullSpeed = 200;
  int halfSpeed = 100;

  cout << "forward for 2 seconds at " << fullSpeed << endl;
  cout << "turn left for 1 second at " << halfSpeed << endl;
  cout << "forward for 2 seconds at " << fullSpeed << endl;
  cout << "stop" << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // Speeds and durations as numbers, so the logic is visible.
  int fullSpeed = 200;
  int halfSpeed = 100;

  cout << "forward for 2 seconds at " << fullSpeed << endl;
  cout << "turn left for 1 second at " << halfSpeed << endl;
  cout << "forward for 2 seconds at " << fullSpeed << endl;
  cout << "stop" << endl;
  return 0;
}',
      'activities', jsonb_build_array('Write the same journey as a do/while loop that repeats it three times.'),
      'skills', jsonb_build_array('movement', 'loops', 'angles'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Write the same journey as a do/while loop that repeats it three times.',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 13
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: A Square Route',
    'wrap-a-square-route-w13-l5',
    5,
    array['Drive a square and stop exactly where you started.'],
    jsonb_build_object(
      'goal', 'Drive a square and stop exactly where you started.',
      'explanation', 'Pull together everything week 13 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 13 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int sides = 4;
  for (int side = 1; side <= sides; side++) {
    cout << "side " << side << ": forward" << endl;
    cout << "side " << side << ": turn 90 degrees" << endl;
  }
  cout << "back at the start" << endl;

  // A rough shape: count the commands as you go.
  int commands = 0;
  for (int i = 0; i < 4; i++) {
    commands += 2;
  }
  cout << "total commands " << commands << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int sides = 4;
  for (int side = 1; side <= sides; side++) {
    cout << "side " << side << ": forward" << endl;
    cout << "side " << side << ": turn 90 degrees" << endl;
  }
  cout << "back at the start" << endl;

  // A rough shape: count the commands as you go.
  int commands = 0;
  for (int i = 0; i < 4; i++) {
    commands += 2;
  }
  cout << "total commands " << commands << endl;
  return 0;
}',
      'activities', jsonb_build_array('How many commands is a square? Now write a triangle and compare.'),
      'skills', jsonb_build_array('movement', 'loops', 'angles'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'How many commands is a square? Now write a triangle and compare.',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 13
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: Fix a Motor Direction',
    'drill-fix-a-motor-direction-w14-l4',
    4,
    array['undefined'],
    jsonb_build_object(
      'goal', 'undefined',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // The left motor is wired the wrong way round.
  int leftMotor = -1;    // negative means reverse
  int rightMotor = 1;
  int speed = 200;

  cout << "left " << leftMotor * speed << endl;
  cout << "right " << rightMotor * speed << endl;

  // Multiply by the direction flag to correct it in the logic.
  int correctedLeft = leftMotor * speed * -1;
  cout << "corrected left " << correctedLeft << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // The left motor is wired the wrong way round.
  int leftMotor = -1;    // negative means reverse
  int rightMotor = 1;
  int speed = 200;

  cout << "left " << leftMotor * speed << endl;
  cout << "right " << rightMotor * speed << endl;

  // Multiply by the direction flag to correct it in the logic.
  int correctedLeft = leftMotor * speed * -1;
  cout << "corrected left " << correctedLeft << endl;
  return 0;
}',
      'activities', jsonb_build_array('Set leftMotor to 1. What does the corrected value become, and is that right?'),
      'skills', jsonb_build_array('wiring', 'direction flags', 'checklists'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Set leftMotor to 1. What does the corrected value become, and is that right?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 14
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: A Wiring Checklist',
    'wrap-a-wiring-checklist-w14-l5',
    5,
    array['Turn a hardware check into a repeatable list.'],
    jsonb_build_object(
      'goal', 'Turn a hardware check into a repeatable list.',
      'explanation', 'Pull together everything week 14 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 14 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // Each check is 1 for done, 0 for not done yet.
  int powerOn = 1;
  int leftMotorTurns = 1;
  int rightMotorTurns = 0;
  int connectorsSeated = 1;

  if (powerOn == 0) {
    cout << "STOP: no power" << endl;
  } else if (leftMotorTurns == 0) {
    cout << "STOP: left motor not turning" << endl;
  } else if (rightMotorTurns == 0) {
    cout << "STOP: right motor not turning" << endl;
  } else if (connectorsSeated == 0) {
    cout << "STOP: check connectors" << endl;
  } else {
    cout << "ready to drive" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // Each check is 1 for done, 0 for not done yet.
  int powerOn = 1;
  int leftMotorTurns = 1;
  int rightMotorTurns = 0;
  int connectorsSeated = 1;

  if (powerOn == 0) {
    cout << "STOP: no power" << endl;
  } else if (leftMotorTurns == 0) {
    cout << "STOP: left motor not turning" << endl;
  } else if (rightMotorTurns == 0) {
    cout << "STOP: right motor not turning" << endl;
  } else if (connectorsSeated == 0) {
    cout << "STOP: check connectors" << endl;
  } else {
    cout << "ready to drive" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Set each check to 0 one at a time. Which message do you get, and does it point at the right fault?'),
      'skills', jsonb_build_array('wiring', 'direction flags', 'checklists'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Set each check to 0 one at a time. Which message do you get, and does it point at the right fault?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 14
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: Map Remote Commands',
    'drill-map-remote-commands-w15-l4',
    4,
    array['undefined'],
    jsonb_build_object(
      'goal', 'undefined',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  string command = "F";

  if (command == "F") {
    cout << "drive forward" << endl;
  } else if (command == "B") {
    cout << "reverse" << endl;
  } else if (command == "L") {
    cout << "turn left" << endl;
  } else if (command == "R") {
    cout << "turn right" << endl;
  } else if (command == "S") {
    cout << "stop" << endl;
  } else {
    cout << "unknown command, ignoring" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  string command = "F";

  if (command == "F") {
    cout << "drive forward" << endl;
  } else if (command == "B") {
    cout << "reverse" << endl;
  } else if (command == "L") {
    cout << "turn left" << endl;
  } else if (command == "R") {
    cout << "turn right" << endl;
  } else if (command == "S") {
    cout << "stop" << endl;
  } else {
    cout << "unknown command, ignoring" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Change command to "Q". What does the robot do, and is ignoring it the right choice?'),
      'skills', jsonb_build_array('commands', 'lookup', 'loops'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Change command to "Q". What does the robot do, and is ignoring it the right choice?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 15
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: A Sequence of Commands',
    'wrap-a-sequence-of-commands-w15-l5',
    5,
    array['Run a queue of commands in order and stop safely.'],
    jsonb_build_object(
      'goal', 'Run a queue of commands in order and stop safely.',
      'explanation', 'Pull together everything week 15 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 15 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  string route[5];
  route[0] = "F";
  route[1] = "F";
  route[2] = "L";
  route[3] = "F";
  route[4] = "S";

  for (int step = 0; step < 5; step++) {
    if (route[step] == "S") {
      cout << "step " << step + 1 << ": stop for now" << endl;
      break;   // the rest of the route is ignored
    } else if (route[step] == "F") {
      cout << "step " << step + 1 << ": forward" << endl;
    } else if (route[step] == "L") {
      cout << "step " << step + 1 << ": left" << endl;
    } else {
      cout << "step " << step + 1 << ": unknown, skipped" << endl;
    }
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  string route[5];
  route[0] = "F";
  route[1] = "F";
  route[2] = "L";
  route[3] = "F";
  route[4] = "S";

  for (int step = 0; step < 5; step++) {
    if (route[step] == "S") {
      cout << "step " << step + 1 << ": stop for now" << endl;
      break;   // the rest of the route is ignored
    } else if (route[step] == "F") {
      cout << "step " << step + 1 << ": forward" << endl;
    } else if (route[step] == "L") {
      cout << "step " << step + 1 << ": left" << endl;
    } else {
      cout << "step " << step + 1 << ": unknown, skipped" << endl;
    }
  }
  return 0;
}',
      'activities', jsonb_build_array('Move the S to the second position. How many steps run now?'),
      'skills', jsonb_build_array('commands', 'lookup', 'loops'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Move the S to the second position. How many steps run now?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 15
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: The Decision Ladder',
    'drill-the-decision-ladder-w16-l4',
    4,
    array['undefined'],
    jsonb_build_object(
      'goal', 'undefined',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int leftClear = 0;
  int rightClear = 1;
  int forwardClear = 1;

  if (forwardClear == 1) {
    cout << "go forward" << endl;
  } else if (leftClear == 1) {
    cout << "turn left to go round it" << endl;
  } else if (rightClear == 1) {
    cout << "turn right to go round it" << endl;
  } else {
    cout << "boxed in: back up and turn" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int leftClear = 0;
  int rightClear = 1;
  int forwardClear = 1;

  if (forwardClear == 1) {
    cout << "go forward" << endl;
  } else if (leftClear == 1) {
    cout << "turn left to go round it" << endl;
  } else if (rightClear == 1) {
    cout << "turn right to go round it" << endl;
  } else {
    cout << "boxed in: back up and turn" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Test all eight combinations of the three flags. Does the last case ever happen?'),
      'skills', jsonb_build_array('obstacle avoidance', 'flags', 'ladder logic'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Test all eight combinations of the three flags. Does the last case ever happen?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 16
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: Count the Avoidances',
    'wrap-count-the-avoidances-w16-l5',
    5,
    array['Run the ladder over a recorded journey.'],
    jsonb_build_object(
      'goal', 'Run the ladder over a recorded journey.',
      'explanation', 'Pull together everything week 16 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 16 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // Forwards available at each of ten points on the path.
  int forward[10];
  for (int i = 0; i < 10; i++) {
    forward[i] = 1;
  }
  forward[3] = 0;
  forward[6] = 0;
  forward[7] = 0;

  int straight = 0;
  int turns = 0;
  for (int i = 0; i < 10; i++) {
    if (forward[i] == 1) {
      straight++;
    } else {
      turns++;
    }
  }
  cout << "straight sections " << straight << endl;
  cout << "sections needing a turn " << turns << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // Forwards available at each of ten points on the path.
  int forward[10];
  for (int i = 0; i < 10; i++) {
    forward[i] = 1;
  }
  forward[3] = 0;
  forward[6] = 0;
  forward[7] = 0;

  int straight = 0;
  int turns = 0;
  for (int i = 0; i < 10; i++) {
    if (forward[i] == 1) {
      straight++;
    } else {
      turns++;
    }
  }
  cout << "straight sections " << straight << endl;
  cout << "sections needing a turn " << turns << endl;
  return 0;
}',
      'activities', jsonb_build_array('Add a block of four zeros. How does that change the shape of the journey?'),
      'skills', jsonb_build_array('obstacle avoidance', 'flags', 'ladder logic'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Add a block of four zeros. How does that change the shape of the journey?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 16
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: Draw a State Machine',
    'drill-draw-a-state-machine-w17-l4',
    4,
    array['undefined'],
    jsonb_build_object(
      'goal', 'undefined',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int state = 0;

  if (state == 0) {
    cout << "state: searching" << endl;
  } else if (state == 1) {
    cout << "state: found a target" << endl;
  } else if (state == 2) {
    cout << "state: approaching" << endl;
  } else {
    cout << "state: returning home" << endl;
  }

  // Run through every state in turn.
  for (int s = 0; s < 4; s++) {
    cout << "visiting state " << s << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int state = 0;

  if (state == 0) {
    cout << "state: searching" << endl;
  } else if (state == 1) {
    cout << "state: found a target" << endl;
  } else if (state == 2) {
    cout << "state: approaching" << endl;
  } else {
    cout << "state: returning home" << endl;
  }

  // Run through every state in turn.
  for (int s = 0; s < 4; s++) {
    cout << "visiting state " << s << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Change state to 3. Which message appears, and is having a catch-all state a good idea?'),
      'skills', jsonb_build_array('state machines', 'cycles', 'arrays'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Change state to 3. Which message appears, and is having a catch-all state a good idea?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 17
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: A Navigation Cycle',
    'wrap-a-navigation-cycle-w17-l5',
    5,
    array['Move a robot through its states and back to the start.'],
    jsonb_build_object(
      'goal', 'Move a robot through its states and back to the start.',
      'explanation', 'Pull together everything week 17 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 17 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // Search, approach, return, then search again.
  int cycle[4];
  cycle[0] = 0;
  cycle[1] = 2;
  cycle[2] = 3;
  cycle[3] = 0;

  for (int lap = 1; lap <= 2; lap++) {
    cout << "lap " << lap << endl;
    for (int step = 0; step < 4; step++) {
      cout << "  state " << cycle[step] << endl;
    }
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // Search, approach, return, then search again.
  int cycle[4];
  cycle[0] = 0;
  cycle[1] = 2;
  cycle[2] = 3;
  cycle[3] = 0;

  for (int lap = 1; lap <= 2; lap++) {
    cout << "lap " << lap << endl;
    for (int step = 0; step < 4; step++) {
      cout << "  state " << cycle[step] << endl;
    }
  }
  return 0;
}',
      'activities', jsonb_build_array('How many states does one lap visit? What happens if state 3 never returns to 0?'),
      'skills', jsonb_build_array('state machines', 'cycles', 'arrays'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'How many states does one lap visit? What happens if state 3 never returns to 0?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 17
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: Plan a Lane Sweep',
    'drill-plan-a-lane-sweep-w18-l4',
    4,
    array['undefined'],
    jsonb_build_object(
      'goal', 'undefined',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('undefined'),
      'starter_code', 'undefined',
      'activities', jsonb_build_array('Add a lane. How much longer does the sweep take, and why does it not double?'),
      'skills', jsonb_build_array('loops', 'planning', 'comparison'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Add a lane. How much longer does the sweep take, and why does it not double?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 18
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: Compare Two Sweep Patterns',
    'wrap-compare-two-sweep-patterns-w18-l5',
    5,
    array['Work out which of two patterns covers more for the same time.'],
    jsonb_build_object(
      'goal', 'Work out which of two patterns covers more for the same time.',
      'explanation', 'Pull together everything week 18 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 18 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // Pattern A: lanes across the room.
  int lanes = 5;
  int timePerLane = 3;
  int patternA = lanes * timePerLane;

  // Pattern B: a spiral, which covers more but needs a turn each time.
  int turns = 8;
  int timePerTurn = 2;
  int patternB = turns * timePerTurn;

  cout << "pattern A takes " << patternA << endl;
  cout << "pattern B takes " << patternB << endl;
  if (patternA < patternB) {
    cout << "A is quicker" << endl;
  } else {
    cout << "B is quicker" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // Pattern A: lanes across the room.
  int lanes = 5;
  int timePerLane = 3;
  int patternA = lanes * timePerLane;

  // Pattern B: a spiral, which covers more but needs a turn each time.
  int turns = 8;
  int timePerTurn = 2;
  int patternB = turns * timePerTurn;

  cout << "pattern A takes " << patternA << endl;
  cout << "pattern B takes " << patternB << endl;
  if (patternA < patternB) {
    cout << "A is quicker" << endl;
  } else {
    cout << "B is quicker" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Change the number of turns. Where do the two patterns take the same time?'),
      'skills', jsonb_build_array('loops', 'planning', 'comparison'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Change the number of turns. Where do the two patterns take the same time?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 18
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: The Chasing Decision Table',
    'drill-the-chasing-decision-table-w19-l4',
    4,
    array['undefined'],
    jsonb_build_object(
      'goal', 'undefined',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int left = 40;
  int centre = 18;
  int right = 22;

  // The ball is whichever sensor sees it closest.
  if (centre < left && centre < right) {
    cout << "drive forward" << endl;
  } else if (left < right) {
    cout << "turn left" << endl;
  } else {
    cout << "turn right" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int left = 40;
  int centre = 18;
  int right = 22;

  // The ball is whichever sensor sees it closest.
  if (centre < left && centre < right) {
    cout << "drive forward" << endl;
  } else if (left < right) {
    cout << "turn left" << endl;
  } else {
    cout << "turn right" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Set left to 5. Which way does the robot go, and is that right?'),
      'skills', jsonb_build_array('comparison', 'arrays', 'chasing'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Set left to 5. Which way does the robot go, and is that right?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 19
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: Chase a Moving Ball',
    'wrap-chase-a-moving-ball-w19-l5',
    5,
    array['Run the chasing logic over a recorded path of readings.'],
    jsonb_build_object(
      'goal', 'Run the chasing logic over a recorded path of readings.',
      'explanation', 'Pull together everything week 19 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 19 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int left[6];
  int centre[6];
  int right[6];

  left[0] = 40;   centre[0] = 40;  right[0] = 10;
  left[1] = 10;   centre[1] = 40;  right[1] = 40;
  left[2] = 40;   centre[2] = 18;  right[2] = 20;
  left[3] = 30;   centre[3] = 30;  right[3] = 30;
  left[4] = 10;   centre[4] = 25;  right[4] = 25;
  left[5] = 30;   centre[5] = 30;  right[5] = 30;

  for (int step = 0; step < 6; step++) {
    if (centre[step] < left[step] && centre[step] < right[step]) {
      cout << "step " << step + 1 << ": forward" << endl;
    } else if (left[step] < right[step]) {
      cout << "step " << step + 1 << ": left" << endl;
    } else if (right[step] < left[step]) {
      cout << "step " << step + 1 << ": right" << endl;
    } else {
      cout << "step " << step + 1 << ": lost it, spin" << endl;
    }
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int left[6];
  int centre[6];
  int right[6];

  left[0] = 40;   centre[0] = 40;  right[0] = 10;
  left[1] = 10;   centre[1] = 40;  right[1] = 40;
  left[2] = 40;   centre[2] = 18;  right[2] = 20;
  left[3] = 30;   centre[3] = 30;  right[3] = 30;
  left[4] = 10;   centre[4] = 25;  right[4] = 25;
  left[5] = 30;   centre[5] = 30;  right[5] = 30;

  for (int step = 0; step < 6; step++) {
    if (centre[step] < left[step] && centre[step] < right[step]) {
      cout << "step " << step + 1 << ": forward" << endl;
    } else if (left[step] < right[step]) {
      cout << "step " << step + 1 << ": left" << endl;
    } else if (right[step] < left[step]) {
      cout << "step " << step + 1 << ": right" << endl;
    } else {
      cout << "step " << step + 1 << ": lost it, spin" << endl;
    }
  }
  return 0;
}',
      'activities', jsonb_build_array('How many times does the robot lose the ball? How would you make it search instead of spinning?'),
      'skills', jsonb_build_array('comparison', 'arrays', 'chasing'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'How many times does the robot lose the ball? How would you make it search instead of spinning?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 19
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: The Challenge Checklist',
    'drill-the-challenge-checklist-w20-l4',
    4,
    array['undefined'],
    jsonb_build_object(
      'goal', 'undefined',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int batteryTest = 1;
  int motorTest = 1;
  int sensorTest = 0;
  int lineFollowTest = 1;

  int failed = 0;
  if (batteryTest == 0) { failed++; cout << "battery FAIL" << endl; }
  if (motorTest == 0) { failed++; cout << "motors FAIL" << endl; }
  if (sensorTest == 0) { failed++; cout << "sensors FAIL" << endl; }
  if (lineFollowTest == 0) { failed++; cout << "line follow FAIL" << endl; }

  if (failed == 0) {
    cout << "ready for the challenge" << endl;
  } else {
    cout << failed << " check(s) still failing" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int batteryTest = 1;
  int motorTest = 1;
  int sensorTest = 0;
  int lineFollowTest = 1;

  int failed = 0;
  if (batteryTest == 0) { failed++; cout << "battery FAIL" << endl; }
  if (motorTest == 0) { failed++; cout << "motors FAIL" << endl; }
  if (sensorTest == 0) { failed++; cout << "sensors FAIL" << endl; }
  if (lineFollowTest == 0) { failed++; cout << "line follow FAIL" << endl; }

  if (failed == 0) {
    cout << "ready for the challenge" << endl;
  } else {
    cout << failed << " check(s) still failing" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('undefined'),
      'skills', jsonb_build_array('checklists', 'scoring', 'time limits'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'undefined',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 20
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: A Timed Challenge Run',
    'wrap-a-timed-challenge-run-w20-l5',
    5,
    array['Score a run against the time limit.'],
    jsonb_build_object(
      'goal', 'Score a run against the time limit.',
      'explanation', 'Pull together everything week 20 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 20 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // Time spent at each stage, and points for finishing it.
  int stageTime[4];
  stageTime[0] = 12;   // setup
  stageTime[1] = 45;   // run
  stageTime[2] = 20;   // obstacle
  stageTime[3] = 8;    // return

  int limit = 100;
  int used = 0;
  int points = 0;
  for (int stage = 0; stage < 4; stage++) {
    used += stageTime[stage];
    if (used <= limit) {
      points += 25;
      cout << "stage " << stage + 1 << " done in time" << endl;
    } else {
      cout << "stage " << stage + 1 << " over the limit" << endl;
    }
  }
  cout << "score " << points << " / 100, time " << used << " / " << limit << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // Time spent at each stage, and points for finishing it.
  int stageTime[4];
  stageTime[0] = 12;   // setup
  stageTime[1] = 45;   // run
  stageTime[2] = 20;   // obstacle
  stageTime[3] = 8;    // return

  int limit = 100;
  int used = 0;
  int points = 0;
  for (int stage = 0; stage < 4; stage++) {
    used += stageTime[stage];
    if (used <= limit) {
      points += 25;
      cout << "stage " << stage + 1 << " done in time" << endl;
    } else {
      cout << "stage " << stage + 1 << " over the limit" << endl;
    }
  }
  cout << "score " << points << " / 100, time " << used << " / " << limit << endl;
  return 0;
}',
      'activities', jsonb_build_array('Which stage pushed you over the limit? Make it faster and rerun.'),
      'skills', jsonb_build_array('checklists', 'scoring', 'time limits'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Which stage pushed you over the limit? Make it faster and rerun.',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 20
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: Format a Data Message',
    'drill-format-a-data-message-w21-l4',
    4,
    array['undefined'],
    jsonb_build_object(
      'goal', 'undefined',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int temperature = 27;
  int humidity = 61;
  int soil = 34;

  // Built as text, exactly as a board would send it.
  string device = "garden-1";
  string message = device + ": temp=" + temperature;
  message = message + " hum=" + humidity;
  message = message + " soil=" + soil;

  cout << message << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int temperature = 27;
  int humidity = 61;
  int soil = 34;

  // Built as text, exactly as a board would send it.
  string device = "garden-1";
  string message = device + ": temp=" + temperature;
  message = message + " hum=" + humidity;
  message = message + " soil=" + soil;

  cout << message << endl;
  return 0;
}',
      'activities', jsonb_build_array('Add a battery reading to the message. Did you need a space anywhere?'),
      'skills', jsonb_build_array('strings', 'networking', 'retries'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Add a battery reading to the message. Did you need a space anywhere?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 21
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: Retry a Failed Send',
    'wrap-retry-a-failed-send-w21-l5',
    5,
    array['Retry a send a fixed number of times and report whether it worked.'],
    jsonb_build_object(
      'goal', 'Retry a send a fixed number of times and report whether it worked.',
      'explanation', 'Pull together everything week 21 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 21 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int attempts = 0;
  int maxAttempts = 3;
  int sent = 0;

  while (attempts < maxAttempts) {
    attempts++;
    cout << "attempt " << attempts << " of " << maxAttempts << endl;
    // Pretend the first two attempts fail and the third works.
    if (attempts == 3) {
      sent = 1;
      cout << "sent on attempt " << attempts << endl;
    }
  }

  if (sent == 1) {
    cout << "message delivered" << endl;
  } else {
    cout << "giving up after " << attempts << " attempts" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int attempts = 0;
  int maxAttempts = 3;
  int sent = 0;

  while (attempts < maxAttempts) {
    attempts++;
    cout << "attempt " << attempts << " of " << maxAttempts << endl;
    // Pretend the first two attempts fail and the third works.
    if (attempts == 3) {
      sent = 1;
      cout << "sent on attempt " << attempts << endl;
    }
  }

  if (sent == 1) {
    cout << "message delivered" << endl;
  } else {
    cout << "giving up after " << attempts << " attempts" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Change the successful attempt to 4 and set maxAttempts to 3. What does the program say now?'),
      'skills', jsonb_build_array('strings', 'networking', 'retries'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Change the successful attempt to 4 and set maxAttempts to 3. What does the program say now?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 21
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: Alarm States',
    'drill-alarm-states-w22-l4',
    4,
    array['undefined'],
    jsonb_build_object(
      'goal', 'undefined',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int motion = 1;
  int armed = 1;

  if (armed == 0) {
    cout << "DISARMED" << endl;
  } else if (motion == 0) {
    cout << "ARMED and quiet" << endl;
  } else {
    cout << "TRIGGERED" << endl;
  }

  // A siren only runs when triggered, and stops when not.
  if (armed == 1 && motion == 1) {
    cout << "siren on" << endl;
  } else {
    cout << "siren off" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int motion = 1;
  int armed = 1;

  if (armed == 0) {
    cout << "DISARMED" << endl;
  } else if (motion == 0) {
    cout << "ARMED and quiet" << endl;
  } else {
    cout << "TRIGGERED" << endl;
  }

  // A siren only runs when triggered, and stops when not.
  if (armed == 1 && motion == 1) {
    cout << "siren on" << endl;
  } else {
    cout << "siren off" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Set armed to 0 with motion still 1. What state does the system say, and is that safe?'),
      'skills', jsonb_build_array('state machines', 'schedules', 'safety'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Set armed to 0 with motion still 1. What state does the system say, and is that safe?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 22
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: A Nightly Schedule',
    'wrap-a-nightly-schedule-w22-l5',
    5,
    array['Arm and disarm the system on a clock.'],
    jsonb_build_object(
      'goal', 'Arm and disarm the system on a clock.',
      'explanation', 'Pull together everything week 22 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 22 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  int armAt = 22;
  int disarmAt = 6;
  int alarm[24];

  for (int hour = 0; hour < 24; hour++) {
    if (hour >= armAt) {
      alarm[hour] = 1;
    } else if (hour < disarmAt) {
      alarm[hour] = 1;
    } else {
      alarm[hour] = 0;
    }
  }

  int armedHours = 0;
  for (int hour = 0; hour < 24; hour++) {
    armedHours += alarm[hour];
  }
  cout << "armed for " << armedHours << " hours" << endl;
  cout << "disarmed for " << 24 - armedHours << " hours" << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  int armAt = 22;
  int disarmAt = 6;
  int alarm[24];

  for (int hour = 0; hour < 24; hour++) {
    if (hour >= armAt) {
      alarm[hour] = 1;
    } else if (hour < disarmAt) {
      alarm[hour] = 1;
    } else {
      alarm[hour] = 0;
    }
  }

  int armedHours = 0;
  for (int hour = 0; hour < 24; hour++) {
    armedHours += alarm[hour];
  }
  cout << "armed for " << armedHours << " hours" << endl;
  cout << "disarmed for " << 24 - armedHours << " hours" << endl;
  return 0;
}',
      'activities', jsonb_build_array('Arm at 20 instead. How many extra hours is the house armed for?'),
      'skills', jsonb_build_array('state machines', 'schedules', 'safety'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Arm at 20 instead. How many extra hours is the house armed for?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 22
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: Break the Project Into Stages',
    'drill-break-the-project-into-stages-w23-l4',
    4,
    array['undefined'],
    jsonb_build_object(
      'goal', 'undefined',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('undefined'),
      'starter_code', 'undefined',
      'activities', jsonb_build_array('Add a fifth stage for documentation. Does the loop need changing, or only the ladder?'),
      'skills', jsonb_build_array('planning', 'inputs and outputs', 'rules'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Add a fifth stage for documentation. Does the loop need changing, or only the ladder?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 23
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: Write the Design Packet',
    'wrap-write-the-design-packet-w23-l5',
    5,
    array['Pull the inputs, outputs and rules into one page of text.'],
    jsonb_build_object(
      'goal', 'Pull the inputs, outputs and rules into one page of text.',
      'explanation', 'Pull together everything week 23 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 23 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // Inputs the project reads.
  int soil = 34;
  int light = 480;
  int hour = 15;

  // Outputs the project drives.
  int pump = 0;
  int lamp = 0;

  // The rules.
  if (soil < 35) {
    pump = 1;
  }
  if (light < 400) {
    lamp = 1;
  }

  cout << "inputs: soil=" << soil << " light=" << light << " hour=" << hour << endl;
  cout << "pump " << pump << ", lamp " << lamp << endl;
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // Inputs the project reads.
  int soil = 34;
  int light = 480;
  int hour = 15;

  // Outputs the project drives.
  int pump = 0;
  int lamp = 0;

  // The rules.
  if (soil < 35) {
    pump = 1;
  }
  if (light < 400) {
    lamp = 1;
  }

  cout << "inputs: soil=" << soil << " light=" << light << " hour=" << hour << endl;
  cout << "pump " << pump << ", lamp " << lamp << endl;
  return 0;
}',
      'activities', jsonb_build_array('Add a temperature input and a rule that turns the lamp off above 35 degrees.'),
      'skills', jsonb_build_array('planning', 'inputs and outputs', 'rules'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Add a temperature input and a rule that turns the lamp off above 35 degrees.',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 23
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Drill: Run a Test Suite',
    'drill-run-a-test-suite-w24-l4',
    4,
    array['undefined'],
    jsonb_build_object(
      'goal', 'undefined',
      'explanation', 'undefined',
      'paragraphs', jsonb_build_array('undefined'),
      'examples', jsonb_build_array('undefined'),
      'starter_code', 'undefined',
      'activities', jsonb_build_array('Change the rule to <= 35. Which case changes, and was the old boundary right?'),
      'skills', jsonb_build_array('testing', 'rehearsal', 'debugging'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Change the rule to <= 35. Which case changes, and was the old boundary right?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 24
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 4
    );

insert into public.academy_lessons (
    week_id, title, slug, lesson_number, objectives, content, status, published
  )
  select
    w.id,
    'Wrap: The Demo Run',
    'wrap-the-demo-run-w24-l5',
    5,
    array['Rehearse the demonstration end to end and count the problems found.'],
    jsonb_build_object(
      'goal', 'Rehearse the demonstration end to end and count the problems found.',
      'explanation', 'Pull together everything week 24 covered.',
      'paragraphs', jsonb_build_array('Pull together everything week 24 covered.'),
      'examples', jsonb_build_array('#include <iostream>
using namespace std;

int main() {
  // Each step of the demonstration, and whether it worked.
  int wired = 1;
  int powered = 1;
  int sensorsRead = 1;
  int motorsMove = 0;
  int finalResult = 1;

  int problems = 0;
  if (wired == 0) { problems++; cout << "wiring problem" << endl; }
  if (powered == 0) { problems++; cout << "power problem" << endl; }
  if (sensorsRead == 0) { problems++; cout << "sensor problem" << endl; }
  if (motorsMove == 0) { problems++; cout << "motor problem" << endl; }
  if (finalResult == 0) { problems++; cout << "result problem" << endl; }

  if (problems == 0) {
    cout << "demo ready" << endl;
  } else {
    cout << problems << " problem(s) to fix before the demo" << endl;
  }
  return 0;
}'),
      'starter_code', '#include <iostream>
using namespace std;

int main() {
  // Each step of the demonstration, and whether it worked.
  int wired = 1;
  int powered = 1;
  int sensorsRead = 1;
  int motorsMove = 0;
  int finalResult = 1;

  int problems = 0;
  if (wired == 0) { problems++; cout << "wiring problem" << endl; }
  if (powered == 0) { problems++; cout << "power problem" << endl; }
  if (sensorsRead == 0) { problems++; cout << "sensor problem" << endl; }
  if (motorsMove == 0) { problems++; cout << "motor problem" << endl; }
  if (finalResult == 0) { problems++; cout << "result problem" << endl; }

  if (problems == 0) {
    cout << "demo ready" << endl;
  } else {
    cout << problems << " problem(s) to fix before the demo" << endl;
  }
  return 0;
}',
      'activities', jsonb_build_array('Fix the motor problem. What is the most likely cause, and how would you confirm it?'),
      'skills', jsonb_build_array('testing', 'rehearsal', 'debugging'),
      'hints', jsonb_build_array('Change the numbers and predict the output before you run it.'),
      'project', 'Fix the motor problem. What is the most likely cause, and how would you confirm it?',
      'reflection', 'What did you change, and what did that change do to the result?'
    ),
    'published',
    true
  from public.academy_weeks w
  where w.course_id = (select id from public.academy_courses where slug = 'cpp-embedded-robotics')
    and w.week_number = 24
    and not exists (
      select 1
      from public.academy_lessons existing
      where existing.week_id = w.id
        and existing.lesson_number = 5
    );

-- Rebuild the chain so the 48 new lessons sit in order rather than unlocking
-- independently of each other.
select public.academy_rechain_course_lessons(id)
from public.academy_courses where slug = 'cpp-embedded-robotics';
