-- C++ course enrichment:
--   * publish ALL existing lessons (so students see the full robotics course)
--   * publish their weeks
--   * add one "Checkpoint" lesson (lesson_number = 2) to every week with a
--     review, a hands-on build step, hints, a challenge, and a reflection,
--     so each week becomes a richer ~5 hour block: Level/Project lesson +
--     Checkpoint build.
-- Idempotent: safe to re-run.

update public.academy_weeks weeks
set published = true,
    sort_order = case when weeks.sort_order = 0 then weeks.week_number else weeks.sort_order end
from public.academy_courses course
where course.id = weeks.course_id
  and course.slug = 'cpp-embedded-robotics';

update public.academy_lessons lessons
set published = true
from public.academy_weeks weeks
join public.academy_courses course on course.id = weeks.course_id
where lessons.week_id = weeks.id
  and course.slug = 'cpp-embedded-robotics';

insert into public.academy_lessons (week_id, title, slug, lesson_number, objectives, content, published, sort_order)
select
  weeks.id,
  checkpoint.title,
  checkpoint.slug,
  2,
  checkpoint.objectives,
  checkpoint.content,
  true,
  2
from public.academy_weeks weeks
join public.academy_courses course on course.id = weeks.course_id
join (
  values
    (1, 'Checkpoint 1: Algorithms and First Program', 'checkpoint-1-algorithms-and-first-program',
      array['Rewrite the Input → Processing → Output pattern in your own code', 'Draw and explain a flowchart for a real routine', 'Write a program that prints a short algorithm'],
      jsonb_build_object(
        'phase', 'Programming & Engineering Foundations',
        'explanation', 'Checkpoints turn what you read into what you can do. Without writing, reading is just looking.',
        'paragraphs', jsonb_build_array(
          'Take the week''s ideas and prove them: write a complete small program, then read it back out loud line by line.',
          'The Input → Processing → Output pattern is the backbone of every embedded program. State it for your own example before you code it.',
          'Keep the program tiny and correct. A perfect five-liner beats a broken thirty-liner.'
        ),
        'examples', jsonb_build_array(
          '#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "If water boils, tea is ready." << endl;\n  return 0;\n}'
        ),
        'activities', jsonb_build_array(
          'Write a flowchart for "dry hands, then leave the sink".',
          'Write a program that prints the three steps of that routine.',
          'Swap programs with a partner and explain each other''s flowchart.'
        ),
        'skills', jsonb_build_array('flowcharts', 'Input-Processing-Output', 'cout', 'reading code'),
        'hints', jsonb_build_array('Three exact steps is enough.', 'Print one step per line.', 'Start with an oval, actions in rectangles, decisions in diamonds.'),
        'challenge', 'Turn your flowchart into an if/else choice: if the water is hot, print "Careful!", else "Safe."',
        'reflection', 'Where did your program need an assumption (like water being hot) to make sense?'
      )
    ),
    (2, 'Checkpoint 2: Type Detective', 'checkpoint-2-type-detective',
      array['Match values to their C++ data types', 'Explain the integer-division trap', 'Write a program that picks a type for each value'],
      jsonb_build_object(
        'phase', 'Programming & Engineering Foundations',
        'explanation', 'Correct types are invisible until they are wrong. Checkpoints make you name the type before you use the value.',
        'paragraphs', jsonb_build_array(
          'Go through real values — a sensor reading, a switch state, a distance — and declare a variable with the right type for each.',
          'Remember the trap: 7 / 2 is 3, but 7 / 2.0 is 3.5. Typing a whole-number vs a decimal decides the result.',
          'A microcontroller with 2 KB of RAM punishes wasteful types. Choosing int over double when fractions are impossible saves memory.'
        ),
        'examples', jsonb_build_array(
          'int ledCount = 8;\ndouble voltage = 4.98;\nbool switchOn = true;\nchar grade = ''A'';'
        ),
        'activities', jsonb_build_array(
          'Declare a fitting variable for: light reading, motor speed, button pressed, gear number.',
          'Predict and then print 9 / 2 and 9 / 2.0.',
          'Explain to a partner what boolalpha does to the output.'
        ),
        'skills', jsonb_build_array('int', 'double', 'bool', 'char', 'integer division'),
        'hints', jsonb_build_array('Whole counts use int; measurements use double; yes/no uses bool.', 'Fractional division needs at least one decimal operand.', 'Print the division results and compare.'),
        'challenge', 'Add a char for a servo state letter and a bool that is true when a button is HIGH, then print all five variables.',
        'reflection', 'Which real value was hardest to type, and what did naming it clearly reveal?'
      )
    ),
    (3, 'Checkpoint 3: Decision Tracker', 'checkpoint-3-decision-tracker',
      array['Write a three-way decision from a real condition', 'Fix a wrong branch order', 'Trace a decision by hand before running'],
      jsonb_build_object(
        'phase', 'Programming & Engineering Foundations',
        'explanation', 'Decisions fail when branches are in the wrong order. A checkpoint forces you to trace by hand first.',
        'paragraphs', jsonb_build_array(
          'Before running, walk a test value through your if/else chain and predict the output. Only then run it.',
          'Broad checks first (>= 50) silently swallow narrow ones (>= 75). Narrowest, hardest-to-match branch should come first.',
          'Boundary values matter most: test exactly 50, exactly 75, and one value below each.'
        ),
        'examples', jsonb_build_array(
          'int score = 77;\nif (score >= 75) {\n  cout << "Distinction" << endl;\n} else if (score >= 50) {\n  cout << "Pass" << endl;\n} else {\n  cout << "Try again" << endl;\n}'
        ),
        'activities', jsonb_build_array(
          'Trace the program by hand for 40, 50, 60, 75, and 90.',
          'Write an if/else for "hot, warm, cold" from a temperature.',
          'Reorder the branches wrong on purpose and trace the bug.'
        ),
        'skills', jsonb_build_array('branch order', 'tracing', 'boundary values', 'if/else if/else'),
        'hints', jsonb_build_array('Highest threshold first.', 'Choose test values that sit exactly on the boundaries.', 'Say the branch path out loud before running.'),
        'challenge', 'Add a logical operator extra: print "Distinction & honours" only when score >= 75 && exam cleared == true.',
        'reflection', 'What did tracing by hand reveal that reading the code did not?'
      )
    ),
    (4, 'Checkpoint 4: Loop Rewriter', 'checkpoint-4-loop-rewriter',
      array['Rewrite the same job with for, while, and do-while', 'Fix an off-by-one error', 'Choose the right loop for a situation'],
      jsonb_build_object(
        'phase', 'Programming & Engineering Foundations',
        'explanation', 'Knowing one loop is easy; choosing among three is engineering. A checkpoint makes you convert between them.',
        'paragraphs', jsonb_build_array(
          'Count-up job? for. Keep-going-till-condition? while. Must-run-at-least-once? do-while.',
          'When you rewrite a for loop as a while loop, three pieces move: the start line, the condition, and the update step.',
          'Off-by-one errors hide at i <= size instead of i < size. Test the very first and very last iteration.'
        ),
        'examples', jsonb_build_array(
          '// for\nfor (int i = 1; i <= 5; i++) cout << i << endl;\n\n// while\nint i = 1;\nwhile (i <= 5) { cout << i << endl; i++; }'
        ),
        'activities', jsonb_build_array(
          'Print 1..10 with for, then repeat the exact output with while.',
          'Convert a while that "waits until a reading is high" into do-while and explain the difference.',
          'Find and fix an intentional off-by-one a partner writes.'
        ),
        'skills', jsonb_build_array('for', 'while', 'do-while', 'off-by-one'),
        'hints', jsonb_build_array('Move start, condition, and update separately.', 'do-while checks the condition after running the body.', 'Test index 0 and the final index.'),
        'challenge', 'Write a while loop that counts down from 10 and prints "Mock launch!" at 0, then convert it to a for loop.',
        'reflection', 'Which of the three loops would you use to read sensor values until a button is released, and why?'
      )
    ),
    (5, 'Checkpoint 5: Function Builder', 'checkpoint-5-function-builder',
      array['Extract a reusable function from repeated code', 'Add parameters and a return value', 'Unit-test a function with known values'],
      jsonb_build_object(
        'phase', 'Functions, Arrays & Arduino',
        'explanation', 'Spotting repeated code and turning it into a function is the heart of clean programs.',
        'paragraphs', jsonb_build_array(
          'Look at your week''s examples: any line pattern used more than once is a candidate for a function.',
          'A function with one job, clear parameters, and a return value can be tested alone — the fastest way to debug robot logic.',
          'Test functions with values you already know the answer to: average(10, 20) must be exactly 15.'
        ),
        'examples', jsonb_build_array(
          '#include <iostream>\nusing namespace std;\n\ndouble average(double a, double b) {\n  return (a + b) / 2.0;\n}\n\nint main() {\n  cout << average(10, 20) << endl;\n  return 0;\n}'
        ),
        'activities', jsonb_build_array(
          'Write clamp(value, low, high) that returns the warmed/clamped value.',
          'Call it with (15, 0, 10) and confirm the answer is 10 from memory first.',
          'Turn two repeated print blocks in your program into one function.'
        ),
        'skills', jsonb_build_array('functions', 'parameters', 'return', 'unit testing'),
        'hints', jsonb_build_array('Compute by hand before you compile.', 'Return the clamped value explicitly.', 'int vs double: return a double for fractions.'),
        'challenge', 'Write isBetween(value, low, high) returning bool, then print true/false for three known cases.',
        'reflection', 'Which test value proved your function was right, and would you trust it without that test?'
      )
    ),
    (6, 'Checkpoint 6: Sensor Average', 'checkpoint-6-sensor-average',
      array['Fill an array from a loop', 'Compute average, min, and max with one pass', 'Avoid reading past the end of the array'],
      jsonb_build_object(
        'phase', 'Functions, Arrays & Arduino',
        'explanation', 'Arrays plus loops turn scattered readings into one usable number.',
        'paragraphs', jsonb_build_array(
          'One pass can total, find the minimum, and find the maximum at the same time.',
          'Start the minimum at the first element, never at a magic number like 1000.',
          'Array indices run 0 to size-1. Looping to <= size reads memory past the array — undefined behaviour.'
        ),
        'examples', jsonb_build_array(
          'double readings[] = {310, 420, 380, 450, 330};\nint n = 5;\ndouble total = 0;\nfor (int i = 0; i < n; i++) total += readings[i];\ncout << "Average: " << total / n << endl;'
        ),
        'activities', jsonb_build_array(
          'Fill an array using a for loop and compute the average.',
          'Add max tracking to the same loop.',
          'Deliberately loop to <= n and observe (or imagine) the bad read.'
        ),
        'skills', jsonb_build_array('arrays', 'aggregates', 'bounds', 'for loop'),
        'hints', jsonb_build_array('total / n needs both as double for fractions.', 'Track min and max inside the same loop.', 'Start max at readings[0] too.'),
        'challenge', 'Add a threshold report: count how many readings are above 400 and print the count.',
        'reflection', 'Why is looping an array of five values safer than writing five separate variables?'
      )
    ),
    (7, 'Checkpoint 7: Pin Configurator', 'checkpoint-7-pin-configurator',
      array['Set up every pin you use in setup()', 'Manage a button with INPUT_PULLUP', 'Wire and test a two-LED blink pattern'],
      jsonb_build_object(
        'phase', 'Functions, Arrays & Arduino',
        'explanation', 'A clockwork program begins with deliberate pin configuration.',
        'paragraphs', jsonb_build_array(
          'Every pin must be configured exactly once in setup() before loop() uses it.',
          'INPUT_PULLUP inverts the logic: a pressed button reads LOW. Mark that in a comment so it never surprises you.',
          'Two LEDs that blink at different rates need interleaved timing, not two blocking delay loops.'
        ),
        'examples', jsonb_build_array(
          'const int green = 9;\nconst int red = 10;\n\nvoid setup() {\n  pinMode(green, OUTPUT);\n  pinMode(red, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(green, HIGH); digitalWrite(red, LOW);\n  delay(500);\n  digitalWrite(green, LOW); digitalWrite(red, HIGH);\n  delay(500);\n}'
        ),
        'activities', jsonb_build_array(
          'List every pin you plan to use and its mode before wiring.',
          'Wire a button with INPUT_PULLUP and blink an LED only while pressed.',
          'Alternate two LEDs on/off and time the pattern.'
        ),
        'skills', jsonb_build_array('pinMode', 'digitalWrite', 'INPUT_PULLUP', 'setup/loop'),
        'hints', jsonb_build_array('Pressed with pull-up reads LOW.', 'delay blocks; two delays in a row are not "simultaneous".', 'Each LED needs its own resistor (220-330 ohm).'),
        'challenge', 'Make the green LED blink twice per second while the red one blinks once per second using interleaved delays.',
        'reflection', 'How did pin configuration mistakes show up during physical testing?'
      )
    ),
    (8, 'Checkpoint 8: Night-Light Calibration', 'checkpoint-8-night-light-calibration',
      array['Print raw analog readings for calibration', 'Choose a threshold from real data', 'Test flicker at the threshold boundary'],
      jsonb_build_object(
        'phase', 'Functions, Arrays & Arduino',
        'explanation', 'A threshold you measured beats a threshold you invented.',
        'paragraphs', jsonb_build_array(
          'Record analogRead values in bright, mid, and dark conditions before writing any if statement.',
          'Place the threshold in the quiet gap between the bright and dark clusters, not on top of either.',
          'Flicker near the threshold means the boundary is too close to real living values — widen the gap or slow the loop.'
        ),
        'examples', jsonb_build_array(
          'void loop() {\n  int reading = analogRead(A0);\n  Serial.println(reading);\n  if (reading < darkThreshold) digitalWrite(led, HIGH);\n  else digitalWrite(led, LOW);\n  delay(200);\n}'
        ),
        'activities', jsonb_build_array(
          'Print values in three light levels and write them down.',
          'Set darkThreshold between the measured bright and dark values.',
          'Pass your hand over the sensor and watch for flicker at the edge.'
        ),
        'skills', jsonb_build_array('analogRead', 'Serial.println', 'calibration', 'thresholds'),
        'hints', jsonb_build_array('Serial Monitor is your measuring tool.', 'Record, then decide — never the reverse.', 'Add delay to avoid rapid toggling.'),
        'challenge', 'Add a 5-sample average before the threshold test so a brief shadow cannot trigger the light.',
        'reflection', 'Which measurement surprised you, and how did it change your threshold?'
      )
    ),
    (9, 'Checkpoint 9: Distance Alarm', 'checkpoint-9-distance-alarm',
      array['Read distance from an ultrasonic sensor', 'Act on a threshold', 'Explain SENSE → THINK → ACT in your build'],
      jsonb_build_object(
        'phase', 'Sensors, Actuators & Automation',
        'explanation', 'Sensing distance and acting on it is the core of obstacle robots.',
        'paragraphs', jsonb_build_array(
          'The HC-SR04 pulse-and-echo pattern must read cleanly: 10 µs trigger pulse, then measure the echo high time.',
          'Convert the echo time to centimetres by dividing (round-trip) and scaling — then act on a threshold.',
          'Every build this week should be described as SENSE → THINK → ACT so the pattern becomes reflex.'
        ),
        'examples', jsonb_build_array(
          'long readDistanceCm() {\n  digitalWrite(trig, LOW); delayMicroseconds(2);\n  digitalWrite(trig, HIGH); delayMicroseconds(10);\n  digitalWrite(trig, LOW);\n  return pulseIn(echo, HIGH) / 58.0;\n}'
        ),
        'activities', jsonb_build_array(
          'Measure distance at 10, 20, and 50 cm and compare with a ruler.',
          'Turn on an LED when the object is under 30 cm.',
          'Label on paper: which part is SENSE, THINK, ACT.'
        ),
        'skills', jsonb_build_array('HC-SR04', 'pulseIn', 'thresholds', 'SENSE-THINK-ACT'),
        'hints', jsonb_build_array('Wire trig (OUTPUT) and echo (INPUT) correctly.', 'Divide by 58 for cm (round trip).', 'Test with a book at known distances.'),
        'challenge', 'Add a second reaction: under 15 cm beeps the buzzer once, under 30 cm just lights the LED.',
        'reflection', 'Where in your alarm could a wiring bug masquerade as a code bug?'
      )
    ),
    (10, 'Checkpoint 10: Actuator Chain', 'checkpoint-10-actuator-chain',
      array['Drive a servo from a sensor decision', 'Use PWM safely for a motor', 'Trigger an output chain'],
      jsonb_build_object(
        'phase', 'Sensors, Actuators & Automation',
        'explanation', 'Actuators turn decisions into motion — and demand safe power.',
        'paragraphs', jsonb_build_array(
          'A servo needs its own supply when pushing load; commanding it from the Arduino 5V pin works only for light test loads.',
          'DC motors need a driver and PWM speed control; never hang a motor off a logic pin.',
          'Chain everything in one loop: read, decide, act — deliberately and slowly.'
        ),
        'examples', jsonb_build_array(
          '#include <Servo.h>\nServo gate;\nvoid setup() { gate.attach(9); }\nvoid loop() {\n  if (analogRead(A0) > 600) gate.write(90); else gate.write(0);\n  delay(30);\n}'
        ),
        'activities', jsonb_build_array(
          'Sweep a servo 0..180 and back with the Servo library.',
          'Read the LDR and open a gate when the light is low.',
          'Note where the servo draws its power in your diagram.'
        ),
        'skills', jsonb_build_array('Servo', 'PWM', 'motor driver', 'power separation'),
        'hints', jsonb_build_array('attach happens once in setup().', 'Servos under load and motors need external power.', 'Keep the logic ground separate and clear.'),
        'challenge', 'Add a buzzer that beeps twice every time the gate changes state — a true actuator chain with feedback.',
        'reflection', 'What breaks first when you run a servo from the wrong supply — wiring, code, or expectations?'
      )
    ),
    (11, 'Checkpoint 11: Irrigation Logic', 'checkpoint-11-irrigation-logic',
      array['Average raw soil readings', 'Define the watering decision', 'Debounce the pump switch'],
      jsonb_build_object(
        'phase', 'Sensors, Actuators & Automation',
        'explanation', 'The irrigation system is a decision loop with patience: sample, smooth, decide, act, wait.',
        'paragraphs', jsonb_build_array(
          'One erratic reading can flip the pump. Averaging several readings smooths noise before the decision.',
          'A pump that clicks on and off every second destroys itself. Add a minimum pump time and a soak delay.',
          'The pump must run from its own relay and supply — the Arduino only provides the logic signal.'
        ),
        'examples', jsonb_build_array(
          'long total = 0;\nfor (int i = 0; i < 5; i++) { total += analogRead(A0); delay(50); }\nint soil = total / 5;\nif (soil > dryThreshold) { digitalWrite(relay, HIGH); delay(10000); digitalWrite(relay, LOW); delay(60000); }'
        ),
        'activities', jsonb_build_array(
          'Record the average of 5 samples in dry soil.',
          'Write the watering decision with a 10-second pump stop.',
          'Sketch the power diagram: sensor → Arduino → relay → pump.'
        ),
        'skills', jsonb_build_array('averaging', 'debouncing', 'relay', 'power safety'),
        'hints', jsonb_build_array('Average 3-5 samples.', 'Separate pump power entirely.', 'Add delay between pump bursts.'),
        'challenge', 'Add the daylight guard: only water when the LDR says it is bright enough to matter.',
        'reflection', 'Why is a pump that waits a minute between bursts more reliable than one that reacts instantly?'
      )
    ),
    (12, 'Checkpoint 12: Feeder Timing', 'checkpoint-12-feeder-timing',
      array['Replace blocking delay() with millis() timing', 'Add a manual override', 'Prove auto-feed resumes after override'],
      jsonb_build_object(
        'phase', 'Sensors, Actuators & Automation',
        'explanation', 'Time-based automation must keep its loop responsive — that means millis(), not delay().',
        'paragraphs', jsonb_build_array(
          'delay() stops the whole sketch; the feeder would ignore buttons and sensors while waiting.',
          'millis() lets you compare elapsed time while the loop keeps breathing: if (millis() - lastFeed >= interval).',
          'An override button forces a feed and must NOT reset the auto schedule silently.'
        ),
        'examples', jsonb_build_array(
          'unsigned long lastFeed = 0;\nconst unsigned long interval = 3600000;\nvoid loop() {\n  unsigned long now = millis();\n  if (now - lastFeed >= interval) { feed(); lastFeed = now; }\n  if (digitalRead(btn) == LOW) { feed(); }\n}'
        ),
        'activities', jsonb_build_array(
          'Set interval to 5000 ms and watch one auto feed.',
          'Add an override button and count both feeds.',
          'Wrap the unsigned math in (unsigned long) casts if the compiler warns.'
        ),
        'skills', jsonb_build_array('millis', 'timers', 'override', 'responsive loops'),
        'hints', jsonb_build_array('Compare millis() - lastFeed, not millis().', 'An override should also move lastFeed.', 'Test with a short interval first.'),
        'challenge', 'Add an LED lit while the gate is open, driven without delay, and verify the loop still reads the button.',
        'reflection', 'Which part of a feeder becomes dangerous if the loop ever blocks?'
      )
    ),
    (13, 'Checkpoint 13: Movement Primitives', 'checkpoint-13-movement-primitives',
      array['Write the four movement primitives', 'Test each one alone on the bench', 'Calibrate identical speed on both wheels'],
      jsonb_build_object(
        'phase', 'Robotics Fundamentals',
        'explanation', 'A robot that cannot move predictably cannot avoid anything. This checkpoint is the movement exam.',
        'paragraphs', jsonb_build_array(
          'Before any sensor logic, prove: forward, reverse, left, right, stop — each on its own, at low speed.',
          'Both wheels need the same PWM value to drive straight; add a small offset if the robot drifts.',
          'Use named functions so the rest of the project reads like instructions, not pin logic.'
        ),
        'examples', jsonb_build_array(
          'void moveForward(int speed, int duration) {\n  digitalWrite(in1, HIGH); digitalWrite(in2, LOW);\n  analogWrite(enA, speed);\n  delay(duration); analogWrite(enA, 0);\n}'
        ),
        'activities', jsonb_build_array(
          'Run forward 1 second at speed 120 and measure the distance.',
          'Verify left and right turns rotate on the spot.',
          'Watch for drift over 2 metres and add an offset.'
        ),
        'skills', jsonb_build_array('movement primitives', 'PWM tuning', 'bench testing'),
        'hints', jsonb_build_array('Slow speed first (100-150).', 'Mark forward pins in a comment.', 'Stop after every primitive call.'),
        'challenge', 'Drive a 2-metre straight line, then a 90-degree left turn, then return to your start — a square you can repeat within 10 cm.',
        'reflection', 'Why must movement be perfect before you bolt on a single sensor?'
      )
    ),
    (14, 'Checkpoint 14: Wiring Debug', 'checkpoint-14-wiring-debug',
      array['Diagnose reversed motors', 'Diagnose loose wiring', 'Read polarity from motor markings'],
      jsonb_build_object(
        'phase', 'Robotics Fundamentals',
        'explanation', 'Half of all robot bugs live in the wiring, not the code. A checkpoint trains the eye first.',
        'paragraphs', jsonb_build_array(
          'If forward drives the robot backward, the fastest fix is swapping that motor''s two drive wires — not rewriting code.',
          'Motors are mounted facing opposite ways; their "forward" pins must be commented correctly per side.',
          'When nothing moves, check power first, then driver enable pins, then the input pins in that order.'
        ),
        'examples', jsonb_build_array(
          'const int in1 = 6; // LEFT  motor FORWARD\nconst int in2 = 7; // LEFT  motor REVERSE\nconst int in3 = 8; // RIGHT motor FORWARD\nconst int in4 = 9; // RIGHT motor REVERSE'
        ),
        'activities', jsonb_build_array(
          'Make one motor reverse on purpose and fix it physically.',
          'Create a loose-jumper bug for a partner to find.',
          'List your debug order: power → enable → pins → code.'
        ),
        'skills', jsonb_build_array('wiring diagnostics', 'polarity', 'debug order'),
        'hints', jsonb_build_array('Swap the physical pair faster than the code.', 'Test one wheel at a time.', 'Write the debug order on a notecard.'),
        'challenge', 'Make the robot drive a perfect square, then introduce one deliberate wiring fault and fix it within a minute.',
        'reflection', 'Which debugging step saved you the most time, and why?'
      )
    ),
    (15, 'Checkpoint 15: Remote Command Map', 'checkpoint-15-remote-command-map',
      array['Receive one command per press', 'Map commands to movement functions', 'Guarantee an emergency stop'],
      jsonb_build_object(
        'phase', 'Robotics Fundamentals',
        'explanation', 'A remote robot is decision mapping: input code in, movement out.',
        'paragraphs', jsonb_build_array(
          'Decode one input type at a time and print the raw code before mapping anything.',
          'Every command maps to exactly one movement function, and the default (unknown) case must be stop().',
          'The emergency stop must be reachable — test it first, before any movement key.'
        ),
        'examples', jsonb_build_array(
          'switch (command) {\n  case 0x00: moveForward(180, 300); break;\n  case 0x01: moveReverse(180, 300); break;\n  case 0x02: turnLeft(180, 250); break;\n  case 0x03: turnRight(180, 250); break;\n  default:  stop(); break;\n}'
        ),
        'activities', jsonb_build_array(
          'Print the raw incoming command for each button.',
          'Wire one input type and map three keys.',
          'Test the emergency stop before anything else.'
        ),
        'skills', jsonb_build_array('switch', 'input decoding', 'emergency stop'),
        'hints', jsonb_build_array('One input type at a time.', 'default must stop.', 'Echo the decode to Serial first.'),
        'challenge', 'Add a speed dial: a potentiometer maps 0-1023 to PWM speed used by the same movement functions.',
        'reflection', 'Why is an always-reachable stop the first requirement for any RC system?'
      )
    ),
    (16, 'Checkpoint 16: Obstacle Decision Ladder', 'checkpoint-16-obstacle-decision-ladder',
      array['React to measured distance', 'Order the decision branches correctly', 'Tune thresholds from real runs'],
      jsonb_build_object(
        'phase', 'Robotics Fundamentals',
        'explanation', 'The obstacle robot is your first full SENSE → THINK → ACT machine.',
        'paragraphs', jsonb_build_array(
          'Measure real approach distances and set thresholds from the recordings, not from imagination.',
          'The branch order is: near → turn; very near → reverse then turn; clear → forward.',
          'Scanning left then right before choosing a turn beats turning blind.'
        ),
        'examples', jsonb_build_array(
          'long d = readDistanceCm();\nif (d > 30)      moveForward(160, 200);\nelse if (d > 15) turnLeft(160, 200);\nelse { moveReverse(150, 300); turnRight(160, 250); }'
        ),
        'activities', jsonb_build_array(
          'Record distances as a wall is approached.',
          'Test each branch with a book placed at known distances.',
          'Add a left/right scan before turning.'
        ),
        'skills', jsonb_build_array('decision ladder', 'ultrasonic logic', 'tuning'),
        'hints', jsonb_build_array('Tune with a book, not your hand.', 'Choose the emptier side when scanning.', 'Reverse before turning when very close.'),
        'challenge', 'Implement scan-and-choose: measure left and right, turn into the larger gap, reverse if both are blocked.',
        'reflection', 'How did measured thresholds differ from the numbers you first guessed?'
      )
    ),
    (17, 'Checkpoint 17: State Machine Sketch', 'checkpoint-17-state-machine-sketch',
      array['Draw a state machine before coding', 'Implement states with an enum', 'Test every transition once'],
      jsonb_build_object(
        'phase', 'Advanced Robotics Projects',
        'explanation', 'State machines are how complex robots stay simple: exactly one state at a time.',
        'paragraphs', jsonb_build_array(
          'Draw the states and the arrows (transitions) before writing any code — the diagram is the design.',
          'An enum names the states; a switch walks through them; each loop decides if it is time to switch.',
          'Test every arrow once: DRIVE → AVOID, AVOID → TURN, TURN → DRIVE, and any return-to-home.'
        ),
        'examples', jsonb_build_array(
          'enum RobotState { DRIVE, AVOID, TURN };\nRobotState state = DRIVE;\nswitch (state) {\n  case DRIVE: if (readDistanceCm() < 25) state = AVOID; break;\n  case AVOID: turnRight(160, 250); state = TURN; break;\n  case TURN:  moveForward(160, 400); state = DRIVE; break;\n}'
        ),
        'activities', jsonb_build_array(
          'Draw the states and arrows on paper.',
          'Map your week''s behaviour into three named states.',
          'Run the maze and tick off each transition you observe.'
        ),
        'skills', jsonb_build_array('state machines', 'enum', 'transitions', 'design first'),
        'hints', jsonb_build_array('One state per loop iteration.', 'Draw first, code second.', 'Test every arrow at least once.'),
        'challenge', 'Add a HOME state the robot enters after clearing an obstacle, then verify it returns toward the start.',
        'reflection', 'What did a paper diagram catch that writing code immediately would have hidden?'
      )
    ),
    (18, 'Checkpoint 18: Mopping Lane Sweep', 'checkpoint-18-mopping-lane-sweep',
      array['Plan a coverage pattern', 'Re-test movement with a payload', 'Add a graceful stop'],
      jsonb_build_object(
        'phase', 'Advanced Robotics Projects',
        'explanation', 'A cleaning robot is a pattern-follower: coverage beats random wandering.',
        'paragraphs', jsonb_build_array(
          'S-shape / lane sweep guarantees every strip gets a pass; random motion leaves gaps.',
          'A mop payload changes weight and traction — re-measure turn time and speed with it attached.',
          'End gracefully: detect a stall and stop rather than drag the frame.'
        ),
        'examples', jsonb_build_array(
          'for (int lane = 0; lane < 4; lane++) {\n  moveForward(140, 1500);\n  turnAround(140, 500);\n}'
        ),
        'activities', jsonb_build_array(
          'Sketch the lane-sweep pattern for a 2x2 m area.',
          'Re-test turn timing with the mop attached.',
          'Add a stop-before-drag check using the ultrasonic sensor.'
        ),
        'skills', jsonb_build_array('coverage patterns', 'payload effects', 'safety stops'),
        'hints', jsonb_build_array('Attach the payload before calibrating.', 'Wet surfaces change wheel grip.', 'Prefer skipping a strip over repeating one.'),
        'challenge', 'Add a wet/dry mode button where wet mode sweeps twice with a wiper pass between — and a stall stop.',
        'reflection', 'Which parameter shifted the most when you added the mop payload?'
      )
    ),
    (19, 'Checkpoint 19: Chasing Decision Table', 'checkpoint-19-chasing-decision-table',
      array['Write a sensor-direction decision table', 'Centre the ball before pushing', 'Iterate one change per test'],
      jsonb_build_object(
        'phase', 'Advanced Robotics Projects',
        'explanation', 'A soccer robot turns sensed direction into chase decisions — a decision table made real.',
        'paragraphs', jsonb_build_array(
          'Encode the rule: centred → forward, left → turn left, right → turn right, none → scan.',
          'Centre the ball in the sensor before pushing so the robot does not push at an angle.',
          'Record one change per match test: scan speed, chase speed, or turn delay — never two at once.'
        ),
        'examples', jsonb_build_array(
          'switch (direction) {\n  case CENTER: moveForward(200, 100); break;\n  case LEFT:   turnLeft(180, 120); break;\n  case RIGHT:  turnRight(180, 120); break;\n  default:     scanForBall(); break;\n}'
        ),
        'activities', jsonb_build_array(
          'Draw the decision table (input → action).',
          'Test ball detection in three positions.',
          'Chase the ball and count successful touches per minute.'
        ),
        'skills', jsonb_build_array('decision tables', 'chase logic', 'iteration'),
        'hints', jsonb_build_array('Centre before pushing.', 'Scan only when the ball is lost.', 'One tuning change per test.'),
        'challenge', 'Add a corner-escape: when the ball is lost, sweep the sensor to find it instead of driving into the wall.',
        'reflection', 'How did one-change-per-test make your robot objectively better?'
      )
    ),
    (20, 'Checkpoint 20: Challenge Checklist', 'checkpoint-20-challenge-checklist',
      array['Build a pre-run checklist', 'Run a timed practice attempt', 'Deliver a two-minute explanation'],
      jsonb_build_object(
        'phase', 'Advanced Robotics Projects',
        'explanation', 'The Robotics Challenge rewards preparation as much as skill.',
        'paragraphs', jsonb_build_array(
          'Write a 90-second checklist: power, wiring, sensor self-test, movement check — and always run it before the clock.',
          'Practice attempts are where you log failures and plan the fix; treat them as data, not judgement.',
          'Be ready to state your SENSE → THINK → ACT design in two minutes — explanation is part of the score.'
        ),
        'examples', jsonb_build_array(
          'Checklist:\n1 Power / battery\n2 All connectors seated\n3 Self-test distance\n4 Move 20 cm\n5 Explain design flow'
        ),
        'activities', jsonb_build_array(
          'Write your checklist on a notecard.',
          'Run one full timed practice attempt.',
          'Explain your design flow to a partner in two minutes.'
        ),
        'skills', jsonb_build_array('checklists', 'timed practice', 'explanation'),
        'hints', jsonb_build_array('Start debugged, then run.', 'Log one fix per failure.', 'Design diagram > buzzwords.'),
        'challenge', 'Complete a timed run of the obstacle course with checklist in hand, then present your SENSE → THINK → ACT diagram.',
        'reflection', 'Which checklist item prevented the biggest disaster in your practice run?'
      )
    ),
    (21, 'Checkpoint 21: WiFi Connection Proof', 'checkpoint-21-wifi-connection-proof',
      array['Connect the ESP32 to WiFi', 'Print the local IP as proof', 'Secure credentials away from the sketch'],
      jsonb_build_object(
        'phase', 'ESP32 & Smart Systems',
        'explanation', 'A connected microcontroller must prove its connection and protect its secrets.',
        'paragraphs', jsonb_build_array(
          'WiFi.begin(ssid, password) then wait for WL_CONNECTED before publishing anything.',
          'Print the assigned IP — a real, visible proof the device is on the network.',
          'Never hard-code secrets in the shared sketch; move the password into a secret header you keep out of version control.'
        ),
        'examples', jsonb_build_array(
          '#include <WiFi.h>\nconst char* ssid = "your-network";\nconst char* password = "your-password";\nvoid setup() {\n  Serial.begin(115200);\n  WiFi.begin(ssid, password);\n  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }\n  Serial.println(WiFi.localIP());\n}'
        ),
        'activities', jsonb_build_array(
          'Flash the scan example and list visible networks.',
          'Connect to a real network and print the IP.',
          'Move the credentials into a private header file.'
        ),
        'skills', jsonb_build_array('ESP32', 'WiFi', 'credentials', 'IP'),
        'hints', jsonb_build_array('ESP32 uses Serial at 115200.', 'Wait for WL_CONNECTED before continuing.', 'Keep secrets out of the committed sketch.'),
        'challenge', 'Connect, print the IP once, then publish a sensor reading every second over that connection.',
        'reflection', 'What changes about a device when it becomes reachable over a network?'
      )
    ),
    (22, 'Checkpoint 22: Alarm State Test', 'checkpoint-22-alarm-state-test',
      array['Implement three alarm states', 'Test every transition', 'Add a remote status read'],
      jsonb_build_object(
        'phase', 'ESP32 & Smart Systems',
        'explanation', 'A security system is its states, and a state machine is only as trustworthy as its tested transitions.',
        'paragraphs', jsonb_build_array(
          'ARM waits, TRIGGERED reacts, DISARM ignores — and each must be entered and exited cleanly.',
          'Walk the matrix: arm → trigger → disarm → arm again, proving every arrow works.',
          'The ESP32 lets the state be read remotely: publish the current state to a dashboard or app.'
        ),
        'examples', jsonb_build_array(
          'enum AlarmState { DISARM, ARM, TRIGGERED };\nAlarmState state = DISARM;\nif (state == ARM && motion) state = TRIGGERED;\nif (state == TRIGGERED) digitalWrite(alarmPin, HIGH); else digitalWrite(alarmPin, LOW);'
        ),
        'activities', jsonb_build_array(
          'Draw the three states and their arrows.',
          'Trigger the alarm and silence it at the keypad.',
          'Confirm the state also shows on the dashboard.'
        ),
        'skills', jsonb_build_array('state machines', 'security logic', 'remote reporting'),
        'hints', jsonb_build_array('PIR needs a settling minute.', 'Test the alarm output before the app.', 'Every transition gets a named test case.'),
        'challenge', 'Add a tamper case: if the alarm sounds while DISARM is pressed twice quickly, it assumes forced disarm and still alerts remotely.',
        'reflection', 'Which transition, if untested, would be the most dangerous for a security system?'
      )
    ),
    (23, 'Checkpoint 23: Capstone Design Packet', 'checkpoint-23-capstone-design-packet',
      array['Write a sharp problem statement', 'Limit scope to one clear THINK rule', 'Ship a realistic BOM and timeline'],
      jsonb_build_object(
        'phase', 'Capstone Engineering Project',
        'explanation', 'The capstone design packet proves you can plan before you build — the engineer''s signature skill.',
        'paragraphs', jsonb_build_array(
          'A sharp problem statement has a user, a need, and a measurable success criterion. "Build a robot" is not one.',
          'Constrain scope: at most two or three inputs, one decision rule, one or two outputs. Small and finished wins.',
          'Every component on the BOM must have a job. Pair each milestone with a completion test so progress is provable.'
        ),
        'examples', jsonb_build_array(
          'Problem : Water the garden automatically through power cuts.\nInputs  : soil moisture, daylight LDR\nThink   : dry AND bright -> water 10 s\nOutputs : relay pump, status LED, buzzer\nMilestones: W1 wiring, W2 calibrate, W3 sealed test'
        ),
        'activities', jsonb_build_array(
          'Write your team problem statement in one sentence.',
          'Fill the input/THINK/output table.',
          'Build the BOM with costs and milestones.'
        ),
        'skills', jsonb_build_array('problem framing', 'scope control', 'BOM', 'milestones'),
        'hints', jsonb_build_array('Half a page per section is enough.', 'Every part needs a job.', 'A milestone without a test is a wish.'),
        'challenge', 'Cut your scope in half and re-write the BOM — then prove the smaller system still meets the need.',
        'reflection', 'Where did the design want to grow beyond the build time, and how did you cut it?'
      )
    ),
    (24, 'Checkpoint 24: Final Test & Demo', 'checkpoint-24-final-test-and-demo',
      array['Run the full requirement test twice', 'Deliver a three-minute demo', 'Log failures and present improvements'],
      jsonb_build_object(
        'phase', 'Capstone Engineering Project',
        'explanation', 'The course ends the way engineering works: test everything, then present with evidence.',
        'paragraphs', jsonb_build_array(
          'Run the requirement checklist twice: once alone, once with the panel watching. The second pass proves it is repeatable.',
          'A three-minute demo answers: the problem, how SENSE → THINK → ACT works, what testing found, and the next improvement.',
          'Your debug log is evidence. A documented failure and fix is worth more than a lucky success.'
        ),
        'examples', jsonb_build_array(
          'Debug log:\n# 15:00 pump never started\n# changed relay pin 7 (was unused pin 3)\n# 15:05 pump starts on dry soil - PASS'
        ),
        'activities', jsonb_build_array(
          'Run the full checklist twice and note differences.',
          'Rehearse the demo in front of a partner.',
          'Finalise the improvement list for a future version.'
        ),
        'skills', jsonb_build_array('requirement testing', 'demo delivery', 'documentation'),
        'hints', jsonb_build_array('A working simple demo beats a broken complex one.', 'Keep the log; it is presentation gold.', 'Answer the four demo questions in order.'),
        'challenge', 'Deliver a three-minute demo where every requirement passes and you name your single best test-revealed fix.',
        'reflection', 'Which failure you fixed this week made the final system genuinely better?'
      )
    )
) as checkpoint(week_number, title, slug, objectives, content)
  on checkpoint.week_number = weeks.week_number
where course.slug = 'cpp-embedded-robotics'
  on conflict (week_id, lesson_number) do update set
    title = excluded.title,
    slug = excluded.slug,
    objectives = excluded.objectives,
    content = excluded.content,
    published = true,
    sort_order = excluded.sort_order;