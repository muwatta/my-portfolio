-- C++ Programming for Embedded Systems & Robotics: full manual curriculum.
-- Spreads the complete 24-week manual across the existing course content model:
--   * rich lesson content jsonb (paragraphs, examples, activities, hints,
--     challenge, reflection, skills) for every week
--   * a guided exercise for fifteen coding weeks
--   * the eight flagship projects plus the capstone engineering project
--   * the ten learner levels used by the manual
-- Content is seeded UNPUBLISHED so an admin must publish each lesson before it
-- appears in the students' LMS. Idempotent: safe to re-run.

-- ---------------------------------------------------------------
-- 0. Schema compatibility
-- ---------------------------------------------------------------
-- These columns were introduced by an earlier local migration that is not
-- present in the current production migration history. Keep this migration
-- self-contained so it can safely seed the C++ curriculum.
alter table public.academy_courses
  add column if not exists short_description text,
  add column if not exists course_type text not null default 'programming',
  add column if not exists curriculum jsonb not null default '[]'::jsonb;

alter table public.academy_weeks
  add column if not exists description text not null default '',
  add column if not exists published boolean not null default true,
  add column if not exists sort_order integer not null default 0;

alter table public.academy_lessons
  add column if not exists published boolean not null default true,
  add column if not exists sort_order integer not null default 0;

alter table public.academy_exercises
  add column if not exists published boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists difficulty text not null default 'beginner';

-- ---------------------------------------------------------------
-- 1. Course metadata
-- ---------------------------------------------------------------
update public.academy_courses
set short_description = 'A practical 24-week journey from first C++ lines to working robots: programming, Arduino, sensors, actuators, and a capstone engineering project.',
    course_type = 'robotics',
    curriculum = jsonb_build_array(
      jsonb_build_object('phase', 'Programming & Engineering Foundations', 'weeks', jsonb_build_array(1,2,3,4)),
      jsonb_build_object('phase', 'Functions, Arrays & Arduino', 'weeks', jsonb_build_array(5,6,7,8)),
      jsonb_build_object('phase', 'Sensors, Actuators & Automation', 'weeks', jsonb_build_array(9,10,11,12)),
      jsonb_build_object('phase', 'Robotics Fundamentals', 'weeks', jsonb_build_array(13,14,15,16)),
      jsonb_build_object('phase', 'Advanced Robotics Projects', 'weeks', jsonb_build_array(17,18,19,20)),
      jsonb_build_object('phase', 'ESP32 & Smart Systems', 'weeks', jsonb_build_array(21,22)),
      jsonb_build_object('phase', 'Capstone Engineering Project', 'weeks', jsonb_build_array(23,24))
    )
where slug = 'cpp-embedded-robotics';

-- ---------------------------------------------------------------
-- 2. Week descriptions
-- ---------------------------------------------------------------
update public.academy_weeks as weeks
set description = curriculum.description
from public.academy_courses as course,
     (
       values
         (1, 'Hardware, software, and algorithms. The Input → Processing → Output pattern, flowcharts, and the very first C++ program.'),
         (2, 'Variables, fundamental data types, and arithmetic, comparison, and logical operators in C++.'),
         (3, 'if / else if / else, switch, and logical conditions — choosing what a program does based on real inputs.'),
         (4, 'for, while, and do-while loops: repeating work reliably, with countdowns, LED simulations, and menus.'),
         (5, 'Breaking programs into named, reusable functions with parameters and return values.'),
         (6, 'Arrays and loop-based data processing: storing readings, calculating averages, minimums, and maximums.'),
         (7, 'setup() and loop(), digital pins, and building the very first hardware project: LED Control.'),
         (8, 'Reading analog values, using thresholds to make decisions, calibrating a light sensor, and an Automatic Night Light.'),
         (9, 'Digital and analog sensors in depth: push buttons, potentiometers, LDRs, and the HC-SR04 ultrasonic distance sensor.'),
         (10, 'Actuators: buzzers, servo motors, DC motors, and relays — including PWM and motor-driver safety.'),
         (11, 'Project 4: Automatic Farm Irrigation System — soil moisture, relay, pump, safe power separation, and debouncing.'),
         (12, 'Project 5: Automatic Animal / Poultry Feeder — timed feeding with a servo and safely separated power.'),
         (13, 'Robotics fundamentals: the 2WD chassis, motor-driver wiring, and reusable movement functions.'),
         (14, 'Building and testing the 2WD chassis: forward, reverse, turning, and debugging motor direction.'),
         (15, 'Project 2: the 2WD Remote-Controlled Car — mapping remote commands to movement functions.'),
         (16, 'Project 3: the Obstacle-Avoiding Robot — ultrasonic sensing, movement decisions, and the SENSE → THINK → ACT cycle.'),
         (17, 'Autonomous navigation: planning behaviour, combining sensors and movement, and testing systematically.'),
         (18, 'Project 6: the Automatic Floor-Mopping Robot — sequencing movement to complete a practical task.'),
         (19, 'Project 7: the Soccer Robot — designing game behaviour, hunting a ball, and iterating after testing.'),
         (20, 'The Robotics Challenge — combining every skill to debug and demonstrate a complete robot.'),
         (21, 'ESP32 smart systems: WiFi and Bluetooth on a microcontroller, connected sensing, and safe projects.'),
         (22, 'Project 8: Smart Home / Security System — sensors, decisions, alerts, and an ESP32 IoT farm monitor.'),
         (23, 'Capstone design: defining a problem, planning a team solution, and selecting inputs, processing, and outputs.'),
         (24, 'Capstone build, systematic testing, debugging, and the final demonstration.')
     ) as curriculum(week_number, description)
where curriculum.week_number = weeks.week_number
  and weeks.course_id = course.id
  and course.slug = 'cpp-embedded-robotics';

-- ---------------------------------------------------------------
-- 3. Rich lesson content for all 24 weeks
--    Seeded as DRAFT (published = false) so an admin publishes each.
-- ---------------------------------------------------------------
insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, published, sort_order)
select
  weeks.id,
  curriculum.title,
  curriculum.slug,
  1,
  curriculum.objectives,
  curriculum.content,
  false,
  0
