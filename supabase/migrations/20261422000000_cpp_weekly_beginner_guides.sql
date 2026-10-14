update public.academy_assignments assignment
set instructions = seed.instructions,
    starter_code = seed.starter_code,
    automated_tests = coalesce(seed.automated_tests, assignment.automated_tests),
    updated_at = now()
from public.academy_courses course
join public.academy_weeks week on week.course_id = course.id
join (
  values
    (
      1,
      E'1. Print exactly these three lines, with the same spelling and capital letters:\nReady\nCheck the sensor\nReport\n2. Do not read any program input.\n\nExpected output:\nReady\nCheck the sensor\nReport',
      E'#include <iostream>\nusing namespace std;\n\nint main() {\n    // TODO: print the three required lines\n    return 0;\n}',
      null::jsonb
    ),
    (
      2,
      E'1. Read the millivolt value from Program input.\n2. Print "Voltage too low" when it is less than 3300. Otherwise print "Voltage OK".\n\nProgram input example: 3000\nExpected output: Voltage too low\n\nTry 3300 as well; the expected output is Voltage OK.',
      E'#include <iostream>\nusing namespace std;\n\nint main() {\n    int millivolts = 0;\n    cin >> millivolts;\n    // TODO: print the matching voltage message\n    return 0;\n}',
      null::jsonb
    ),
    (
      3,
      E'The program already sets distance to 60. Do not read input.\n1. Print "slow" when distance is below 30.\n2. Print "medium" when distance is from 30 through 99.\n3. Otherwise print "fast".\n\nExpected output: medium\n\nTo try the other answers, change distance to 10 and then 120. Set it back to 60 before submitting.',
      E'#include <iostream>\nusing namespace std;\n\nint main() {\n    int distance = 60;\n    // TODO: print slow, medium or fast using if and else\n    return 0;\n}',
      E'[{"name":"distance of 60 selects medium","input":[],"expected":"medium"}]'::jsonb
    ),
    (
      4,
      E'1. Read the limit from Program input.\n2. Use a loop to print every whole number from 1 up to and including the limit, one number per line.\n\nProgram input example: 5\nExpected output:\n1\n2\n3\n4\n5',
      E'#include <iostream>\nusing namespace std;\n\nint main() {\n    int limit = 0;\n    cin >> limit;\n    // TODO: use a loop to print 1 through limit\n    return 0;\n}',
      null::jsonb
    ),
    (
      5,
      E'1. Complete the isBright function so it returns true when a reading is 400 or more, and false otherwise.\n2. Read one reading from Program input.\n3. Print "bright" when isBright returns true; otherwise print "dim".\n\nProgram input example: 400\nExpected output: bright\n\nTry 399 as well; the expected output is dim.',
      E'#include <iostream>\nusing namespace std;\n\n// TODO: write isBright so it returns whether reading is at least 400\n\nint main() {\n    int reading = 0;\n    cin >> reading;\n    cout << (isBright(reading) ? "bright" : "dim") << endl;\n    return 0;\n}',
      null::jsonb
    ),
    (
      6,
      E'1. Read five whole-number sensor readings from Program input.\n2. Add the readings, divide the total by 5, and print only the whole-number average.\n\nProgram input example (five values): 10 20 30 40 60\nExpected output: 32',
      E'#include <iostream>\nusing namespace std;\n\nint main() {\n          int first = 0;
      int second = 0;
      int third = 0;
      int fourth = 0;
      int fifth = 0;\n    cin >> first >> second >> third >> fourth >> fifth;\n    // TODO: add the readings, calculate the whole-number average, and print it\n    return 0;\n}',
      E'[{"name":"averages five readings","input":["10","20","30","40","60"],"expected":"32"},{"name":"averages another five readings","input":["1","2","3","4","10"],"expected":"4"}]'::jsonb
    ),
    (
      7,
      E'1. Read the button state from Program input: 1 means pressed and 0 means released.\n2. Print "led on" for 1. Print "led off" for 0.\n\nProgram input example: 1\nExpected output: led on\n\nTry 0 as well; the expected output is led off.',
      E'#include <iostream>\nusing namespace std;\n\nint main() {\n    int pressed = 0;\n    cin >> pressed;\n    // TODO: print led on or led off using if and else\n    return 0;\n}',
      null::jsonb
    ),
    (
      8,
      E'1. Read a whole-number sensor value from 0 to 1023.\n2. Calculate the whole-number percentage with raw * 100 / 1023 and store it in an int variable.\n3. Print the percentage followed by " pct".\n\nProgram input example: 512\nExpected output: 50 pct',
      E'#include <iostream>\nusing namespace std;\n\nint main() {\n    int raw = 0;\n    cin >> raw;\n    int percent = 0; // TODO: replace 0 with raw * 100 / 1023\n    cout << percent << " pct" << endl;\n    return 0;\n}',
      null::jsonb
    ),
    (
      9,
      E'1. Read two whole-number distance readings from Program input.\n2. Calculate their whole-number average and print it.\n3. If the average is below 30, print "alarm" on the next line. Otherwise, print nothing else.\n\nProgram input example: 10 30\nExpected output:\n20\nalarm\n\nTry 40 60 as well; the expected output is 50.',
      E'#include <iostream>\nusing namespace std;\n\nint main() {\n    int first = 0;\n    int second = 0;\n    cin >> first >> second;\n    // TODO: print the whole-number average\n    // TODO: print alarm on a new line only when the average is below 30\n    return 0;\n}',
      E'[{"name":"averages two readings and triggers alarm","input":["10","30"],"expected":"20\\nalarm"},{"name":"averages two clear readings","input":["40","60"],"expected":"50"}]'::jsonb
    ),
    (
      10,
      E'Print these six motor speed values, one per line: 0, 50, 100, 150, 200, and 250.\n1. Use a loop that starts at 0 and adds 50 each time.\n2. Stop after printing 250. Do not print 255 or any value above 250.\n3. Do not read program input.\n\nExpected output:\n0\n50\n100\n150\n200\n250',
      E'#include <iostream>\nusing namespace std;\n\nint main() {\n    int speed = 0;\n    while (speed <= 250) {\n        // TODO: print speed\n        speed += 50;\n    }\n    return 0;\n}',
      null::jsonb
    ),
    (
      11,
      E'1. Read the soil moisture percentage from Program input.\n2. Print "water" when moisture is below 40. Otherwise print "skip".\n\nProgram input example: 25\nExpected output: water\n\nTry 55 as well; the expected output is skip.',
      E'#include <iostream>\nusing namespace std;\n\nint main() {\n    int moisture = 0;\n    cin >> moisture;\n    // TODO: print water or skip using if and else\n    return 0;\n}',
      null::jsonb
    ),
    (
      12,
      E'1. Read the number of hours since the last feed from Program input.\n2. Print "feed" when it has been 6 hours or more. Otherwise print "wait".\n\nProgram input example: 8\nExpected output: feed\n\nTry 2 as well; the expected output is wait.',
      E'#include <iostream>\nusing namespace std;\n\nint main() {\n    int hours = 0;\n    cin >> hours;\n    // TODO: print feed or wait using if and else\n    return 0;\n}',
      null::jsonb
    ),
    (
      13,
      E'Print these four movement commands in this exact order, one per line:\nforward\nturn\nforward\nturn\n\nDo not read program input.',
      E'#include <iostream>\nusing namespace std;\n\nint main() {\n    // TODO: print the four movement commands in order\n    return 0;\n}',
      null::jsonb
    ),
    (
      14,
      E'1. Read direction from Program input: 1 means forward and -1 means reverse.\n2. The left motor uses pin 9 and the right motor uses pin 10.\n3. Print the left pin then the right pin for direction 1. Swap their order for direction -1.\n\nProgram input example: 1\nExpected output: 9 10\n\nTry -1 as well; the expected output is 10 9.',
      E'#include <iostream>\nusing namespace std;\n\nint main() {\n    int direction = 0;\n    cin >> direction;\n    // TODO: print the motor pins in the correct order\n    return 0;\n}',
      null::jsonb
    ),
    (
      15,
      E'1. Read one command letter from Program input.\n2. F means forward, B means back, L means left, and R means right.\n3. Print the matching word. For any other letter, print "unknown".\n\nProgram input example: F\nExpected output: forward\n\nTry X as well.\nExpected output: unknown.',
      E'#include <iostream>\nusing namespace std;\n\nint main() {\n    char command = 0;\n    cin >> command;\n    switch (command) {\n        case ''F'':\n            // TODO: print forward\n            break;\n        case ''B'':\n            // TODO: print back\n            break;\n        case ''L'':\n            // TODO: print left\n            break;\n        case ''R'':\n            // TODO: print right\n            break;\n        default:\n            // TODO: print unknown\n    }\n    return 0;\n}',
      null::jsonb
    )
) as seed(week_number, instructions, starter_code, automated_tests)
  on seed.week_number = week.week_number
where assignment.course_id = course.id
  and assignment.week_id = week.id
  and course.slug = 'cpp-embedded-robotics';

notify pgrst, 'reload schema';
