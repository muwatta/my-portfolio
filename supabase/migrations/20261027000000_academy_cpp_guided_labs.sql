update public.academy_exercises exercises
set published = true,
    sort_order = coalesce(nullif(exercises.sort_order, 0), 10)
from public.academy_lessons lessons
join public.academy_weeks weeks on weeks.id = lessons.week_id
join public.academy_courses course on course.id = weeks.course_id
where exercises.lesson_id = lessons.id
  and course.slug = 'cpp-embedded-robotics'
  and exercises.question_type = 'programming';

insert into public.academy_lessons (
  week_id,
  title,
  slug,
  lesson_number,
  objectives,
  content,
  published,
  sort_order
)
select
  weeks.id,
  lab.title,
  lab.slug,
  3,
  lab.objectives,
  jsonb_build_object(
    'language', 'cpp',
    'goal', lab.goal,
    'explanation', lab.explanation,
    'paragraphs', to_jsonb(lab.paragraphs),
    'examples', jsonb_build_array(lab.example_code),
    'starter_code', lab.starter_code,
    'activities', to_jsonb(lab.activities),
    'skills', to_jsonb(lab.skills),
    'hints', to_jsonb(lab.hints),
    'challenge', lab.challenge,
    'reflection', lab.reflection
  ),
  true,
  3