from public.academy_weeks weeks
join public.academy_courses course on course.id = weeks.course_id
join (
  values
    (1, 'Level 1: Thinking Like a Programmer', 'level-1-thinking-like-a-programmer',
      array['Understand hardware, software, and algorithms', 'Draw and interpret simple flowcharts', 'Use the Input-Processing-Output pattern', 'Write and execute a first C++ program'],
      jsonb_build_object(
        'phase', 'Programming & Engineering Foundations',
        'pattern', 'Input → Processing → Output',
        'explanation', 'Before writing code, engineers think like programmers: they break real problems into hardware, software, and the precise steps called algorithms.',
        'paragraphs', jsonb_build_array(
          'Hardware is the physical machine — the Arduino board, wires, and sensors. Software is the set of instructions (the program) that tells the hardware what to do. A computer cannot guess what you want; it only follows exact steps in order.',
          'An algorithm is that exact, ordered list of steps. The universal pattern behind almost every embedded program is Input → Processing → Output: read a signal from the world, decide something about it, then act — blink an LED, drive a motor, or print a message.',
          'Engineers draw flowcharts to plan algorithms before coding. Ovals mark start/end, rectangles mark actions, and diamonds mark decisions with yes/no branches. A clear flowchart prevents the most common beginner bug: forgetting a step or branching the wrong way.'
        ),
        'examples', jsonb_build_array(
          '#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello, engineer!" << endl;\n  cout << "Next step: algorithms." << endl;\n  return 0;\n}'
        ),
        'activities', jsonb_build_array(
          'Describe a morning routine as an algorithm with three exact steps.',
          'Draw a flowchart for "wait for a button press, then turn on a light".',
          'Change the program so it prints your name and age.'
        ),
        'skills', jsonb_build_array('hardware vs software', 'algorithms', 'flowcharts', 'Input-Processing-Output', 'first C++ program'),
        'hints', jsonb_build_array('Algorithms must be small enough to check step by step.', 'Flowcharts use one shape for actions and another for decisions.'),
        'project', 'Algorithm and flowchart for an everyday process such as boiling water or crossing a road safely.',
        'challenge', 'Write a flowchart for a hand-washing station: senses hands, decides, and tells the student to wash for a set time.',
        'reflection', 'A computer cannot guess. When did an assumption about your own programme cause a wrong output?'
      )
    ),
    (2, 'Level 2: C++ Fundamentals', 'level-2-cpp-fundamentals',
      array['Declare variables and choose data types', 'Perform arithmetic, comparison, and logical operations', 'Understand how data types affect embedded systems'],
      jsonb_build_object(
        'phase', 'Programming & Engineering Foundations',
        'skills', jsonb_build_array('variables', 'data types', 'arithmetic', 'comparisons', 'logical operations'),
        'explanation', 'Variables are named boxes that hold values. In C++ every box has a type that decides what it can store and how much memory it uses — critical when a microcontroller has very little RAM.',
        'paragraphs', jsonb_build_array(
          'The core types are int (whole numbers), float and double (decimal numbers), char (a single character), bool (true/false), and string (text). Choosing the right type saves precious memory: an Arduino has only 2 KB of RAM, so a byte of int stored wastefully can matter.',
          'Operators combine values into new ones. Arithmetic operators (+, -, *, /, %) calculate; comparison operators (==, !=, <, >, <=, >=) produce true or false; logical operators (&&, ||, !) combine true/false tests into bigger conditions.',
          'Integer division is a classic trap: in C++, 7 / 2 equals 3, not 3.5, because both values are ints. Mixing types matters — use doubles when you need fractions. Detect that trap by testing rather than assuming.'
        ),
        'examples', jsonb_build_array(
          '#include <iostream>\nusing namespace std;\n\nint main() {\n  int sensors = 3;\n  double temperature = 24.5;\n  bool isDark = sensors > 0;\n\n  cout << "Sensors: " << sensors << endl;\n  cout << "Temperature: " << temperature << endl;\n  cout << "Is dark: " << boolalpha << isDark << endl;\n  return 0;\n}'
        ),
        'activities', jsonb_build_array(
          'Declare a variable for each type and print them all.',
          'Print the result of 7 / 2 and then 7 / 2.0 — notice the difference.',
          'Combine two comparisons with && and print the result.'
        ),
        'project', 'C++ fundamentals challenge',
        'hints', jsonb_build_array('Check the data type before you divide!', 'Use double when an answer needs decimals.'),
        'challenge', 'Declare a double called elbowAngle, an int called ledCount, and a bool called isCalibrated. Print them, then print whether ledCount is even.',
        'reflection', 'Why can the same number mean different things depending on the type you choose?'
      )
    ),
    (3, 'Level 3: Decision Making', 'level-3-decision-making',
      array['Use if, else if, and else statements', 'Combine conditions with logical operators', 'Choose between if-else chains and switch statements', 'Debug conditional logic'],
      jsonb_build_object(
        'phase', 'Programming & Engineering Foundations',
        'skills', jsonb_build_array('if', 'else if', 'else', 'switch', 'logical operators'),
        'explanation', 'Programs do different things in different situations. Conditions branch the program: if a sensor is dark, switch the light on; otherwise leave it off.',
        'paragraphs', jsonb_build_array(
          'An if statement runs its block only when the condition is true. Adding else if lets you test many cases in order, and else catches everything that matched nothing. The order matters: the first matching branch wins.',
          'Logical operators combine tests: && (both must be true), || (at least one true), and ! (flip a truth value). "Water the plant if soil is dry AND it is day time" is a natural if (soilDry && isDay).',
          'When you are comparing one exact value against many possibilities — a menu choice, a robot state — a switch statement is cleaner and often faster than a long if-else chain. Remember: in C++ you almost always need a break after each case.'
        ),
        'examples', jsonb_build_array(
          'int lightLevel = 45;\nint threshold = 50;\nbool isAutomatic = true;\n\nif (isAutomatic && lightLevel < threshold) {\n  cout << "Turn the lamp ON" << endl;\n} else if (isAutomatic) {\n  cout << "Enough light; lamp OFF" << endl;\n} else {\n  cout << "Manual mode" << endl;\n}\n\nint choice = 2;\nswitch (choice) {\n  case 1: cout << "Forward" << endl; break;\n  case 2: cout << "Stop" << endl; break;\n  default: cout << "Unknown" << endl;\n}'
        ),
        'activities', jsonb_build_array(
          'Write an if-else that prints PASS when a score is 50 or more.',
          'Expand it to distinction (75+) using else if.',
          'Rewrite a three-way menu with switch instead of if-else.'
        ),
        'project', 'Automatic Traffic-Light Decision System',
        'hints', jsonb_build_array('Test the boundary values: exactly 50, exactly 75.', 'Trace each branch by hand before running.'),
        'challenge', 'Build the logic for a smart lens: if it is dark AND motion is detected, print "Security light ON"; if only dark, print "Preparing"; else "Bright".',
        'reflection', 'Which bug appears when branch order is wrong, and how do you find it?'
      )
    ),
    (4, 'Level 4: Loops', 'level-4-loops',
      array['Use for, while, and do-while loops', 'Choose a loop for a repetition problem', 'Recognise infinite-loop and off-by-one errors'],
      jsonb_build_object(
        'phase', 'Programming & Engineering Foundations',
        'skills', jsonb_build_array('for', 'while', 'do-while'),
        'explanation', 'Loops repeat instructions a controlled number of times. Embedded programs loop constantly — Arduino''s own loop() restarts forever so the robot senses and reacts continuously.',
        'paragraphs', jsonb_build_array(
          'The for loop is best when you know the count: for (int i = 1; i <= 5; i++). It has three parts — start, condition, and update — in one readable line.',
          'A while loop repeats while a condition stays true, ideal when the amount of repetition depends on sensor input, like waiting until a button is pressed. A do-while always runs its body at least once before testing, which suits "do this until that" flows.',
          'Two classic bugs: infinite loops (condition never becomes false — the robot never stops) and off-by-one errors (looping 6 times when you meant 5). Both are found by testing the first, last, and boundary iterations.'
        ),
        'examples', jsonb_build_array(
          '// Countdown\nfor (int i = 5; i >= 1; i--) {\n  cout << i << endl;\n}\ncout << "Launch!" << endl;\n\n// Wait for a signal\nint attempts = 0;\nwhile (attempts < 3) {\n  cout << "Checking..." << endl;\n  attempts++;\n}\n\n// Menu that runs at least once\ndo {\n  cout << "Choose 1 or 2: ";\n  // read choice...\n} while (choice != 1 && choice != 2);'
        ),
        'activities', jsonb_build_array(
          'Print numbers 1 to 10 with a for loop.',
          'Convert the countdown to a while loop.',
          'Spot and fix an off-by-one error your partner writes.'
        ),
        'project', 'Countdown, LED Simulation & Simple Menu',
        'hints', jsonb_build_array('For: update step lives at the end of the header.', 'To stop a while loop, something inside must change the condition.'),
        'challenge', 'Simulate a countdown where the user can press a button to skip. Print "Skipped to launch" and jump straight to launch.',
        'reflection', 'Describe the difference between a loop that runs 5 times and one that "runs while a sensor reads dark".'
      )
    ),
    (5, 'Level 5: Functions', 'level-5-functions',
      array['Design functions that solve one clear problem', 'Use parameters and return values', 'Organise complex programs into named functions'],
      jsonb_build_object(
        'phase', 'Functions, Arrays & Arduino',
        'skills', jsonb_build_array('functions', 'parameters', 'return values'),
        'explanation', 'A function is a named block of reusable instructions. Good functions do one job, take inputs as parameters, and return a result — keeping big programs readable.',
        'paragraphs', jsonb_build_array(
          'Calling a function runs its body where the call appears, so the same behaviour can be reused a hundred times without copying code. A function with no return value is declared void; one that computes something declares its return type, like double.',
          'Parameters are the function''s inputs, written in its signature: double average(double a, double b). The calling code passes values (arguments) in the same order.',
          'Functions make robot code testable: you can test moveForward(200) on its own before wiring a single motor. In Arduino, helper functions sit below loop() and are only "known" by the time they are called — or declared above it.'
        ),
        'examples', jsonb_build_array(
          '#include <iostream>\nusing namespace std;\n\ndouble average(double a, double b) {\n  return (a + b) / 2.0;\n}\n\nvoid announce(int reading) {\n  cout << "Reading: " << reading << endl;\n}\n\nint main() {\n  announce(42);\n  double result = average(10, 20);\n  cout << "Average: " << result << endl;\n  return 0;\n}'
        ),
        'activities', jsonb_build_array(
          'Write a function that returns the double of a number.',
          'Write a void function that prints a sensor label.',
          'Call both functions with three different values.'
        ),
        'project', 'Reusable robot movement functions',
        'hints', jsonb_build_array('Choose one clear job per function.', 'Give parameters descriptive names like delayMs, not just x.'),
        'challenge', 'Write squareArea(double side) and tipFor(double bill) where tip is 10%, then print both for test values.',
        'reflection', 'When is a loop the better tool than a function, and vice versa?'
      )
    ),
    (6, 'Level 6: Arrays and Basic Data Handling', 'level-6-arrays-and-basic-data-handling',
      array['Store related values in arrays', 'Iterate through arrays with loops', 'Calculate averages, minimums, and maximums'],
      jsonb_build_object(
        'phase', 'Functions, Arrays & Arduino',
        'skills', jsonb_build_array('arrays', 'loop-based processing', 'aggregate values'),
        'explanation', 'Arrays hold many values of the same type in one variable, indexed from 0. Loops and arrays belong together: the loop visits every index so the program can process the whole collection.',
        'paragraphs', jsonb_build_array(
          'Declare an array with a size: int readings[5]; or with values: double temps[] = {23.1, 24.0, 22.8}. Index 0 is the first element and index size-1 is the last.',
          'A for loop that runs from 0 to the size minus 1 can sum the values, find the biggest, or count how many pass a threshold. Assigning these aggregates is the same skill used to average five soil-moisture readings before the robot decides to water.',
          'Watch the bounds: reading index size is undefined behaviour in C++ — the program may silently use garbage memory. Always loop i < size, never i <= size.'
        ),
        'examples', jsonb_build_array(
          '#include <iostream>\nusing namespace std;\n\nint main() {\n  double temps[] = {23.1, 24.0, 22.8, 25.5};\n  int n = 4;\n  double total = 0;\n  double minimum = temps[0];\n\n  for (int i = 0; i < n; i++) {\n    total += temps[i];\n    if (temps[i] < minimum) minimum = temps[i];\n  }\n\n  cout << "Average: " << total / n << endl;\n  cout << "Minimum: " << minimum << endl;\n  return 0;\n}'
        ),
        'activities', jsonb_build_array(
          'Add a fifth reading to the array and re-run.',
          'Extend the loop to also print the maximum value.',
          'Count how many readings are above 24.0.'
        ),
        'project', 'Process a set of sensor readings',
        'hints', jsonb_build_array('Start minimum at the first element, not at 999.', 'Remember arrays begin at index 0.'),
        'challenge', 'Store five soil readings in an array. Print the average and print "DRY" if the average is below 400.',
        'reflection', 'Why is looping an array safer than writing five separate variables?'
      )
    ),
    (7, 'Level 7: Arduino Fundamentals', 'level-7-arduino-fundamentals',
      array['Explain Arduino setup and loop', 'Configure digital pins', 'Control digital outputs and read digital inputs'],
      jsonb_build_object(
        'phase', 'Functions, Arrays & Arduino',
        'skills', jsonb_build_array('setup', 'loop', 'pinMode', 'digitalRead', 'digitalWrite'),
        'explanation', 'An Arduino program has two compulsory functions: setup() runs once to configure pins, and loop() runs forever so the program keeps sensing and reacting.',
        'paragraphs', jsonb_build_array(
          'Every pin you use must be configured in setup() with pinMode(pin, OUTPUT) or pinMode(pin, INPUT). Writing to a pin uses digitalWrite(pin, HIGH/LOW); reading a button uses digitalRead(pin).',
          'Genuine input needs more thought: a raw button "floats" between on and off. Use pinMode(pin, INPUT_PULLUP) so the internal resistor pulls the pin HIGH until the button connects it to GND — then digitalRead returns LOW when pressed. This inverted logic surprises beginners.',
          'The classic first project — Project 1: LED Control — connects an LED through a resistor to a digital pin and uses delay() inside loop() to blink it. Delay blocks the whole program, which is fine for one LED but matters when several jobs must run at once.'
        ),
        'examples', jsonb_build_array(
          'const int ledPin = 13;\nconst int buttonPin = 2;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n  pinMode(buttonPin, INPUT_PULLUP);\n}\n\nvoid loop() {\n  if (digitalRead(buttonPin) == LOW) {\n    digitalWrite(ledPin, HIGH); // pressed\n  } else {\n    digitalWrite(ledPin, LOW);\n  }\n}'
        ),
        'activities', jsonb_build_array(
          'Flash the LED on and off with delay(500).',
          'Make the LED stay on only while the button is pressed.',
          'Add a second LED that blinks at a different speed.'
        ),
        'project', 'Project 1: LED Control',
        'hints', jsonb_build_array('INPUT_PULLUP inverts the button logic; test both values.', 'An LED needs a resistor (220-330 ohm) to avoid burn-out.'),
        'challenge', 'Wire two LEDs. Blink the green one every 500 ms and the red one every 1000 ms, using two loops that run "at the same time" by interleaving.',
        'reflection', 'Why does the order of digitalWrite and delay change how a blink looks?'
      )
    ),
    (8, 'Level 8: Analog Sensing', 'level-8-analog-sensing',
      array['Read analog values', 'Use thresholds in hardware decisions', 'Calibrate a light sensor against real conditions'],
      jsonb_build_object(
        'phase', 'Functions, Arrays & Arduino',
        'skills', jsonb_build_array('analogRead', 'thresholds', 'calibration'),
        'explanation', 'Analog sensors return a continuous range instead of a simple on/off. analogRead() returns 0 to 1023; the skill is turning that number into a sensible hardware decision.',
        'paragraphs', jsonb_build_array(
          'The ADC inside the microcontroller samples a voltage between 0 and 5 V and maps it to an integer from 0 to 1023. A light-dependent resistor (LDR) makes the voltage change with brightness: bright room reads high (or low, depending on wiring), darkness reads the opposite.',
          'A threshold turns the analog stream into a decision: if (analogRead(ldrPin) < threshold) turn the light on. The Automatic Night Light project uses exactly this logic to switch a lamp when darkness falls.',
          'Calibration beats guessing. On day one, read the sensor in bright sun, in shadow, and at night, and record the real values. Then choose a threshold in the middle of the gap. A calibrated threshold keeps the light from flickering at dawn and dusk.'
        ),
        'examples', jsonb_build_array(
          'const int ldrPin = A0;\nconst int ledPin = 9;\nint darkThreshold = 400; // calibrate for your room!\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  int reading = analogRead(ldrPin);\n  Serial.println(reading);\n\n  if (reading < darkThreshold) {\n    digitalWrite(ledPin, HIGH);  // night light ON\n  } else {\n    digitalWrite(ledPin, LOW);\n  }\n  delay(200);\n}'
        ),
        'activities', jsonb_build_array(
          'Print analogRead(A0) while you cover the sensor with your hand.',
          'Record values in three different light levels.',
          'Set a threshold between the recorded bright and dark values.'
        ),
        'project', 'Automatic Night Light',
        'hints', jsonb_build_array('Use the Serial Monitor to calibrate.', 'A threshold too close to your day value causes flicker.'),
        'challenge', 'Calibrate the night light so it turns ON only when the room is genuinely dark, and add a 300 ms delay loop to stop it flickering near the threshold.',
        'reflection', 'Why is a measured, calibrated threshold better than an invented number?'
      )
    ),
    (9, 'Level 8: Sensors in Depth', 'level-9-sensors-in-depth',
      array['Explain digital and analog sensors', 'Read buttons, potentiometers, LDRs, and ultrasonic distance', 'Connect sensor readings to real-world applications'],
      jsonb_build_object(
        'phase', 'Sensors, Actuators & Automation',
        'sensors', jsonb_build_array('push button', 'potentiometer', 'LDR', 'HC-SR04 ultrasonic sensor'),
        'pattern', 'SENSE → THINK → ACT',
        'explanation', 'Every robotics behaviour follows the pattern SENSE → THINK → ACT: read a sensor, decide, then move. Mastering each sensor type lets you build any of the course''s projects.',
        'paragraphs', jsonb_build_array(
          'Push buttons are digital sensors: two values, pressed or released. Potentiometers are analog sensors that turn a knob into a 0-1023 value — ideal for volume or speed control. LDRs measure light; HC-SR04 ultrasonic sensors measure distance by sending an ultrasonic pulse and timing the echo.',
          'The HC-SR04 needs a little program: send a 10-microsecond pulse on Trig, wait for the Echo pin to go HIGH, and measure how long until it goes LOW. Distance in cm = (us / 2) / 29.1, because sound travels 29.1 cm per 1000 microseconds and the pulse makes a round trip.',
          'Multiple sensors are combined by reading them all in loop() and letting the decision stage (if statements) weigh them. An obstacle-avoiding robot reads distance, decides "too close", and acts: turn instead of driving forward.'
        ),
        'examples', jsonb_build_array(
          'const int trig = 12;\nconst int echo = 11;\n\nlong readDistanceCm() {\n  digitalWrite(trig, LOW);\n  delayMicroseconds(2);\n  digitalWrite(trig, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(trig, LOW);\n\n  long duration = pulseIn(echo, HIGH);\n  return duration / 29.1 / 2;\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(trig, OUTPUT);\n  pinMode(echo, INPUT);\n}\n\nvoid loop() {\n  long distance = readDistanceCm();\n  Serial.print("Distance: ");\n  Serial.println(distance);\n  delay(100);\n}'
        ),
        'activities', jsonb_build_array(
          'Test ultrasonic distance at 10 cm, 20 cm, and 50 cm.',
          'Read a potentiometer and map 0-1023 into a servo angle range.',
          'Combine an LDR and a button into one SENSE step that reads both.'
        ),
        'project', 'Sensor reference: measure, record, apply',
        'hints', jsonb_build_array('A pulseIn timeout avoids hanging forever.', 'Divide by 2 because the pulse travels to the object and back.'),
        'challenge', 'Build a simple distance alarm: if the ultrasonic sensor reads under 30 cm, print "CLOSE" and turn on a red LED.',
        'reflection', 'Which of the four sensors is digital and which are analog? How would you detect each one in code?'
      )
    ),
    (10, 'Level 9: Actuators', 'level-10-actuators',
      array['Control buzzers, servos, motors, and relays', 'Explain PWM and motor-driver safety', 'Build a sensor-triggered actuator chain'],
      jsonb_build_object(
        'phase', 'Sensors, Actuators & Automation',
        'actuators', jsonb_build_array('buzzer', 'servo', 'DC motor', 'relay'),
        'skills', jsonb_build_array('analogWrite', 'PWM', 'motor driver'),
        'explanation', 'Actuators are the "ACT" in SENSE → THINK → ACT: they produce motion, sound, or switching. Connecting them safely is the most important engineering habit you will build.',
        'paragraphs', jsonb_build_array(
          'Servos turn to an exact angle (0 to 180 degrees) using the Servo library — perfect for pointing sensors or pushing feeder gates. DC motors spin continuously; a servo expects a 50 Hz pulse, but a DC motor needs far more current than an Arduino pin can supply.',
          'That is why motor drivers exist. A driver like the L298N takes a small logic signal from the Arduino and switches the motor''s full supply voltage. You control speed with PWM — analogWrite(pin, speed) where speed is 0 to 255 — and direction, typically, with two enable/input pins.',
          'Relays switch high-power devices (lamps, pumps) exactly like a remote-controlled switch: a small signal energises a coil that closes a mechanical contact. Always separate the low-power logic ground behaviour from the high-power circuit and protect everyone involved with clear wiring and fuses.'
        ),
        'examples', jsonb_build_array(
          '#include <Servo.h>\nServo gate;\nconst int ldrPin = A0;\n\nvoid setup() {\n  gate.attach(9);\n  gate.write(0);\n}\n\nvoid loop() {\n  int light = analogRead(ldrPin);\n  if (light > 600) {\n    gate.write(90); // open the feeder gate\n  } else {\n    gate.write(0);\n  }\n  delay(30);\n}'
        ),
        'activities', jsonb_build_array(
          'Sweep a servo from 0 to 180 and back.',
          'Vary a DC motor speed from 0 to 255 with PWM.',
          'Trigger a buzzer for 1 second when the LDR goes dark.'
        ),
        'project', 'Sensor-Triggered Actuator',
        'hints', jsonb_build_array('Servos draw power; give them their own supply.', 'Never power a motor from the Arduino 5V pin.'),
        'challenge', 'Chain: an ultrasonic sensor detects a hand within 20 cm → servo turns 90 → buzzer beeps twice → then everything returns to idle.',
        'reflection', 'What would happen if you connected a DC motor straight to an Arduino pin instead of through a driver?'
      )
    ),
    (11, 'Project 4: Automatic Farm Irrigation System', 'project-4-automatic-farm-irrigation-system',
      array['Read and calibrate a soil-moisture sensor', 'Control a relay and pump with a threshold', 'Separate pump power safely', 'Prevent rapid switching'],
      jsonb_build_object(
        'phase', 'Sensors, Actuators & Automation',
        'project', 'Automatic Farm Irrigation System',
        'pattern', 'Soil moisture sensor → Arduino → relay → water pump',
        'explanation', 'This first applied automation project waters a plant automatically: a soil-moisture sensor feeds the decision and a relay-controlled pump does the watering.',
        'paragraphs', jsonb_build_array(
          'Soil-moisture sensors measure how easily electricity passes between two probes. Dry soil reads a high value (often 800+); wet soil reads low (often 300-400). Raw readings drift with probe depth, so calibrate in real soil, not across a cup of water.',
          'The Arduino compares the average of several readings against a threshold. When dry, it triggers the relay which turns the pump on. Two engineering rules matter here: debounce the threshold so the pump does not click on and off every second, and give the pump its own power source — never draw it through the Arduino.',
          'Good automation also has limits: pump for ten seconds at a time, then wait before reading again, so watering happens in controlled bursts rather than continuous flicks.'
        ),
        'examples', jsonb_build_array(
          'const int sensorPin = A0;\nconst int relayPin = 7;\nint dryThreshold = 600;\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(relayPin, OUTPUT);\n}\n\nvoid loop() {\n  long total = 0;\n  for (int i = 0; i < 5; i++) {\n    total += analogRead(sensorPin);\n    delay(50);\n  }\n  int soil = total / 5;\n  Serial.println(soil);\n\n  if (soil > dryThreshold) {\n    digitalWrite(relayPin, HIGH); // pump on\n    delay(10000);                 // water for 10 s\n    digitalWrite(relayPin, LOW);  // pump off\n    delay(60000);                 // let it soak\n  } else {\n    digitalWrite(relayPin, LOW);\n  }\n  delay(1000);\n}'
        ),
        'activities', jsonb_build_array(
          'Record sensor values in dry and wet soil.',
          'Set the threshold between the two recorded groups.',
          'Test the 10-second pump cycle and describe what you observed.'
        ),
        'hints', jsonb_build_array('Average several readings to smooth noise.', 'Keep the pump separate from the Arduino power.'),
        'challenge', 'Add a buzzer that beeps three times when the pump starts, and make the system water only during daylight using the LDR from Level 8.',
        'reflection', 'Why does smoothing several readings make the whole irrigation decision more reliable?'
      )
    ),
    (12, 'Project 5: Automatic Animal / Poultry Feeder', 'project-5-automatic-animal-poultry-feeder',
      array['Apply sensor and actuator control to an automated feeder', 'Use timing and safe power separation', 'Test and debug an automation system'],
      jsonb_build_object(
        'phase', 'Sensors, Actuators & Automation',
        'project', 'Automatic Animal / Poultry Feeder',
        'explanation', 'This project turns the servo skills from Level 10 into a timing-based system: at set times of day, open the feeder gate so pellets fall, then close it again.',
        'paragraphs', jsonb_build_array(
          'Instead of reacting to a sensor, an automatic feeder reacts to time. Keep a running timer in milliseconds using millis() rather than delay(), so the same sketch can also read buttons and update a display while the feeder waits.',
          'The feeding cycle is: wait until the target time, move the servo to open the gate, count down the feeding duration, then close it. Using millis()-based comparisons — if ((unsigned long)(now - lastFeed) > interval) — keeps the loop responsive.',
          'Include a manual override button: real systems need human control. A button press immediately triggers a feeding, and the sketch still remembers when the last automatic feed happened.'
        ),
        'examples', jsonb_build_array(
          '#include <Servo.h>\nServo gate;\nconst unsigned long feedInterval = 3600000; // 1 hour\nunsigned long lastFeed = 0;\n\nvoid setup() {\n  gate.attach(9);\n  gate.write(0);\n  lastFeed = millis();\n}\n\nvoid loop() {\n  unsigned long now = millis();\n  if (now - lastFeed >= feedInterval) {\n    gate.write(90);     // open\n    delay(5000);        // drop the feed\n    gate.write(0);      // close\n    lastFeed = now;\n  }\n}'
        ),
        'activities', jsonb_build_array(
          'Change the interval to a few seconds and test the cycle.',
          'Add a servo "chute" position halfway open.',
          'Protect the feeder so it stops if the servo stalls.'
        ),
        'hints', jsonb_build_array('Use millis(), not delay(), so the loop stays responsive.', 'Let an override button force a feed immediately.'),
        'challenge', 'Add an override button and an LED that stays lit while the gate is open, then confirm the system still auto-feeds afterwards.',
        'reflection', 'When must an automation run on time rather than on sensor input?'
      )
    ),
    (13, 'Level 10: Robotics Fundamentals', 'level-10-robotics-fundamentals',
      array['Explain a 2WD robot chassis', 'Use a motor driver safely', 'Write reusable movement functions', 'Test movement one step at a time'],
      jsonb_build_object(
        'phase', 'Robotics Fundamentals',
        'skills', jsonb_build_array('2WD chassis', 'motor driver', 'movement functions'),
        'project', 'Build and test a moving robot',
        'explanation', 'A 2WD robot combines two driven wheels and a free-rolling wheel or ball caster. The Arduino controls each motor through a driver, and movement is built from four primitives: forward, reverse, left, and right turns.',
        'paragraphs', jsonb_build_array(
          'The motor driver receives direction and speed commands from the Arduino. To move forward, both drive wheels spin forward; to turn left on the spot, the left wheel reverses while the right goes forward. Mapping those two-pin signals into named functions keeps the rest of the code readable.',
          'Write movement functions first — moveForward(speed, duration), moveReverse, turnLeft, turnRight, stop — and test each one alone before any sensors are added. A robot that cannot move predictably cannot avoid obstacles.',
          'Speed control uses PWM: both wheels should be sent the same number so the robot drives straight. Slight motor differences mean the robot may drift; a calibration offset on one side fixes it.'
        ),
        'examples', jsonb_build_array(
          'const int enA = 5;\nconst int in1 = 6;\nconst int in2 = 7;\n\nvoid setMotor(int speed) {\n  analogWrite(enA, speed);\n}\n\nvoid moveForward(int speed, int duration) {\n  digitalWrite(in1, HIGH);\n  digitalWrite(in2, LOW);\n  setMotor(speed);\n  delay(duration);\n  setMotor(0);\n}\n\nvoid setup() {\n  pinMode(enA, OUTPUT);\n  pinMode(in1, OUTPUT);\n  pinMode(in2, OUTPUT);\n}\n\nvoid loop() {\n  moveForward(150, 1000);\n  delay(1000);\n}'
        ),
        'activities', jsonb_build_array(
          'Test moveForward(150, 1000) on the bench.',
          'Test turnLeft and confirm the robot rotates on the spot.',
          'Measure how far the robot drives in one second.'
        ),
        'hints', jsonb_build_array('Test one movement function at a time.', 'Keep both wheels at the same PWM speed to drive straight.'),
        'challenge', 'Write a movement function test: forward 1 second, stop, reverse 1 second, stop, left turn, right turn — proving every primitive works.',
        'reflection', 'Why do we build and test the chassis before adding any sensor or autonomy code?'
      )
    ),
    (14, '2WD Chassis and Movement', '2wd-chassis-and-movement',
      array['Assemble a 2WD chassis', 'Control forward, reverse, and turning movement', 'Debug motor direction and wiring'],
      jsonb_build_object(
        'phase', 'Robotics Fundamentals',
        'project', '2WD chassis build and movement testing',
        'explanation', 'Assembling and debugging the physical chassis is where theory meets reality: two motors, one driver, batteries, and spinning wheels that must all behave.',
        'paragraphs', jsonb_build_array(
          'Mount the motors so both wheels sit flush, then wire each motor to its driver output pair. If forward makes the robot drive backwards, the simplest debug step is swapping that motor''s two drive wires — not rewriting all the code.',
          'A classic direction bug: because the motors are mounted facing opposite ways, "forward" on the left motor and "forward" on the right motor can be opposite physical wheels. Add a comment in code marking which pin is forward for each motor.',
          'Set the driver to the lowest reliable PWM (around 100-150) while testing. Higher speed hides wiring problems and flings the robot across the room before you can debug.'
        ),
        'examples', jsonb_build_array(
          '// Movement test: mark the physical direction of each motor\nconst int in1 = 6; // LEFT motor forward\nconst int in2 = 7; // LEFT motor reverse\nconst int in3 = 8; // RIGHT motor forward\nconst int in4 = 9; // RIGHT motor reverse\n\nvoid stop() {\n  digitalWrite(in1, LOW); digitalWrite(in2, LOW);\n  digitalWrite(in3, LOW); digitalWrite(in4, LOW);\n}\n\nvoid forward(int speed, int ms) {\n  digitalWrite(in1, HIGH); digitalWrite(in2, LOW);\n  digitalWrite(in3, HIGH); digitalWrite(in4, LOW);\n  analogWrite(enableLeft, speed);\n  analogWrite(enableRight, speed);\n  delay(ms);\n  stop();\n}'
        ),
        'activities', jsonb_build_array(
          'Confirm the robot drives straight for two metres.',
          'Make it turn exactly 90 degrees (adjust the delay).',
          'Swap one motor pair and observe the direction change.')
        'hints', jsonb_build_array('Slow speed first, then increase.', 'Swapping physical wires is faster than swapping code.'),
        'challenge', 'Drive a precise square: forward + 90-degree left turn, repeated four times. Adjust the turn delay until the robot returns to its start.',
        'reflection', 'Which is more likely to be wrong when a robot reverses instead of going forward: code or wiring? How do you test it?'
      )
    ),
    (15, 'Project 2: 2WD Remote-Controlled Car', 'project-2-2wd-remote-controlled-car',
      array['Control a robot remotely', 'Map commands to movement functions', 'Test reliable movement and stopping'],
      jsonb_build_object(
        'phase', 'Robotics Fundamentals',
        'project', '2WD Remote-Controlled Car',
        'explanation', 'A remote-controlled robot is a sensor input (the controller), a decision stage (mapping commands), and the movement functions you already wrote.',
        'paragraphs', jsonb_build_array(
          'The controller — an IR remote, a Bluetooth module, or simple buttons — produces a code for each press. The program''s SENSE step reads that code, the THINK stage matches it with a switch statement, and the ACT stage calls the matching movement function.',
          'Map one command to exactly one movement, and add a "stop all" command that is always reachable, rather than making the robot drive until it hits a wall. Emergency stop is a safety habit from day one.',
          'Debounce the input so one press produces one command, and print the received code to the Serial Monitor the first time you test — decoded hex buttons beat guessing.'
        ),
        'examples', jsonb_build_array(
          '// Suppose the IR remote sends these codes\nswitch (command) {\n  case 0x00: moveForward(180, 300); break;\n  case 0x01: moveReverse(180, 300); break;\n  case 0x02: turnLeft(180, 250);    break;\n  case 0x03: turnRight(180, 250);   break;\n  case 0x04: stop();                break; // emergency stop\n  default:   stop();                break;\n}'
        ),
        'activities', jsonb_build_array(
          'Print the raw command code before mapping it.',
          'Test every command including the emergency stop.',
          'Make the robot react again (ignore repeats of the same key).'
        ),
        'hints', jsonb_build_array('Wire one input type at a time.', 'Always define and test an emergency stop command first.'),
        'challenge', 'Add a speed dial: a potentiometer read maps to the PWM speed so the same "forward" key moves slow or fast depending on the knob.',
        'reflection', 'Why is a single always-available stop command essential for any remote-controlled system?'
      )
    ),
    (16, 'Project 3: Obstacle-Avoiding Robot', 'project-3-obstacle-avoiding-robot',
      array['Read distance from an ultrasonic sensor', 'Make movement decisions from distance', 'Combine sensing, thinking, and acting'],
      jsonb_build_object(
        'phase', 'Robotics Fundamentals',
        'project', 'Obstacle-Avoiding Robot',
        'pattern', 'SENSE → THINK → ACT',
        'explanation', 'The obstacle-avoiding robot finally joins everything: it senses an obstacle, thinks about what to do, and acts — stepping into full autonomy.',
        'paragraphs', jsonb_build_array(
          'The HC-SR04 sensor, normally mounted on a servo, measures the distance ahead. The THINK stage is a decision ladder: if distance is small, turn; if very small, reverse first, then turn; otherwise drive forward.',
          'A servo-mounted sensor can look left and right, so the robot chooses the clearer direction: scan, pick the side with more room, and turn that way. This "choose the empty side" strategy is simple and effective for classroom robots.',
          'Tune real-world thresholds, not invented ones. Drive the robot at a wall and record the distances where each action should trigger, exactly as you calibrated the night light in Level 8.'
        ),
        'examples', jsonb_build_array(
          'long distance = readDistanceCm();\n\nif (distance > 30) {\n  moveForward(160, 200);      // clear road\n} else if (distance > 15) {\n  turnLeft(160, 200);         // getting close\n} else {\n  moveReverse(150, 300);      // too close\n  turnRight(160, 250);\n}'
        ),
        'activities', jsonb_build_array(
          'Record the sensor readings as a wall is approached.',
          'Test each of the three distance branches separately.',
          'Add a scan: measure left and right before choosing a turn.'
        ),
        'hints', jsonb_build_array('Let the robot turn before it is actually touching the wall.', 'Test with real distances, then tune.'),
        'challenge', 'Implement a scan-and-choose behaviour: before deciding, scan left and right, pick the larger space, and turn into it. If both are blocked, reverse.',
        'reflection', 'How does the SENSE → THINK → ACT pattern keep an autonomous behaviour simple to debug?'
      )
    ),
    (17, 'Autonomous Navigation', 'autonomous-navigation',
      array['Plan an autonomous robot behaviour', 'Combine movement and sensor logic', 'Test navigation systematically'],
      jsonb_build_object(
        'phase', 'Advanced Robotics Projects',
        'focus', 'Autonomous navigation',
        'explanation', 'Autonomous navigation turns a reactive robot into an intended-travel robot: it plans, follows, and corrects its route using sensor feedback.',
        'paragraphs', jsonb_build_array(
          'A state machine is the cleanest way to write navigation: the robot is in exactly one state at a time — DRIVE, AVOID, TURN, or FINISH — and each loop decides whether to switch states. Naming states keeps behaviour readable and testable.',
          'Navigation improves by layering corrections: the robot drives straight, and every sensor reading nudges the movement (PID-style steering) instead of only reacting at the last second. Even the simplest "turn a little if the line drifts" correction is real navigation.',
          'Testing is systematic: run the same course several times, record where it leaves the line each time, change ONE thing, and re-run. Change one variable at a time — the debugging discipline of Level 3.'
        ),
        'examples', jsonb_build_array(
          'enum RobotState { DRIVE, AVOID, TURN, FINISH };\nRobotState state = DRIVE;\n\nvoid loop() {\n  long distance = readDistanceCm();\n\n  switch (state) {\n    case DRIVE:\n      moveForward(160, 100);\n      if (distance < 25) state = AVOID;\n      break;\n    case AVOID:\n      turnRight(160, 250);\n      state = TURN;\n      break;\n    case TURN:\n      moveForward(160, 400);\n      state = DRIVE;\n      break;\n    default:\n      stop();\n  }\n}'
        ),
        'activities', jsonb_build_array(
          'Sketch the state machine before coding.',
          'Run the same maze three times and record failures.',
          'Change one threshold and compare the three runs.'
        ),
        'hints', jsonb_build_array('Draw the states and arrows first.', 'Name constants for your tuned thresholds.'),
        'challenge', 'Add a HOME state: after navigating an obstacle, the robot returns toward a beacon direction you measure with the servo-compass scan.',
        'reflection', 'Why does changing one variable at a time make navigation debugging more scientific?'
      )
    ),
    (18, 'Project 6: Automatic Floor-Mopping Robot', 'project-6-automatic-floor-mopping-robot',
      array['Apply robotics movement to a practical task', 'Plan a robot sequence', 'Test and improve a floor-mopping system'],
      jsonb_build_object(
        'phase', 'Advanced Robotics Projects',
        'project', 'Automatic Floor-Mopping Robot',
        'explanation', 'The mopping robot adds a physical payload to a reliable mover: a damp cloth or sponge underneath, a simple brush motor or wiper, and a pattern of movement that actually covers the floor.',
        'paragraphs', jsonb_build_array(
          'Cleaning robots need a pattern, not random driving. A simple S-shaped or back-and-forth lane sweep guarantees every strip of floor gets at least one pass, whereas random motion leaves gaps.',
          'The payload changes the robot: extra weight shifts the centre of gravity and drains batteries faster. Test movement with the mop attached, re-calibrate speeds and turn durations, and watch for slipping wheels on wet surfaces.',
          'Fail gracefully: if the robot loses a wheel or the mop snags, it should stop rather than drag itself. An end-stop or current-sensing pause is a realistic, safety-focused addition.'
        ),
        'examples', jsonb_build_array(
          '// Lane sweep: forward, short turn, forward the other way\nvoid sweep(int lanes) {\n  for (int lane = 0; lane < lanes; lane++) {\n    moveForward(140, 1500);\n    if (lane % 2 == 0) {\n      turnRight(140, 500);\n      moveForward(140, 200);\n      turnRight(140, 500);\n    } else {\n      turnLeft(140, 500);\n      moveForward(140, 200);\n      turnLeft(140, 500);\n    }\n  }\n  stop();\n}'
        ),
        'activities', jsonb_build_array(
          'Measure how far one lane sweep cleans in theory.',
          'Attach the mop and re-test the turn timing.',
          'Record skips and run the sweep again.'
        ),
        'hints', jsonb_build_array('Even lane spacing depends on accurate turns.', 'Dry-run the pattern before adding water or a mop.'),
        'challenge', 'Add a wet/dry mode button: dry mode sweeps once, wet mode sweeps twice with a wiper motor running between passes.',
        'reflection', 'Why does a predictable geometric pattern beat "just driving around" for a cleaning task?'
      )
    ),
    (19, 'Project 7: Soccer Robot', 'project-7-soccer-robot',
      array['Design robot behaviour for a game task', 'Combine movement, sensing, and control', 'Iterate after testing'],
      jsonb_build_object(
        'phase', 'Advanced Robotics Projects',
        'project', 'Soccer Robot',
        'explanation', 'A soccer robot competes: find the ball, chase it, and push it toward the goal — all through sensors, decisions, and quick movement with no remote control.',
        'paragraphs', jsonb_build_array(
          'Use an IR ball sensor (or three photodiodes) to tell whether the ball is ahead, to the left, or to the right. The strategy is: if ball centred, drive forward; if left, turn left; if right, turn right. This single decision rule makes surprisingly effective players.',
          'Turning toward the ball uses line-of-sight chasing: come at the ball with the sensor centred, not at an angle. Add goals of "find, then push" so the robot does not trap itself in a corner.',
          'Iteration wins matches: each test gives one tuning change — servo scan speed, chase speed, turning delay. Record the change, re-test, and keep the version that worked.'
        ),
        'examples', jsonb_build_array(
          'int ballReading(); // returns CENTER, LEFT, or RIGHT\n\nvoid loop() {\n  int direction = ballReading();\n  if (direction == CENTER) {\n    moveForward(200, 100);\n  } else if (direction == LEFT) {\n    turnLeft(180, 120);\n  } else if (direction == RIGHT) {\n    turnRight(180, 120);\n  } else {\n    scanForBall(); // rotate slowly to find it\n  }\n}'
        ),
        'activities', jsonb_build_array(
          'Test ball detection in three positions.',
          'Chase the ball across the room and count touches.',
          'Change one tuning value and compare scores.' ),
        'hints', jsonb_build_array('Centre the ball before pushing.', 'Record one change per test.'),
        'challenge', 'Add a goal-cornered escape: if no ball is seen, the robot spins the servo to find it, then returns to chasing — never stuck in a corner.',
        'reflection', 'How did the trial-and-error loop of one-change-per-test improve your soccer robot''s score?'
      )
    ),
    (20, 'Robotics Challenge', 'robotics-challenge',
      array['Apply course robotics skills to a challenge', 'Debug a complete robot system', 'Demonstrate a working solution'],
      jsonb_build_object(
        'phase', 'Advanced Robotics Projects',
        'project', 'Robotics Challenge',
        'explanation', 'The Robotics Challenge assembles every skill into one timed obstacle course under exam-like conditions — the rehearsal for capstone week.',
        'paragraphs', jsonb_build_array(
          'Treat the challenge like a real engineering test: check power, verify wiring, and run a ten-second sensor self-test before the clock starts. A robot that starts debugged always beats a slightly better robot that starts broken.',
          'Debug in layers. Confirm power first, then pins, then sensor readings in the Serial Monitor, then movement, and only then autonomy logic. This layering isolates failures fast, exactly as practised in Level 3.',
          'Show your work: explain the SENSE → THINK → ACT flow you used and point at the calibration values. Engineers are judged as much on clear explanation as on the working robot.'
        ),
        'examples', jsonb_build_array(
          'void selfTest() {\n  Serial.println("Power check");\n  delay(1000);\n  Serial.print("Distance: ");\n  Serial.println(readDistanceCm());\n  moveForward(120, 300);\n  stop();\n  Serial.println("Self-test complete");\n}\n\nvoid setup() {\n  Serial.begin(9600);\n  selfTest();\n}'
        ),
        'activities', jsonb_build_array(
          'Build a 90-second checklist for the challenge.',
          'Run a full practice attempt and log every failure.',
          'Present the solution to a partner in two minutes.'
        ),
        'hints', jsonb_build_array('Start debugged, then run.', 'Log one fix per attempt.'),
        'challenge', 'Complete the obstacle course: drive out, avoid two obstacles, cross the finish line in under two minutes, then present your SENSE → THINK → ACT diagram.',
        'reflection', 'What single habit made the biggest difference in your challenge result?'
      )
    ),
    (21, 'ESP32 & Smart Systems', 'esp32-and-smart-systems',
      array['Explain ESP32 capabilities', 'Connect embedded sensing to a smart system', 'Plan a connected system safely'],
      jsonb_build_object(
        'phase', 'ESP32 & Smart Systems',
        'hardware', 'ESP32',
        'explanation', 'The ESP32 brings WiFi and Bluetooth to the same GPIO world you already know, turning a sensing project into a truly connected smart system.',
        'paragraphs', jsonb_build_array(
          'The ESP32 is a fast, dual-core microcontroller with built-in WiFi and Bluetooth. Its GPIO pins use the same digitalWrite/analogRead model as the Arduino, plus extra features like touch sensors and DAC outputs, and it is programmable in Arduino C++ via the ESP32 board package.',
          'Connected systems follow the same SENSE → THINK → ACT pattern, with a new output: data. The ESP32 can publish sensor readings over WiFi (MQTT or HTTP) to a dashboard or mobile app — your ESP32 IoT Smart Farm Monitor works this way, reporting soil readings remotely.',
          'Safety before connectivity: never expose unused services, change default passwords, keep secrets out of hard-coded sketches, and always remember the high-power rules from Level 9 even when the system talks over WiFi.'
        ),
        'examples', jsonb_build_array(
          '#include <WiFi.h>\n\nconst char* ssid = "your-network";\nconst char* password = "your-password";\n\nvoid setup() {\n  Serial.begin(115200);\n  WiFi.begin(ssid, password);\n  while (WiFi.status() != WL_CONNECTED) {\n    delay(500);\n    Serial.print(".");\n  }\n  Serial.println("\\nConnected!");\n  Serial.println(WiFi.localIP());\n}\n\nvoid loop() {\n  Serial.println(analogRead(A0)); // publish this reading\n  delay(1000);\n}'
        ),
        'activities', jsonb_build_array(
          'Flash the WiFi-scan example and list visible networks.',
          'Connect to your network and print the IP address.',
          'Publish a sensor reading to the Serial Monitor every second.'
        ),
        'hints', jsonb_build_array('Watch the baud rate — ESP32 uses 115200, not 9600.', 'Keep credentials out of published code.'),
        'challenge', 'Connect the ESP32 to a Wi-Fi network and publish a soil-reading over HTTP for 30 seconds, then secure the sketch by moving the password into a separate secret header.',
        'reflection', 'What new risks appear when a sensing system can be reached over a network?'
      )
    ),
    (22, 'Project 8: Smart Home / Security System', 'project-8-smart-home-security-system',
      array['Build a smart home or security system', 'Combine sensors, decisions, and actuators', 'Test system states and alerts'],
      jsonb_build_object(
        'phase', 'ESP32 & Smart Systems',
        'project', 'Smart Home / Security System',
        'explanation', 'The smart security system combines a motion sensor, a light/door sensor, an alert output, and the ESP32-connected reporting of Week 21 into one coordinated household.',
        'paragraphs', jsonb_build_array(
          'Design as system states, not loose wires: ARM mode waits quietly, TRIGGERED mode blazouns an LED and buzzer when the PIR detects motion, and DISARM mode ignores sensors. A keypad, button, or app command moves the system between states.',
          'The security system teaches layering: a PIR for motion-plus-light, a reed switch for doors, a piezo buzzer and LEDs for alarms, and the ESP32 for remote status. Each layer is a SENSE/ACT pair joined by one THINK stage.',
          'Test every state transition deliberately: arm the system, trigger the alarm, disarm and confirm it silences. A security system is only as good as its tested failure modes — what happens when the power dips?'
        ),
        'examples', jsonb_build_array(
          'enum AlarmState { DISARM, ARM, TRIGGERED };\nAlarmState state = DISARM;\n\nvoid loop() {\n  bool motion = digitalRead(motionPin) == HIGH;\n\n  if (state == ARM && motion) {\n    state = TRIGGERED;\n  }\n  if (state == TRIGGERED) {\n    digitalWrite(alarmPin, HIGH); // sound the buzzer\n  } else {\n    digitalWrite(alarmPin, LOW);\n  }\n  // ...handle keypad to move state DISARM->ARM->DISARM\n}'
        ),
        'activities', jsonb_build_array(
          'Test the PIR sensor across the room.',
          'Map the three system states and their transitions.',
          'Trigger and silence the alarm to prove every state works.'
        ),
        'hints', jsonb_build_array('PIR sensors take a minute to stabilise.', 'Confirm the alarm LED/buzzer before adding the app.'),
        'challenge', 'Extend to the ESP32 IoT farm monitor: publish the security state and soil reading to an online dashboard, and test that the alarm also shows remotely.',
        'reflection', 'Why does testing every state transition matter for a security system in a way it does not for a night light?'
      )
    ),
    (23, 'Capstone Engineering Project', 'capstone-engineering-project',
      array['Define an original embedded or robotics problem', 'Plan a team-designed solution', 'Select suitable inputs, processing, and outputs'],
      jsonb_build_object(
        'phase', 'Capstone Engineering Project',
        'project', 'Team-designed original embedded/robotics system',
        'explanation', 'The capstone is the engineer''s exam: your team picks a real problem and designs an original system — problem, plan, components, build, test, and demonstration.',
        'paragraphs', jsonb_build_array(
          'Start with a problem statement, not a gadget. "Water the vegetable garden without wasting water and without electricity outages" beats "build a robot". A good problem has a user, a need, and a measurable success criterion.',
          'Design with SENSE → THINK → ACT: choose at most two or three inputs, one clear decision rule, and one or two outputs. Simple, well-executed systems win over ambitious but unfinished ones — constrain scope ruthlessly.',
          'Produce a realistic plan: a components (BOM) table with costs, a 2-3 week build-and-test timeline with milestones, and a risk column ("servo stalls", "battery drains") with a mitigation for each.'
        ),
        'examples', jsonb_build_array(
          'Project plan:\n\nProblem   : Water the school garden automatically and survive power cuts.\nInputs    : soil moisture (analog), LDR for daylight (analog)\nThink     : if dry AND daylight -> water for 10 s\nOutputs   : relay + pump, status LED, buzzer alert\nMilestones: W1 wiring, W2 calibration, W3 sealed test\nRisk      : pump current -> use relay + own supply'
        ),
        'activities', jsonb_build_array(
          'Write your one-sentence team problem statement.',
          'List inputs, THINK rules, and outputs in a table.',
          'Build the BOM with quantities and estimated cost.',
          'Set three milestones with clear completion tests.'
        ),
        'hints', jsonb_build_array('Small scope, finished project.', 'Every component on the BOM must have a job.'),
        'challenge', 'Submit the capstone design packet: problem statement, system diagram, BOM, timeline, and risk list, each no longer than half a page.',
        'reflection', 'How did the Input → Processing → Output pattern help you keep the design scope realistic?'
      )
    ),
    (24, 'Capstone Engineering Project: Testing and Demo', 'capstone-engineering-project-testing-and-demo',
      array['Build and test the capstone system', 'Debug failures systematically', 'Demonstrate and explain the final project'],
      jsonb_build_object(
        'phase', 'Capstone Engineering Project',
        'project', 'Team-designed original embedded/robotics system',
        'deliverable', 'Testing and demo',
        'explanation', 'The final week: build to the plan, test every requirement, debug failures with the layered method, and demo a finished system with pride.',
        'paragraphs', jsonb_build_array(
          'Build in the order  of your milestones and test each one before moving on: power, then wiring, then sensors, then the decision rule, then the output. Each milestone closed early makes the final weeks calm instead of frantic.',
          'When something fails, apply the layered debugging method from Level 3: power first, then pins, then sensor readings in the Serial Monitor, then logic. Change one variable at a time and keep a one-line log: what failed, what you changed, what happened.',
          'The demonstration answers four questions in under three minutes: What problem do you solve? How does SENSE → THINK → ACT work in your system? What did testing reveal and how did you fix it? What would you improve next?'
        ),
        'examples', jsonb_build_array(
          'Debug log:\n# 15:00 pump never started\n# changed: relay pin 7, had it on pin 3 (unused)\n# 15:05 pump starts on dry soil — PASS\n\n# 15:20 waters even in daylight\n# changed: added && daylight condition\n# 15:25 only waters when dry AND bright — PASS'
        ),
        'activities', jsonb_build_array(
          'Run your full requirement test checklist twice.',
          'Rehearse the three-minute demo in front of a partner.',
          'Collect one improvement idea for the future version.'
        ),
        'hints', jsonb_build_array('A working simple demo beats a broken complex one.', 'Log every failure - it becomes your presentation evidence.'),
        'challenge', 'Run the full final test: every requirement passes, every failure logged, and a smooth three-minute demonstration delivered to the panel.',
        'reflection', 'Which tested failure taught your team the most about real engineering?'
      )
    )
) as curriculum(week_number, title, slug, objectives, content)
  on curriculum.week_number = weeks.week_number
