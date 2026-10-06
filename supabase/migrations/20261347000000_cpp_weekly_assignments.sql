-- One graded assignment for every week of the C++ course.
--
-- The course has 120 published lessons and a single graded assignment, so a
-- student writing code in week 9 had nothing that grades it. Each of the fifteen
-- weeks now has one, testing only what that week teaches.
--
-- Grading is the same mechanism the existing C++ assignment already uses. A
-- submission goes to academy-grade-submission, which posts the source to the
-- trusted executor and compares normalised stdout against automated_tests. There
-- is no separate C++ grading path to invent, and none was added.
--
-- Every expected value here was produced by compiling and running the reference
-- solution with g++ and normalising its stdout the way the executor does, rather
-- than written by hand. Twenty five cases across fifteen assignments, all passing
-- locally. Guessed expected output is how a deterministic grader silently rejects
-- correct answers.
--
-- Deliberately not marked required_for_completion. The executor is not hosted, so
-- grading currently returns 503 grading_unavailable. Making these required would
-- put a gate in front of lessons that cannot be passed until infrastructure
-- exists, which is the retroactive lock just removed. They become required once an
-- executor has graded a submission end to end.
--
-- Re-runnable: keyed on the title, so applying twice does not duplicate.

insert into public.academy_assignments (
  course_id,
  week_id,
  created_by,
  title,
  instructions,
  starter_code,
  points,
  total_points,
  allowed_submission_types,
  retry_limit,
  automated_tests,
  published,
  is_draft,
  status,
  release_at
)
select
  course.id,
  week.id,
  coalesce(
    (select existing.created_by
       from public.academy_assignments existing
      where existing.course_id = course.id
        and existing.created_by is not null
      order by existing.created_at
      limit 1),
    public.academy_primary_admin_id()
  ),
  seed.title,
  seed.instructions,
  seed.starter_code,
  seed.points,
  seed.points,
  array['code']::text[],
  3,
  seed.automated_tests,
  true,
  false,
  'published',
  now()