from public.academy_weeks weeks
join public.academy_courses course on course.id = weeks.course_id
join (
  values
    (1, 'Week 1 Lab: Your First C++ Program', 'week-1-lab-first-cpp-program', array['Write a complete console program', 'Print text and finish with return 0', 'Read the program from top to bottom'], 'Write and run your first complete C++ program.', 'Start with a small program and trust each line.', array['A C++ program begins with main.', 'The statements inside main run from top to bottom.', 'cout prints text to the console.'], $code$#include <iostream>
using namespace std;

int main() {
  cout << "Welcome to C++" << endl;
  cout << "Your first program works." << endl;
  return 0;
}$code$, $code$#include <iostream>
using namespace std;

int main() {
  cout << "Welcome to C++" << endl;
  cout << "Your first program works." << endl;
  return 0;
}$code$, array['Change the welcome message to your name.', 'Add one more cout line.', 'Run it and say what changed.'], array['main', 'cout', 'return'], array['Begin with a working program.', 'Add one line at a time.'], 'Change the message so the output tells a short story about you.', 'What is the job of main?'), 
    (2, 'Week 2 Lab: Variables and Arithmetic', 'week-2-lab-variables-arithmetic', array['Declare variables', 'Choose int or double', 'Calculate and print a result'], 'Use variables to make a program remember values.', 'A variable gives a value a name so you can reuse it.', array['int stores whole numbers.', 'double stores decimal numbers.', 'The division result depends on the type of the numbers.'], $code$#include <iostream>
using namespace std;

int main() {
  int sensors = 3;
  double voltage = 4.8;
  double current = voltage / sensors;
  cout << "Sensors: " << sensors << endl;
  cout << "Current: " << current << endl;
  return 0;
}$code$, $code$#include <iostream>
using namespace std;

int main() {
  int sensors = 3;
  double voltage = 4.8;
  double current = voltage / sensors;
  cout << "Sensors: " << sensors << endl;
  cout << "Current: " << current << endl;
  return 0;
}$code$, array['Change sensors to 4.', 'Print the voltage before calculating current.', 'Explain why current changed.'], array['int', 'double', 'arithmetic'], array['Give every value a clear name.', 'Use double when a decimal answer matters.'], 'Add a second calculation using two sensors.', 'Which line would fail if voltage were an int and you needed a decimal answer?'),
    (3, 'Week 3 Lab: Make a Decision', 'week-3-lab-make-a-decision', array['Write an if condition', 'Add an else branch', 'Test the boundary'], 'Teach the program to choose an action from a reading.', 'An if statement asks a yes or no question before it runs a branch.', array['The condition is placed inside parentheses.', 'The first matching branch runs.', 'Test the exact boundary value.'], $code$#include <iostream>
using namespace std;

int main() {
  int distance = 24;
  if (distance < 30) {
    cout << "Turn left" << endl;
  } else {
    cout << "Keep going" << endl;
  }
  return 0;
}$code$, $code$#include <iostream>
using namespace std;

int main() {
  int distance = 24;
  if (distance < 30) {
    cout << "Turn left" << endl;
  } else {
    cout << "Keep going" << endl;
  }
  return 0;
}$code$, array['Try distance values 29 and 30.', 'Add a second decision for a very close obstacle.', 'Explain the order of the branches.'], array['if', 'else', 'comparison'], array['Test just below and exactly on the boundary.'], 'Add a third branch for a distance greater than 60.', 'Why should the closest condition be checked first?'),
    (4, 'Week 4 Lab: Repeat with a Loop', 'week-4-lab-repeat-with-loop', array['Write a for loop', 'Change the start and end values', 'Read the loop counter'], 'Use a loop to repeat the same work a controlled number of times.', 'A loop saves you from copying the same line again and again.', array['The counter starts at a chosen value.', 'The condition decides when to stop.', 'The update moves to the next value.'], $code$#include <iostream>
using namespace std;

int main() {
  for (int step = 1; step <= 5; step++) {
    cout << "Check step " << step << endl;
  }
  return 0;
}$code$, $code$#include <iostream>
using namespace std;

int main() {
  for (int step = 1; step <= 5; step++) {
    cout << "Check step " << step << endl;
  }
  return 0;
}$code$, array['Change the loop to run 8 times.', 'Print the square of each step.', 'Find the value that makes the loop stop.'], array['for', 'counter', 'loop condition'], array['Trace the first and last values before running.'], 'Write a loop that prints only the even steps.', 'Why is the update line important?'),
    (5, 'Week 5 Lab: Build a Function', 'week-5-lab-build-a-function', array['Write a function signature', 'Pass parameters', 'Return a result'], 'Turn repeated work into a named function.', 'A function has one clear job and a name that explains that job.', array['Parameters are the inputs.', 'The return value is the answer.', 'A function can be tested by itself.'], $code$#include <iostream>
using namespace std;

int add(int a, int b) {
  return a + b;
}

int main() {
  cout << "Total: " << add(4, 7) << endl;
  return 0;
}$code$, $code$#include <iostream>
using namespace std;

int add(int a, int b) {
  return a + b;
}

int main() {
  cout << "Total: " << add(4, 7) << endl;
  return 0;
}$code$, array['Call add with two different pairs.', 'Change the function to multiply.', 'Write the expected answer before running.'], array['function', 'parameter', 'return'], array['Give the function one job.', 'Check the result with values you know.'], 'Add a function called double and call it with 6.', 'Why is a function easier to test than a long main?'),
    (6, 'Week 6 Lab: Walk Through an Array', 'week-6-lab-walk-through-array', array['Create an array', 'Use an index', 'Print every value'], 'Store related readings in one array and visit each value.', 'An array keeps values together and gives each one an index.', array['The first index is 0.', 'The loop counter can be used as an index.', 'The loop must stop before the array ends.'], $code$#include <iostream>
using namespace std;

int main() {
  int readings[3] = {120, 240, 360};
  for (int index = 0; index < 3; index++) {
    cout << readings[index] << endl;
  }
  return 0;
}$code$, $code$#include <iostream>
using namespace std;

int main() {
  int readings[3] = {120, 240, 360};
  for (int index = 0; index < 3; index++) {
    cout << readings[index] << endl;
  }
  return 0;
}$code$, array['Add a fourth reading.', 'Print the index with the reading.', 'Calculate the total of the readings.'], array['array', 'index', 'for loop'], array['An array index starts at zero.', 'The loop condition must use < size.'], 'Print the readings in reverse by walking the index backwards.', 'What happens if the loop uses index <= 3?'),
    (7, 'Week 7 Lab: Button Logic', 'week-7-lab-button-logic', array['Set a pin as output', 'Read a button value', 'Control an LED decision'], 'Translate a button state into a clear LED action.', 'The input tells the program what happened. The decision tells it what to do.', array['INPUT_PULLUP means a pressed button reads LOW.', 'Configure each pin once in setup.', 'Keep the loop easy to read.'], $code$#include <iostream>
using namespace std;

int main() {
  int buttonPressed = 0;
  if (buttonPressed == 1) {
    cout << "LED on" << endl;
  } else {
    cout << "LED off" << endl;
  }
  return 0;
}$code$, $code$#include <iostream>
using namespace std;

int main() {
  int buttonPressed = 0;
  if (buttonPressed == 1) {
    cout << "LED on" << endl;
  } else {
    cout << "LED off" << endl;
  }
  return 0;
}$code$, array['Change buttonPressed to 1.', 'Add a second condition for a long press.', 'Explain what the hardware version would read.'], array['input', 'condition', 'output'], array['Name the input before writing the decision.'], 'Add a branch that blinks twice when the button is pressed.', 'Why is a pull-up button value inverted?'),
    (8, 'Week 8 Lab: Calibrate a Threshold', 'week-8-lab-calibrate-threshold', array['Use a sample reading', 'Compare it with a threshold', 'Explain the calibration choice'], 'Turn a changing sensor reading into a reliable decision.', 'A threshold should come from measurements, not a guess.', array['Record several readings first.', 'Place the threshold in the gap between groups.', 'Test near the boundary to find flicker.'], $code$#include <iostream>
using namespace std;

int main() {
  int reading = 280;
  int darkThreshold = 400;
  if (reading < darkThreshold) {
    cout << "Light on" << endl;
  } else {
    cout << "Light off" << endl;
  }
  return 0;
}$code$, $code$#include <iostream>
using namespace std;

int main() {
  int reading = 280;
  int darkThreshold = 400;
  if (reading < darkThreshold) {
    cout << "Light on" << endl;
  } else {
    cout << "Light off" << endl;
  }
  return 0;
}$code$, array['Try readings 399, 400, and 401.', 'Move the threshold to 300.', 'Write a sentence about the choice.'], array['analog reading', 'threshold', 'calibration'], array['Test the values on both sides of the threshold.'], 'Add a second threshold for a very dark reading.', 'Why can a threshold near a real reading cause flicker?'),
    (9, 'Week 9 Lab: Distance Decision', 'week-9-lab-distance-decision', array['Read a distance value', 'Check a safe distance', 'Choose a safe action'], 'Connect a distance reading to a robot action.', 'A robot becomes useful when a reading changes what it does next.', array['Read the sensor first.', 'Compare the reading with a safe limit.', 'Act with a small, explainable movement.'], $code$#include <iostream>
using namespace std;

int main() {
  int distance = 18;
  if (distance < 15) {
    cout << "Reverse and turn" << endl;
  } else {
    cout << "Turn away" << endl;
  }
  return 0;
}$code$, $code$#include <iostream>
using namespace std;

int main() {
  int distance = 18;
  if (distance < 15) {
    cout << "Reverse and turn" << endl;
  } else {
    cout << "Turn away" << endl;
  }
  return 0;
}$code$, array['Try distances 14, 15, and 30.', 'Add a forward branch for clear space.', 'Name the safe action for each branch.'], array['HC-SR04', 'distance', 'decision'], array['Use a book or wall to check a real distance.'], 'Add a branch that stops when the distance is below 5.', 'Why should the closest distance be checked first?'),
    (10, 'Week 10 Lab: Safe Actuator Chain', 'week-10-lab-safe-actuator-chain', array['Read a sensor value', 'Decide an action', 'Write the actuator command'], 'Connect a reading to a safe actuator action.', 'A good actuator chain keeps the power decision separate from the logic decision.', array['The microcontroller decides.', 'The driver or relay carries the power.', 'Never power a motor from a logic pin.'], $code$#include <iostream>
using namespace std;

int main() {
  int lightLevel = 250;
  if (lightLevel < 300) {
    cout << "Open gate" << endl;
  } else {
    cout << "Keep gate closed" << endl;
  }
  return 0;
}$code$, $code$#include <iostream>
using namespace std;

int main() {
  int lightLevel = 250;
  if (lightLevel < 300) {
    cout << "Open gate" << endl;
  } else {
    cout << "Keep gate closed" << endl;
  }
  return 0;
}$code$, array['Change the light level to 350.', 'Add a message for the actuator state.', 'Draw the power path beside the code.'], array['actuator', 'relay', 'power safety'], array['Separate the logic decision from the power circuit.'], 'Add a second condition that closes the gate at night.', 'What can be damaged if a motor is connected directly to a logic pin?'),
    (11, 'Week 11 Lab: Irrigation Decision', 'week-11-lab-irrigation-decision', array['Average soil readings', 'Compare the average', 'Control a pump decision'], 'Make a watering decision from several readings instead of one noisy value.', 'Averaging makes the decision steadier.', array['Read several samples.', 'Calculate one average.', 'Only then compare the average with the dry threshold.'], null, null, array['List the readings you would collect.', 'Choose a dry threshold.', 'Explain the soak delay.'], array['average', 'threshold', 'pump safety'], array['Smooth the reading before deciding.'], 'Add a daylight condition so watering only happens during the day.', 'Why is one noisy reading a poor pump decision?'),
    (12, 'Week 12 Lab: Feeder Timing', 'week-12-lab-feeder-timing', array['Track elapsed time', 'Compare with an interval', 'Act without blocking the loop'], 'Use time to automate a feeder while keeping the program responsive.', 'A timer lets the program decide when work is due.', array['Store the last feed time.', 'Compare elapsed time with the interval.', 'Keep buttons and sensors responsive.'], null, null, array['Write down the feeding interval.', 'Draw the timer state.', 'Explain what a manual override should do.'], array['millis', 'interval', 'override'], array['Do not wait with a long blocking delay when a timer will do.'], 'Add a manual feed button and a status message.', 'Why is a timer better than a long delay for a feeder?'),
    (13, 'Week 13 Lab: Robot Movement', 'week-13-lab-robot-movement', array['Write a movement function', 'Set speed', 'Stop safely'], 'Turn a movement idea into a function that can be tested alone.', 'Predictable movement is the base of every robot project.', array['Name the direction clearly.', 'Keep the speed in one place.', 'Always stop after the movement.'], $code$#include <iostream>
using namespace std;

int main() {
  int speed = 150;
  cout << "Forward at speed " << speed << endl;
  cout << "Stop" << endl;
  return 0;
}$code$, $code$#include <iostream>
using namespace std;

int main() {
  int speed = 150;
  cout << "Forward at speed " << speed << endl;
  cout << "Stop" << endl;
  return 0;
}$code$, array['Change the speed.', 'Print a left turn and a stop.', 'List the movement functions you would test.'], array['movement', 'speed', 'stop'], array['Test one movement at a time.'], 'Add a reverse movement message with a different speed.', 'Why must a robot stop at the end of a movement function?'),
    (14, 'Week 14 Lab: Fix a Motor Direction', 'week-14-lab-fix-motor-direction', array['Read the expected direction', 'Compare it with reality', 'Correct the wiring or code'], 'Debug a robot that moves in the wrong direction.', 'When hardware and code disagree, test the simplest physical cause first.', array['Check the wheel direction.', 'Check the driver input labels.', 'Change one thing and retest.'], $code$#include <iostream>
using namespace std;

int main() {
  bool forward = false;
  if (forward) {
    cout << "Robot should move forward" << endl;
  } else {
    cout << "Robot is moving backward" << endl;
  }
  return 0;
}$code$, $code$#include <iostream>
using namespace std;

int main() {
  bool forward = false;
  if (forward) {
    cout << "Robot should move forward" << endl;
  } else {
    cout << "Robot is moving backward" << endl;
  }
  return 0;
}$code$, array['Change forward to true.', 'Write the first physical check.', 'Write the first code check.'], array['debugging', 'polarity', 'motor'], array['Power, enable, pins, then code.'], 'Add a message that tells the admin which check failed.', 'Why is swapping a motor pair often faster than rewriting code?'),
    (15, 'Week 15 Lab: Map Remote Commands', 'week-15-lab-map-remote-commands', array['Read a command code', 'Map the code to an action', 'Keep a safe default'], 'Turn button codes into deliberate robot actions.', 'Every command needs one clear action, and unknown commands need a safe stop.', array['Print the raw code first.', 'Map one code at a time.', 'Make the default case stop.'], $code$#include <iostream>
using namespace std;

int main() {
  int command = 1;
  if (command == 1) {
    cout << "Forward" << endl;
  } else {
    cout << "Stop" << endl;
  }
  return 0;
}$code$, $code$#include <iostream>
using namespace std;

int main() {
  int command = 1;
  if (command == 1) {
    cout << "Forward" << endl;
  } else {
    cout << "Stop" << endl;
  }
  return 0;
}$code$, array['Map command 2 to reverse.', 'Add an unknown command branch.', 'Explain why stop must be the default.'], array['command', 'mapping', 'safe default'], array['Map one command at a time.'], 'Add a speed value to the forward command.', 'Why must an emergency stop be reachable?'),
    (16, 'Week 16 Lab: Avoid an Obstacle', 'week-16-lab-avoid-an-obstacle', array['Measure distance', 'Choose a branch', 'Turn into clear space'], 'Build the first complete sense, think, and act robot loop.', 'Obstacle avoidance is a small decision table that protects the robot.', array['Sense before deciding.', 'Turn before the robot gets too close.', 'Choose the safer branch when readings are close.'], $code$#include <iostream>
using namespace std;

int main() {
  int distance = 12;
  if (distance < 15) {
    cout << "Reverse then turn" << endl;
  } else {
    cout << "Keep moving" << endl;
  }
  return 0;
}$code$, $code$#include <iostream>
using namespace std;

int main() {
  int distance = 12;
  if (distance < 15) {
    cout << "Reverse then turn" << endl;
  } else {
    cout << "Keep moving" << endl;
  }
  return 0;
}$code$, array['Try clear, near, and very close distances.', 'Add a left scan before turning.', 'Write the SENSE, THINK, and ACT labels.'], array['SENSE', 'THINK', 'ACT'], array['Test each decision branch separately.'], 'Add a recovery branch for when both sides are blocked.', 'Why is a very close distance different from a near distance?'),
    (17, 'Week 17 Lab: Draw a State Machine', 'week-17-lab-draw-state-machine', array['Name robot states', 'Draw transitions', 'Test one transition at a time'], 'Organize robot behaviour so one state is active at a time.', 'A state diagram makes difficult robot behaviour easier to understand.', array['Name each state with a verb.', 'Draw the condition beside every arrow.', 'Test every arrow once.'], null, null, array['Draw DRIVE, AVOID, and TURN.', 'Write the transition conditions.', 'Choose which transition to test first.'], array['state machine', 'transition', 'design'], array['Draw before coding.'], 'Add a HOME state and its return path.', 'Why is one active state easier to debug than several overlapping behaviours?'),
    (18, 'Week 18 Lab: Plan a Cleaning Sweep', 'week-18-lab-plan-cleaning-sweep', array['Plan a coverage pattern', 'Set a lane width', 'Stop safely'], 'Plan robot movement so the floor is covered instead of missed.', 'A planned sweep is more reliable than random movement.', array['Draw the lanes first.', 'Keep the turns consistent.', 'Stop when the area is complete.'], null, null, array['Draw a three-lane sweep.', 'Mark the turn points.', 'Explain what happens if a wheel slips.'], array['coverage', 'pattern', 'recovery'], array['Plan the path before tuning the motors.'], 'Add a stall check that stops the robot.', 'Why does random movement leave gaps?'),
    (19, 'Week 19 Lab: Chase a Ball', 'week-19-lab-chase-a-ball', array['Read a direction', 'Centre the ball', 'Push toward the goal'], 'Turn a sensor direction into a useful soccer robot action.', 'A chase works best when the robot approaches the target from the centre.', array['Centre first.', 'Push second.', 'Change one tuning value per test.'], $code$#include <iostream>
using namespace std;

int main() {
  int direction = 0;
  if (direction < 0) {
    cout << "Turn left" << endl;
  } else if (direction > 0) {
    cout << "Turn right" << endl;
  } else {
    cout << "Push forward" << endl;
  }
  return 0;
}$code$, $code$#include <iostream>
using namespace std;

int main() {
  int direction = 0;
  if (direction < 0) {
    cout << "Turn left" << endl;
  } else if (direction > 0) {
    cout << "Turn right" << endl;
  } else {
    cout << "Push forward" << endl;
  }
  return 0;
}$code$, array['Try negative, zero, and positive direction.', 'Add a scan action when the ball is lost.', 'Change one speed value and record the result.'], array['direction', 'chase', 'iteration'], array['Test the centred case first.'], 'Add a corner escape action.', 'Why should the robot centre the ball before pushing?'),
    (20, 'Week 20 Lab: Run a Robot Checklist', 'week-20-lab-run-robot-checklist', array['Write a pre-run checklist', 'Record a failure', 'Repeat the test'], 'Prepare like an engineer before the final robot challenge.', 'A checklist turns a nervous guess into a repeatable routine.', array['Check power first.', 'Check wiring second.', 'Test movement before the timed run.'], null, null, array['Write a five-item checklist.', 'Run a practice attempt.', 'Record one failure and one fix.'], array['checklist', 'practice', 'documentation'], array['Use the same checklist every run.'], 'Add a final requirement that proves the robot meets the goal.', 'Why is a documented failure useful?'),
    (21, 'Week 21 Lab: Prove a Connection', 'week-21-lab-prove-a-connection', array['Connect to a network', 'Print proof of connection', 'Keep credentials private'], 'Connect an ESP32 safely and prove that it is online.', 'A connection is useful only when the device can show that it is ready.', array['Start the connection once.', 'Wait for the connected state.', 'Print the assigned address as proof.'], $code$#include <iostream>
using namespace std;

int main() {
  bool connected = true;
  if (connected) {
    cout << "ESP32 is connected" << endl;
  } else {
    cout << "Waiting for connection" << endl;
  }
  return 0;
}$code$, $code$#include <iostream>
using namespace std;

int main() {
  bool connected = true;
  if (connected) {
    cout << "ESP32 is connected" << endl;
  } else {
    cout << "Waiting for connection" << endl;
  }
  return 0;
}$code$, array['Change connected to false.', 'Add a retry message.', 'Write where a real password should be stored.'], array['ESP32', 'connection', 'credentials'], array['Never put a password in shared code.'], 'Add a sensor value to the connected message.', 'Why should credentials stay outside the shared sketch?'),
    (22, 'Week 22 Lab: Test an Alarm State', 'week-22-lab-test-alarm-state', array['Name alarm states', 'Test each transition', 'Keep a safe default'], 'Build a security system whose behaviour can be tested one transition at a time.', 'A state machine is only trustworthy when every arrow has a test.', array['Name the states.', 'Write the transition conditions.', 'Return to a safe state after the alarm.'], null, null, array['Draw ARM, TRIGGERED, and DISARM.', 'Write one test for each transition.', 'Explain what happens after a power cut.'], array['alarm', 'state machine', 'testing'], array['Walk the full cycle once.'], 'Add a tamper state and a test case.', 'Which transition would be most dangerous to leave untested?'),
    (23, 'Week 23 Lab: Write the Capstone Plan', 'week-23-lab-write-capstone-plan', array['Define a user need', 'List inputs and outputs', 'Set a measurable success test'], 'Turn a large idea into a small system that can be finished.', 'A good plan limits the inputs, the decision, and the outputs.', array['Name the user.', 'Write one measurable need.', 'Give every part a job.'], null, null, array['Write the problem in one sentence.', 'List two inputs, one decision, and two outputs.', 'Write the test that proves success.'], array['planning', 'scope', 'testing'], array['Small and finished is stronger than large and unfinished.'], 'Cut the plan to half and check that it still solves the need.', 'Why does a measurable test make a project easier to finish?'),
    (24, 'Week 24 Lab: Test, Improve, and Demonstrate', 'week-24-lab-test-improve-demonstrate', array['Run a full test twice', 'Record a fix', 'Explain the result clearly'], 'Finish the course by testing honestly and presenting what you learned.', 'A demonstration is stronger when it shows evidence, not only a final result.', array['Run the checklist twice.', 'Record what changed.', 'Explain the system in a clear order.'], null, null, array['Run the requirement test once.', 'Find one improvement.', 'Prepare a three-minute explanation.'], array['testing', 'improvement', 'demonstration'], array['A second run proves repeatability.'], 'Add a final improvement that you would make with more time.', 'Which test gave you the most useful evidence?')
) as lab(
  week_number,
  title,
  slug,
  objectives,
  goal,
  explanation,
  paragraphs,
  example_code,
  starter_code,
  activities,
  skills,
  hints,
  challenge,
  reflection
)
  on lab.week_number = weeks.week_number
where course.slug = 'cpp-embedded-robotics'
on conflict (week_id, lesson_number) do update set
  title = excluded.title,
  slug = excluded.slug,
  objectives = excluded.objectives,
  content = excluded.content,
  published = true,
  sort_order = 3;
