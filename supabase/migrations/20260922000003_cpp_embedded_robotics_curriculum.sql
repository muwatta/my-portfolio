-- Published curriculum mapped from the C++ Programming for Embedded Systems
-- & Robotics manual.
insert into public.academy_courses (slug, title, description, duration_weeks, published)
values (
  'cpp-embedded-robotics',
  'C++ Programming for Embedded Systems & Robotics',
  'A 24-week, 96-hour practical programme covering C++, Arduino, ESP32, sensors, actuators, robotics, and a capstone engineering project.',
  24,
  true
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  duration_weeks = excluded.duration_weeks,
  published = excluded.published;

insert into public.academy_weeks (course_id, week_number, title)
select course.id, curriculum.week_number, curriculum.title
from public.academy_courses course
join (
  values
    (1, 'Thinking Like a Programmer'),
    (2, 'C++ Fundamentals'),
    (3, 'Decision Making'),
    (4, 'Loops'),
    (5, 'Functions'),
    (6, 'Arrays and Basic Data Handling'),
    (7, 'Arduino Fundamentals'),
    (8, 'Analog Sensing'),
    (9, 'Sensors in Depth'),
    (10, 'Actuators'),
    (11, 'Automatic Farm Irrigation System'),
    (12, 'Automatic Animal / Poultry Feeder'),
    (13, 'Robotics Fundamentals'),
    (14, '2WD Chassis and Movement'),
    (15, '2WD Remote-Controlled Car'),
    (16, 'Obstacle-Avoiding Robot'),
    (17, 'Autonomous Navigation'),
    (18, 'Automatic Floor-Mopping Robot'),
    (19, 'Soccer Robot'),
    (20, 'Robotics Challenge'),
    (21, 'ESP32 & Smart Systems'),
    (22, 'Smart Home / Security System'),
    (23, 'Capstone Engineering Project'),
    (24, 'Capstone Engineering Project: Testing and Demo')
) as curriculum(week_number, title) on true
where course.slug = 'cpp-embedded-robotics'
on conflict (course_id, week_number) do update set
  title = excluded.title;

insert into public.academy_lessons (
  week_id,
  title,
  slug,
  lesson_number,
  objectives,
  content,
  published
)
select
  weeks.id,
  curriculum.lesson_title,
  curriculum.slug,
  1,
  curriculum.objectives,
  curriculum.content::jsonb,
  true
from public.academy_weeks weeks
join public.academy_courses course on course.id = weeks.course_id
join (
  values
    (1, 'Level 1: Thinking Like a Programmer', 'level-1-thinking-like-a-programmer',
      array['Understand hardware, software, and algorithms', 'Draw and interpret simple flowcharts', 'Use the Input-Processing-Output pattern', 'Write and execute a first C++ program'],
      '{"phase":"Programming & Engineering Foundations","pattern":"Input → Processing → Output","project":"Algorithm and flowchart for an everyday process"}'),
    (2, 'Level 2: C++ Fundamentals', 'level-2-cpp-fundamentals',
      array['Declare variables and choose data types', 'Perform arithmetic, comparison, and logical operations', 'Understand how data types affect embedded systems'],
      '{"phase":"Programming & Engineering Foundations","skills":["variables","data types","arithmetic","comparisons","logical operations"],"project":"C++ fundamentals challenge"}'),
    (3, 'Level 3: Decision Making', 'level-3-decision-making',
      array['Use if, else if, and else statements', 'Combine conditions with logical operators', 'Choose between if-else chains and switch statements', 'Debug conditional logic'],
      '{"phase":"Programming & Engineering Foundations","skills":["if","else if","else","switch","logical operators"],"project":"Automatic Traffic-Light Decision System"}'),
    (4, 'Level 4: Loops', 'level-4-loops',
      array['Use for, while, and do-while loops', 'Choose a loop for a repetition problem', 'Recognise infinite-loop and off-by-one errors'],
      '{"phase":"Programming & Engineering Foundations","skills":["for","while","do-while"],"project":"Countdown, LED Simulation & Simple Menu"}'),
    (5, 'Level 5: Functions', 'level-5-functions',
      array['Design functions that solve one clear problem', 'Use parameters and return values', 'Organise complex programs into named functions'],
      '{"phase":"Functions, Arrays & Arduino","skills":["functions","parameters","return values"],"project":"Reusable robot movement functions"}'),
    (6, 'Level 6: Arrays and Basic Data Handling', 'level-6-arrays-and-basic-data-handling',
      array['Store related values in arrays', 'Iterate through arrays with loops', 'Calculate averages, minimums, and maximums'],
      '{"phase":"Functions, Arrays & Arduino","skills":["arrays","loop-based processing","aggregate values"],"project":"Process a set of sensor readings"}'),
    (7, 'Level 7: Arduino Fundamentals', 'level-7-arduino-fundamentals',
      array['Explain Arduino setup and loop', 'Configure digital pins', 'Control digital outputs and read digital inputs'],
      '{"phase":"Functions, Arrays & Arduino","skills":["setup","loop","pinMode","digitalRead","digitalWrite"],"project":"Project 1: LED Control"}'),
    (8, 'Level 8: Analog Sensing', 'level-8-analog-sensing',
      array['Read analog values', 'Use thresholds in hardware decisions', 'Calibrate a light sensor against real conditions'],
      '{"phase":"Functions, Arrays & Arduino","skills":["analogRead","thresholds","calibration"],"project":"Automatic Night Light"}'),
    (9, 'Level 8: Sensors in Depth', 'level-9-sensors-in-depth',
      array['Explain digital and analog sensors', 'Read buttons, potentiometers, LDRs, and ultrasonic distance', 'Connect sensor readings to real-world applications'],
      '{"phase":"Sensors, Actuators & Automation","sensors":["push button","potentiometer","LDR","HC-SR04 ultrasonic sensor"],"pattern":"SENSE → THINK → ACT"}'),
    (10, 'Level 9: Actuators', 'level-10-actuators',
      array['Control buzzers, servos, motors, and relays', 'Explain PWM and motor-driver safety', 'Build a sensor-triggered actuator chain'],
      '{"phase":"Sensors, Actuators & Automation","actuators":["buzzer","servo","DC motor","relay"],"skills":["analogWrite","PWM","motor driver"],"project":"Sensor-Triggered Actuator"}'),
    (11, 'Project 4: Automatic Farm Irrigation System', 'project-4-automatic-farm-irrigation-system',
      array['Read and calibrate a soil-moisture sensor', 'Control a relay and pump with a threshold', 'Separate pump power safely', 'Prevent rapid switching'],
      '{"phase":"Sensors, Actuators & Automation","project":"Automatic Farm Irrigation System","pattern":"Soil moisture sensor → Arduino → relay → water pump"}'),
    (12, 'Project 5: Automatic Animal / Poultry Feeder', 'project-5-automatic-animal-poultry-feeder',
      array['Apply sensor and actuator control to an automated feeder', 'Use timing and safe power separation', 'Test and debug an automation system'],
      '{"phase":"Sensors, Actuators & Automation","project":"Automatic Animal / Poultry Feeder"}'),
    (13, 'Level 10: Robotics Fundamentals', 'level-10-robotics-fundamentals',
      array['Explain a 2WD robot chassis', 'Use a motor driver safely', 'Write reusable movement functions', 'Test movement one step at a time'],
      '{"phase":"Robotics Fundamentals","skills":["2WD chassis","motor driver","movement functions"],"project":"Build and test a moving robot"}'),
    (14, '2WD Chassis and Movement', '2wd-chassis-and-movement',
      array['Assemble a 2WD chassis', 'Control forward, reverse, and turning movement', 'Debug motor direction and wiring'],
      '{"phase":"Robotics Fundamentals","project":"2WD chassis build and movement testing"}'),
    (15, 'Project 2: 2WD Remote-Controlled Car', 'project-2-2wd-remote-controlled-car',
      array['Control a robot remotely', 'Map commands to movement functions', 'Test reliable movement and stopping'],
      '{"phase":"Robotics Fundamentals","project":"2WD Remote-Controlled Car"}'),
    (16, 'Project 3: Obstacle-Avoiding Robot', 'project-3-obstacle-avoiding-robot',
      array['Read distance from an ultrasonic sensor', 'Make movement decisions from distance', 'Combine sensing, thinking, and acting'],
      '{"phase":"Robotics Fundamentals","project":"Obstacle-Avoiding Robot","pattern":"SENSE → THINK → ACT"}'),
    (17, 'Autonomous Navigation', 'autonomous-navigation',
      array['Plan an autonomous robot behaviour', 'Combine movement and sensor logic', 'Test navigation systematically'],
      '{"phase":"Advanced Robotics Projects","focus":"Autonomous navigation"}'),
    (18, 'Project 6: Automatic Floor-Mopping Robot', 'project-6-automatic-floor-mopping-robot',
      array['Apply robotics movement to a practical task', 'Plan a robot sequence', 'Test and improve a floor-mopping system'],
      '{"phase":"Advanced Robotics Projects","project":"Automatic Floor-Mopping Robot"}'),
    (19, 'Project 7: Soccer Robot', 'project-7-soccer-robot',
      array['Design robot behaviour for a game task', 'Combine movement, sensing, and control', 'Iterate after testing'],
      '{"phase":"Advanced Robotics Projects","project":"Soccer Robot"}'),
    (20, 'Robotics Challenge', 'robotics-challenge',
      array['Apply course robotics skills to a challenge', 'Debug a complete robot system', 'Demonstrate a working solution'],
      '{"phase":"Advanced Robotics Projects","project":"Robotics Challenge"}'),
    (21, 'ESP32 & Smart Systems', 'esp32-and-smart-systems',
      array['Explain ESP32 capabilities', 'Connect embedded sensing to a smart system', 'Plan a connected system safely'],
      '{"phase":"ESP32 & Smart Systems","hardware":"ESP32"}'),
    (22, 'Project 8: Smart Home / Security System', 'project-8-smart-home-security-system',
      array['Build a smart home or security system', 'Combine sensors, decisions, and actuators', 'Test system states and alerts'],
      '{"phase":"ESP32 & Smart Systems","project":"Smart Home / Security System"}'),
    (23, 'Capstone Engineering Project', 'capstone-engineering-project',
      array['Define an original embedded or robotics problem', 'Plan a team-designed solution', 'Select suitable inputs, processing, and outputs'],
      '{"phase":"Capstone Engineering Project","project":"Team-designed original embedded/robotics system"}'),
    (24, 'Capstone Engineering Project: Testing and Demo', 'capstone-engineering-project-testing-and-demo',
      array['Build and test the capstone system', 'Debug failures systematically', 'Demonstrate and explain the final project'],
      '{"phase":"Capstone Engineering Project","project":"Team-designed original embedded/robotics system","deliverable":"Testing and demo"}')
) as curriculum(week_number, lesson_title, slug, objectives, content)
  on curriculum.week_number = weeks.week_number
where course.slug = 'cpp-embedded-robotics'
on conflict (week_id, slug) do update set
  title = excluded.title,
  objectives = excluded.objectives,
  content = excluded.content,
  published = excluded.published;