where course.slug = 'cpp-embedded-robotics'
on conflict (week_id, slug) do update set
  title = excluded.title,
  objectives = excluded.objectives,
  content = excluded.content,
  published = false,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------
-- 4. Exercises for fifteen coding weeks (seeded as drafts: admin
--    publishes them from the admin Practice page).
-- ---------------------------------------------------------------
insert into public.academy_exercises (
  lesson_id, title, instructions, starter_code, difficulty,
  expected_concepts, hints, explanation, tests, solution_code, published, sort_order
)
select
  lessons.id,
  exercise.title,
  exercise.instructions,
  exercise.starter_code,
  exercise.difficulty,
  exercise.expected_concepts,
  exercise.hints,
  exercise.explanation,
  '[]'::jsonb,
  exercise.solution_code,
  false,
  0
from public.academy_lessons lessons
join public.academy_weeks weeks on weeks.id = lessons.week_id
join public.academy_courses course on course.id = weeks.course_id
join (
  values
    (1, 'Hello, engineer!', 'Write a C++ program that prints "Hello, engineer!" and then "Next step: algorithms." on two separate lines.',
     '// print two lines here\n#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello, engineer!" << endl;\n  cout << "Next step: algorithms." << endl;\n  return 0;\n}',
     'beginner',
     array['cout', 'endl', 'main'],
     array['Each cout statement prints one line.', 'end newlines with endl.'],
     'This exercise checks that collections of instructions run in order. Copy the two output statements into main().', '[]'::jsonb,
     'cout << "Hello, engineer!" << endl;\ncout << "Next step: algorithms." << endl;'),
    (2, 'Data types quiz calculator', 'Declare an int, a double, and a bool. Print all three, then print the result of 7 / 2 and 7 / 2.0.',
     '#include <iostream>\nusing namespace std;\n\nint main() {\n  int count = 3;\n  double temp = 24.5;\n  bool ready = true;\n  cout << count << " " << temp << " " << ready << endl;\n  cout << 7 / 2 << endl;   // whole-number division\n  cout << 7 / 2.0 << endl; // fractional\n  return 0;\n}',
     'beginner',
     array['int', 'double', 'bool', 'division', 'operators'],
     array['Integer division truncates.', 'Using 2.0 forces floating-point division.'],
     'Demonstrates choosing types and the integer-division trap.', '[]'::jsonb,
     'int count = 3;\ndouble temp = 24.5;\nbool ready = true;\ncout << count << " " << temp << " " << ready << endl;\ncout << 7 / 2 << endl;\ncout << 7 / 2.0 << endl;'),
    (3, 'Branch the smart lens', 'Write an if/else chain that prints "Security light ON" when it is dark AND motion is detected, "Preparing" when it is only dark, and "Bright" otherwise.',
     'bool isDark = true;\nbool motion = true;\n\n// add your if/else chain here',
     'developing',
     array['if', 'else if', 'else', '&&', 'boolean'],
     array['Test the darkest+motion case first.', 'Use && for and.'],
     'Practises combining conditions with logical operators in the right branch order.', '[]'::jsonb,
     'if (isDark && motion) {\n  cout << "Security light ON" << endl;\n} else if (isDark) {\n  cout << "Preparing" << endl;\n} else {\n  cout << "Bright" << endl;\n}'),
    (4, 'Flexible countdown', 'Write a countdown from 5 down to 1 using a for loop, then the same countdown with a while loop, printing "Launch!" at the end of each.',
     '// for version\n// while version',
     'developing',
     array['for', 'while', 'countdown'],
     array['Start at 5, stop at 1, count down by 1.', 'The while loop needs its own counter variable.'],
     'Practises two equivalent loop forms and their differences.', '[]'::jsonb,
     'for (int i = 5; i >= 1; i--) {\n  cout << i << endl;\n}\ncout << "Launch!" << endl;\n\nint j = 5;\nwhile (j >= 1) {\n  cout << j << endl;\n  j--;\n}\ncout << "Launch!" << endl;'),
    (5, 'Functions playground', 'Write squareArea(double side) that returns side * side, and tipFor(double bill) that returns 10% of the bill. Print both results.',
     '#include <iostream>\nusing namespace std;\n\ndouble squareArea(double side) {\n  return side * side;\n}\n\ndouble tipFor(double bill) {\n  return bill * 0.10;\n}\n\nint main() {\n  cout << squareArea(4.0) << endl;\n  cout << tipFor(200.0) << endl;\n  return 0;\n}',
     'beginner',
     array['functions', 'return', 'parameters'],
     array['squareArea(4.0) should be 16.', 'tipFor(200.0) should be 20.'],
     'Combines parameters and return values in two small functions.', '[]'::jsonb,
     'double squareArea(double side) {\n  return side * side;\n}\ndouble tipFor(double bill) {\n  return bill * 0.10;\n}'),
    (6, 'Sensor readings summary', 'Write a program that stores five readings in a double array, then prints the average and the minimum using loops.',
     '#include <iostream>\nusing namespace std;\n\nint main() {\n  double readings[] = {310, 420, 380, 450, 330};\n  int n = 5;\n  double total = 0;\n  double minimum = readings[0];\n  for (int i = 0; i < n; i++) {\n    total += readings[i];\n    if (readings[i] < minimum) minimum = readings[i];\n  }\n  cout << "Average: " << total / n << endl;\n  cout << "Minimum: " << minimum << endl;\n  return 0;\n}',
     'developing',
     array['arrays', 'loops', 'aggregates'],
     array['Start minimum at readings[0].', 'Loop from index 0 to n-1.'],
     'Practises array iteration and aggregate calculations.', '[]'::jsonb,
     'double readings[] = {310, 420, 380, 450, 330};\nint n = 5;\ndouble total = 0;\ndouble minimum = readings[0];\nfor (int i = 0; i < n; i++) {\n  total += readings[i];\n  if (readings[i] < minimum) minimum = readings[i];\n}'),
    (7, 'LED button control', 'Read a push button on pin 2 with INPUT_PULLUP and turn an LED on pin 13 on only while the button is pressed.',
     'const int ledPin = 13;\nconst int buttonPin = 2;\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n  pinMode(buttonPin, INPUT_PULLUP);\n}\n\nvoid loop() {\n  // if pressed (LOW) -> LED HIGH, else LOW\n}',
     'developing',
     array['pinMode', 'digitalRead', 'digitalWrite', 'INPUT_PULLUP'],
     array['With INPUT_PULLUP a press reads LOW.', 'Use if/else to set the LED.'],
     'Ctrl points: configuring pins, inverted pull-up logic, reacting continuously.', '[]'::jsonb,
     'void loop() {\n  if (digitalRead(buttonPin) == LOW) {\n    digitalWrite(ledPin, HIGH);\n  } else {\n    digitalWrite(ledPin, LOW);\n  }\n}'),
    (8, 'Calibrated night light', 'Read an LDR on A0, print the value, and turn an LED on pin 9 on only when the reading is below a 400 threshold.',
     'const int ldrPin = A0;\nconst int ledPin = 9;\nconst int darkThreshold = 400;\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  int reading = analogRead(ldrPin);\n  Serial.println(reading);\n  if (reading < darkThreshold) {\n    digitalWrite(ledPin, HIGH);\n  } else {\n    digitalWrite(ledPin, LOW);\n  }\n  delay(200);\n}',
     'developing',
     array['analogRead', 'thresholds', 'calibration'],
     array['analogRead returns 0-1023.', 'Below the threshold = dark.'],
     'Reads analog input calibrated against a physical threshold.', '[]'::jsonb,
     'int reading = analogRead(ldrPin);\nSerial.println(reading);\nif (reading < darkThreshold) {\n  digitalWrite(ledPin, HIGH);\n} else {\n  digitalWrite(ledPin, LOW);\n}'),
    (10, 'Servo gate opener', 'Use the Servo library to attach a servo on pin 9. Open it to 90 degrees when the LDR on A0 reads above 600, otherwise close to 0.',
     '#include <Servo.h>\nServo gate;\nconst int ldrPin = A0;\n\nvoid setup() {\n  gate.attach(9);\n}\n\nvoid loop() {\n  // add your threshold logic\n}',
     'challenge',
     array['Servo', 'attach', 'write', 'threshold'],
     array['gate.write(90) opens the gate.', 'Write 0 to close it.'],
     'Controls an actuator (servo) from a sensor (LDR) decision.', '[]'::jsonb,
     'int light = analogRead(ldrPin);\nif (light > 600) {\n  gate.write(90);\n} else {\n  gate.write(0);\n}\ndelay(30);'),
    (13, 'Movement primitives', 'Write moveForward(speed, duration) and turnLeft(speed, duration) for a 2WD robot, each ending with a stop, using the pin layout given.',
     'const int enA = 5;\nconst int in1 = 6; // left forward\nconst int in2 = 7; // left reverse\n\nvoid moveForward(int speed, int duration) {\n  digitalWrite(in1, HIGH);\n  digitalWrite(in2, LOW);\n  analogWrite(enA, speed);\n  delay(duration);\n  analogWrite(enA, 0);\n}\n\nvoid turnLeft(int speed, int duration) {\n  digitalWrite(in1, LOW);\n  digitalWrite(in2, HIGH);\n  analogWrite(enA, speed);\n  delay(duration);\n  analogWrite(enA, 0);\n}',
     'challenge',
     array['functions', 'motor driver', 'PWM', 'movement'],
     array['Reverse the inputs to turn.', 'Set speed to 0 at the end to stop.'],
     'Wraps motor-driver signals into reusable movement functions.', '[]'::jsonb,
     'void moveForward(int speed, int duration) {\n  digitalWrite(in1, HIGH); digitalWrite(in2, LOW);\n  analogWrite(enA, speed);\n  delay(duration);\n  analogWrite(enA, 0);\n}\nvoid turnLeft(int speed, int duration) {\n  digitalWrite(in1, LOW); digitalWrite(in2, HIGH);\n  analogWrite(enA, speed);\n  delay(duration);\n  analogWrite(enA, 0);\n}'),
    (15, 'Remote command mapping', 'Map four remote codes to movement functions using a switch statement, and always default to stop() for unknown or the emergency code.',
     'int command = 0x00;\n\nvoid moveForward(int, int);\nvoid moveReverse(int, int);\nvoid turnLeft(int, int);\nvoid turnRight(int, int);\nvoid stop();\n\nvoid handleCommand(int command) {\n  // add switch statement\n}',
     'challenge',
     array['switch', 'remote control', 'movement mapping'],
     array['Map each code to one movement.', 'Make any unknown code stop().'],
     'Maps external commands onto robot movement with safe defaults.', '[]'::jsonb,
     'switch (command) {\n  case 0x00: moveForward(180, 300); break;\n  case 0x01: moveReverse(180, 300); break;\n  case 0x02: turnLeft(180, 250); break;\n  case 0x03: turnRight(180, 250); break;\n  default: stop(); break;\n}'),
    (16, 'Obstacle decision ladder', 'Given a distance reading, drive forward when farther than 30 cm, turn left when closer, and reverse then turn right when under 15 cm.',
     'long distance = readDistanceCm();\n\n// add your decision ladder',
     'challenge',
     array['if else', 'thresholds', 'ultrasonic', 'reaction'],
     array['>30 drives forward.', '<=15 both reverses and turns.'],
     'Reacts to a sensed distance with the SENSE → THINK → ACT ladder.', '[]'::jsonb,
     'if (distance > 30) {\n  moveForward(160, 200);\n} else if (distance > 15) {\n  turnLeft(160, 200);\n} else {\n  moveReverse(150, 300);\n  turnRight(160, 250);\n}'),
    (19, 'Soccer chase rules', 'Implement the chase rule: CENTER drives forward, LEFT turns left, RIGHT turns right, and no-ball scans.',
     'int direction = ballReading(); // CENTER, LEFT, RIGHT, NONE\n\n// add chase decisions',
     'challenge',
     array['state decisions', 'chase logic', 'turn'],
     array['Centre the ball before pushing.', 'Scan only when no ball is seen.'],
     'Combines sensor direction with responsive movement choices.', '[]'::jsonb,
     'if (direction == CENTER) {\n  moveForward(200, 100);\n} else if (direction == LEFT) {\n  turnLeft(180, 120);\n} else if (direction == RIGHT) {\n  turnRight(180, 120);\n} else {\n  scanForBall();\n}'),
    (21, 'ESP32 connection check', 'Connect the ESP32 to WiFi and print its local IP address once connected.',
     '#include <WiFi.h>\n\nconst char* ssid = "your-network";\nconst char* password = "your-password";\n\nvoid setup() {\n  Serial.begin(115200);\n  WiFi.begin(ssid, password);\n  while (WiFi.status() != WL_CONNECTED) {\n    delay(500);\n    Serial.print(".");\n  }\n  Serial.println();\n  Serial.println(WiFi.localIP());\n}\n\nvoid loop() {}',
     'developing',
     array['WiFi.h', 'begin', 'status', 'localIP'],
     array['Wait until WL_CONNECTED.', 'Use Serial at 115200.'],
     'Introduces the connected microcontrollers world: verifying a real WiFi link.', '[]'::jsonb,
     'WiFi.begin(ssid, password);\nwhile (WiFi.status() != WL_CONNECTED) {\n  delay(500);\n}\nSerial.println(WiFi.localIP());'),
    (22, 'Security state machine', 'Write an alarm state machine: DISARM ignores motion, ARM triggers on motion, TRIGGERED sounds the buzzer until disarmed.',
     'enum AlarmState { DISARM, ARM, TRIGGERED };\nAlarmState state = DISARM;\nconst int motionPin = 2;\nconst int alarmPin = 9;\n\nvoid loop() {\n  bool motion = digitalRead(motionPin) == HIGH;\n  // add transitions and outputs\n}',
     'challenge',
     array['state machine', 'pins', 'conditions'],
     array['ARM + motion becomes TRIGGERED.', 'Buzzer HIGH only in TRIGGERED.'],
     'Builds a three-state security system with tested transitions.', '[]'::jsonb,
     'if (state == ARM && motion) state = TRIGGERED;\nif (state == TRIGGERED) digitalWrite(alarmPin, HIGH);\nelse digitalWrite(alarmPin, LOW);\n// (disarm sets state back to DISARM)')
) as exercise(week_number, title, instructions, starter_code, difficulty, expected_concepts, hints, explanation, tests, solution_code)
  on exercise.week_number = weeks.week_number