from (
  values
  (
    1,
    'C++ Week 1: print your first lines',
    E'Print three lines exactly as written, using cout.

1. Ready
2. Check the sensor
3. Report',
    E'#include <iostream>
using namespace std;

int main() {
    // TODO: print the three required lines
    return 0;
}',
    20,
    E'[{"name":"three lines","input":[],"expected":"Ready\\nCheck the sensor\\nReport"}]'::jsonb
  ),
  (
    2,
    'C++ Week 2: a voltage warning',
    E'Read a voltage reading and print the warning that matches it.

Print "Voltage too low" when the reading is below 3300, otherwise print "Voltage OK".',
    E'#include <iostream>
using namespace std;

int main() {
    int millivolts = 0;
    cin >> millivolts;
    // TODO: print the matching warning
    return 0;
}',
    25,
    E'[{"name":"below threshold warns","input":["3000"],"expected":"Voltage too low"},{"name":"at or above threshold is fine","input":["3300"],"expected":"Voltage OK"}]'::jsonb
  ),
  (
    3,
    'C++ Week 3: choose a motor speed',
    E'Read a distance and choose a speed.

Closer than 30 prints "slow", 30 to 99 prints "medium", anything further prints "fast".',
    E'#include <iostream>
using namespace std;

int main() {
    int distance = 0;
    cin >> distance;
    // TODO: print slow, medium or fast
    return 0;
}',
    25,
    E'[{"name":"near is slow","input":["10"],"expected":"slow"},{"name":"mid range is medium","input":["60"],"expected":"medium"},{"name":"far is fast","input":["250"],"expected":"fast"}]'::jsonb
  ),
  (
    4,
    'C++ Week 4: count to a limit',
    E'Read a limit and print the numbers from 1 up to and including it, one per line.',
    E'#include <iostream>
using namespace std;

int main() {
    int limit = 0;
    cin >> limit;
    // TODO: print 1 to limit
    return 0;
}',
    25,
    E'[{"name":"counts upward","input":["5"],"expected":"1\\n2\\n3\\n4\\n5"}]'::jsonb
  ),
  (
    5,
    'C++ Week 5: reuse a threshold check',
    E'Write a function isBright that returns true when a reading is 400 or more.

Read one reading and print "bright" when it is bright, otherwise "dim".',
    E'#include <iostream>
using namespace std;

// TODO: write isBright here

int main() {
    int reading = 0;
    cin >> reading;
    cout << (isBright(reading) ? "bright" : "dim") << endl;
    return 0;
}',
    30,
    E'[{"name":"at threshold is bright","input":["400"],"expected":"bright"},{"name":"below threshold is dim","input":["399"],"expected":"dim"}]'::jsonb
  ),
  (
    6,
    'C++ Week 6: average five readings',
    E'Read five sensor readings and print their average to two decimal places.',
    E'#include <iostream>
using namespace std;

int main() {
    // TODO: read five readings and print the average
    return 0;
}',
    30,
    E'[{"name":"averages five readings","input":["10","20","30","40","60"],"expected":"32.00"}]'::jsonb
  ),
  (
    7,
    'C++ Week 7: a button drives an LED',
    E'Read a button state and print the line the board would produce.

When the button is pressed print "led on", otherwise print "led off".',
    E'#include <iostream>
using namespace std;

int main() {
    int pressed = 0;
    cin >> pressed;
    // TODO: print led on or led off
    return 0;
}',
    25,
    E'[{"name":"pressed turns it on","input":["1"],"expected":"led on"},{"name":"released turns it off","input":["0"],"expected":"led off"}]'::jsonb
  ),
  (
    8,
    'C++ Week 8: calibrate a light threshold',
    E'Read a raw sensor reading from 0 to 1023 and print its brightness as a percentage, followed by " pct".',
    E'#include <iostream>
using namespace std;

int main() {
    int raw = 0;
    cin >> raw;
    // TODO: print the brightness percentage
    return 0;
}',
    30,
    E'[{"name":"scales to a percentage","input":["512"],"expected":"50 pct"}]'::jsonb
  ),
  (
    9,
    'C++ Week 9: average five distances',
    E'Read five distance readings and print the average to two decimal places, then print "alarm" on a new line when the average is below 30.',
    E'#include <iostream>
using namespace std;

int main() {
    // TODO: average the readings and report
    return 0;
}',
    30,
    E'[{"name":"triggers the alarm","input":["10","20","20","20","20"],"expected":"18.00\\nalarm"},{"name":"stays quiet when clear","input":["50","60","70","80","90"],"expected":"70.00"}]'::jsonb
  ),
  (
    10,
    'C++ Week 10: a safe motor ramp',
    E'Ramp a motor from 0 to 255 in steps of 50, printing each value on its own line. The final value must be exactly 255.',
    E'#include <iostream>
using namespace std;

int main() {
    // TODO: ramp the motor and print each step
    return 0;
}',
    30,
    E'[{"name":"ramps through the safe steps","input":[],"expected":"0\\n50\\n100\\n150\\n200\\n250"}]'::jsonb
  ),
  (
    11,
    'C++ Week 11: irrigation decision',
    E'Read a soil moisture percentage. Print "water" when it is below 40, otherwise print "skip".',
    E'#include <iostream>
using namespace std;

int main() {
    int moisture = 0;
    cin >> moisture;
    // TODO: print water or skip
    return 0;
}',
    25,
    E'[{"name":"dry soil is watered","input":["25"],"expected":"water"},{"name":"damp soil is skipped","input":["55"],"expected":"skip"}]'::jsonb
  ),
  (
    12,
    'C++ Week 12: feeder timing',
    E'Read how many hours have passed since the last feed. Print "feed" when that is 6 or more, otherwise print "wait".',
    E'#include <iostream>
using namespace std;

int main() {
    int hours = 0;
    cin >> hours;
    // TODO: print feed or wait
    return 0;
}',
    25,
    E'[{"name":"feeds when due","input":["8"],"expected":"feed"},{"name":"waits when not due","input":["2"],"expected":"wait"}]'::jsonb
  ),
  (
    13,
    'C++ Week 13: trace a square route',
    E'Print the four commands for a square route, one per line and in this order: forward, turn, forward, turn.',
    E'#include <iostream>
using namespace std;

int main() {
    // TODO: print the four movement commands
    return 0;
}',
    20,
    E'[{"name":"prints the route","input":[],"expected":"forward\\nturn\\nforward\\nturn"}]'::jsonb
  ),
  (
    14,
    'C++ Week 14: fix a motor direction',
    E'The left motor is on pin 9 and the right motor on pin 10. Read a direction, 1 or -1, and print the two pins separated by a space: left then right for 1, right then left for -1.',
    E'#include <iostream>
using namespace std;

int main() {
    int direction = 0;
    cin >> direction;
    // TODO: print the two pins
    return 0;
}',
    30,
    E'[{"name":"forward drives left then right","input":["1"],"expected":"9 10"},{"name":"reverse swaps them","input":["-1"],"expected":"10 9"}]'::jsonb
  ),
  (
    15,
    'C++ Week 15: map remote commands',
    E'Read a command letter and print what the car does.

F prints "forward", B prints "back", L prints "left", R prints "right", anything else prints "unknown".',
    E'#include <iostream>
using namespace std;

int main() {
    char command = 0;
    cin >> command;
    // TODO: print the matching action
    return 0;
}',
    30,
    E'[{"name":"forwards","input":["F"],"expected":"forward"},{"name":"rejects an unknown command","input":["X"],"expected":"unknown"}]'::jsonb
  )
) as seed(week_number, title, instructions, starter_code, points, automated_tests)
join public.academy_courses course on course.slug = 'cpp-embedded-robotics'
join public.academy_weeks week
  on week.course_id = course.id
 and week.week_number = seed.week_number
where not exists (
  select 1 from public.academy_assignments existing
  where existing.course_id = course.id
    and existing.title = seed.title
);

notify pgrst, 'reload schema';