where course.slug = 'cpp-embedded-robotics'
  and lessons.lesson_number = 1
  and not exists (
    select 1 from public.academy_exercises existing
    where existing.lesson_id = lessons.id and existing.title = exercise.title
  );

-- ---------------------------------------------------------------
-- 5. Flagship projects plus the capstone, with milestones
-- ---------------------------------------------------------------
-- ---------------------------------------------------------------
insert into public.academy_projects (course_id, title, description)
select course.id, project.title, project.description
from public.academy_courses course
join (
  values
    ('Project 1: LED Control', 'First hardware build: wire an LED through a resistor and control it from a digital pin, with a button press to change its state.'),
    ('Automatic Night Light', 'An LDR and threshold logic switch a lamp on when the room grows dark — calibrated against real light levels.'),
    ('Project 4: Automatic Farm Irrigation System', 'A soil-moisture sensor, relay, and water pump keep the garden watered automatically, with debounced pump bursts and separated power.'),
    ('Project 5: Automatic Animal / Poultry Feeder', 'A servo-based gate opens on a millis() timer so animals are fed on schedule without supervision.'),
    ('Project 2: 2WD Remote-Controlled Car', 'The 2WD chassis answers a remote command by mapping inputs to its movement functions, with a reachable emergency stop.'),
    ('Project 3: Obstacle-Avoiding Robot', 'The HC-SR04 sensor plus the SENSE → THINK → ACT decision ladder steer the robot around walls autonomously.'),
    ('Project 6: Automatic Floor-Mopping Robot', 'The moving chassis carries a mop through a geometric lane sweep that covers the whole floor.'),
    ('Project 7: Soccer Robot', 'An IR ball sensor, chase decisions, and quick turning turn the robot into a competitive soccer player.'),
    ('Project 8: Smart Home / Security System', 'A PIR, reed switch, and buzzer form a three-state security system that also reports over ESP32 WiFi.'),
    ('ESP32 IoT Smart Farm Monitor', 'The ESP32 publishes soil readings to a dashboard so the garden can be supervised remotely.'),
    ('Capstone Engineering Project', 'A team-designed original embedded or robotics system: problem, plan, build, test, and demonstration.')
) as project(title, description) on true
where course.slug = 'cpp-embedded-robotics'
  and not exists (
    select 1 from public.academy_projects existing
    where existing.course_id = course.id and existing.title = project.title
  );

insert into public.academy_project_milestones (project_id, milestone_number, title)
select project.id, milestone.milestone_number, milestone.title
from public.academy_projects project
join public.academy_courses course on course.id = project.course_id
join (
  values
    ('Project 1: LED Control',
      '{"1":"Wire the LED and resistor with correct polarity","2":"Blink the LED with delay()","3":"Add button control of the LED"}'),
    ('Automatic Night Light',
      '{"1":"Read and print analog LDR values","2":"Calibrate the dark threshold","3":"Switch the lamp on darkness","4":"Stop flicker near the threshold"}'),
    ('Project 4: Automatic Farm Irrigation System',
      '{"1":"Read and average soil-moisture readings","2":"Wire relay and pump with separated power","3":"Run a 10-second debounced pump burst","4":"Water only in daylight"}'),
    ('Project 5: Automatic Animal / Poultry Feeder',
      '{"1":"Attach and test the servo gate","2":"Time feeding with millis()","3":"Add a manual override button","4":"Verify auto-feed continues after override"}'),
    ('Project 2: 2WD Remote-Controlled Car',
      '{"1":"Write the four movement primitives","2":"Wire one remote input type","3":"Map commands with a switch","4":"Test the emergency stop"}'),
    ('Project 3: Obstacle-Avoiding Robot',
      '{"1":"Mount and read the ultrasonic sensor","2":"Record real approach distances","3":"Build the decision ladder","4":"Scan left/right and choose the empty side"}'),
    ('Project 6: Automatic Floor-Mopping Robot',
      '{"1":"Attach the mop payload","2":"Re-test movement with the payload","3":"Run a geometric lane sweep","4":"Add wet/dry mode"}'),
    ('Project 7: Soccer Robot',
      '{"1":"Test ball detection positions","2":"Chase the centred ball","3":"Add corner-escape scanning","4":"Iterate one tuning change per test"}'),
    ('Project 8: Smart Home / Security System',
      '{"1":"Wire PIR, reed switch, and buzzer","2":"Implement the three alarm states","3":"Test every state transition","4":"Report security state over WiFi"}'),
    ('ESP32 IoT Smart Farm Monitor',
      '{"1":"Boot the ESP32 and connect to WiFi","2":"Publish soil readings to a dashboard","3":"Secure credentials in a header","4":"Demo remote monitoring"}'),
    ('Capstone Engineering Project',
      '{"1":"Define the problem and system diagram","2":"Finalise BOM, timeline, and risks","3":"Build and calibrate each milestone","4":"Pass the full requirement test","5":"Deliver the three-minute demo"}')
) as milestone(title, milestones) on milestone.title = project.title
join jsonb_each_text(milestone.milestones::jsonb) as m(key, value) on true
where course.slug = 'cpp-embedded-robotics'
  and not exists (
    select 1 from public.academy_project_milestones existing
    where existing.project_id = project.id and existing.milestone_number = m.key::smallint
  );