-- Turns the 14 gradeable C++ programming exercises into programs that can
-- actually be marked.
--
-- The previous migration fixed the reference solutions, which had escaped
-- newlines and so were not valid C++. This one goes further, because valid C++
-- was still not gradable:
--
--   - All 15 were bare fragments: no includes, no main.
--   - 12 of 15 called Arduino APIs that do not exist on a Linux box.
--   - 9 of 15 printed nothing at all, so there was no output to compare.
--
-- So each fragment is now wrapped in a complete program: a simulated board
-- whose calls print a trace, the pin layout and constants the exercise assumes,
-- and a main that reads the test input and calls the student's work. The
-- student's section is the only part that differs from the reference.
--
-- The trace is the design decision here, and it is worth being explicit about.
-- These exercises target hardware the grader does not have, so "what does this
-- program do" is answered by recording what it told the board to do. Grading the
-- decision ladder is deliberately not the same task as grading moveForward: the
-- motor helpers are supplied, and the branch is the student's.
--
-- Every expected value in here was produced by compiling the reference solution
-- with g++ and running it, then checked against the arithmetic by hand. The
-- boundary cases matter and are deliberate: a reading of exactly 400 must leave
-- the LED off, and exactly 600 must close the gate, so a student who writes >=
-- instead of > fails.
--
-- ESP32 connection check is not in this migration. It needs a real WiFi
-- association and the executor runs with no network on purpose, so any test
-- would be theatre. It stays teacher-marked, and says so.
--
-- Verified end to end through the executor: 36 of 36 reference cases pass, and
-- 0 of 36 starter-code cases pass, so no exercise is already solved before the
-- student types anything.


-- Branch the smart lens
update public.academy_exercises
   set starter_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------


// The sensors this exercise reads. Set from the test input in main.
int isDark = 0;
int motion = 0;

int main() {
  cin >> isDark >> motion; // first value is darkness, second is motion
  // ---- your code goes between here ----
  bool dark = isDark;
  bool movement = motion;
  // TODO: print "Security light ON" when it is dark AND motion is detected,
  //       "Preparing" when it is only dark, and "Bright" otherwise.
  //       Check the combined case first.
  // ---- and ends here ----

  return 0;
}
',
       solution_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------


// The sensors this exercise reads. Set from the test input in main.
int isDark = 0;
int motion = 0;

int main() {
  cin >> isDark >> motion; // first value is darkness, second is motion
  // ---- your code goes between here ----
  if (isDark && motion) {
    cout << "Security light ON" << endl;
  } else if (isDark) {
    cout << "Preparing" << endl;
  } else {
    cout << "Bright" << endl;
  }
  // ---- and ends here ----

  return 0;
}
',
       tests = '[{"name":"dark with motion arms the light","input":["1","1"],"expected":"Security light ON\n"},{"name":"dark with no motion prepares","input":["1","0"],"expected":"Preparing\n"},{"name":"daylight with motion is bright","input":["0","1"],"expected":"Bright\n"},{"name":"daylight with no motion is bright","input":["0","0"],"expected":"Bright\n"}]'::jsonb,
       instructions = 'This runs on a hosted grader with no hardware, so the board calls in the program print a line instead of doing anything. That printed trace is what the tests check.',
       updated_at = now()
 where title = 'Branch the smart lens';

-- Calibrated night light
update public.academy_exercises
   set starter_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------

#define HIGH 1
#define LOW 0
#define INPUT_PULLUP 2
void pinMode(int pin, int mode) {
  cout << "pinMode " << pin << " " << mode << endl;
}

void digitalWrite(int pin, int value) {
  cout << "digitalWrite " << pin << " " << (value ? "HIGH" : "LOW") << endl;
}

int g_analogIn = 0;
int analogRead(int pin) { (void)pin; return g_analogIn; }

struct SerialPort {
  void println(const string& s) { cout << s << endl; }
  void println(int v) { cout << v << endl; }
  void print(const string& s) { cout << s; }
};
SerialPort Serial;

// Pin layout and constants this exercise assumes.
const int ldrPin = 0;   // A0
const int ledPin = 9;
const int darkThreshold = 400;

int main() {
  cin >> g_analogIn; // the LDR reading for this run
  // ---- your code goes between here ----
  int reading = analogRead(ldrPin);
  Serial.println(reading);
  // TODO: turn the LED on only when the reading is below the threshold,
  //       and off otherwise.
  // ---- and ends here ----

  return 0;
}
',
       solution_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------

#define HIGH 1
#define LOW 0
#define INPUT_PULLUP 2
void pinMode(int pin, int mode) {
  cout << "pinMode " << pin << " " << mode << endl;
}

void digitalWrite(int pin, int value) {
  cout << "digitalWrite " << pin << " " << (value ? "HIGH" : "LOW") << endl;
}

int g_analogIn = 0;
int analogRead(int pin) { (void)pin; return g_analogIn; }

struct SerialPort {
  void println(const string& s) { cout << s << endl; }
  void println(int v) { cout << v << endl; }
  void print(const string& s) { cout << s; }
};
SerialPort Serial;

// Pin layout and constants this exercise assumes.
const int ldrPin = 0;   // A0
const int ledPin = 9;
const int darkThreshold = 400;

int main() {
  cin >> g_analogIn; // the LDR reading for this run
  // ---- your code goes between here ----
  int reading = analogRead(ldrPin);
  Serial.println(reading);
  if (reading < darkThreshold) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
  // ---- and ends here ----

  return 0;
}
',
       tests = '[{"name":"a dark reading turns the LED on","input":["250"],"expected":"250\ndigitalWrite 9 HIGH\n"},{"name":"a reading at the threshold turns it off","input":["400"],"expected":"400\ndigitalWrite 9 LOW\n"},{"name":"a bright reading turns it off","input":["512"],"expected":"512\ndigitalWrite 9 LOW\n"}]'::jsonb,
       instructions = 'This runs on a hosted grader with no hardware, so the board calls in the program print a line instead of doing anything. That printed trace is what the tests check.',
       updated_at = now()
 where title = 'Calibrated night light';

-- Data types quiz calculator
update public.academy_exercises
   set starter_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------


int main() {

  // ---- your code goes between here ----
  int count = 3;
  double temp = 24.5;
  bool ready = true;
  // TODO: print all three on one line, then print 7 / 2, then 7 / 2.0 on
  //       their own lines. Watch the integer division.
  // ---- and ends here ----

  return 0;
}
',
       solution_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------


int main() {

  // ---- your code goes between here ----
  int count = 3;
  double temp = 24.5;
  bool ready = true;
  cout << count << " " << temp << " " << ready << endl;
  cout << 7 / 2 << endl;
  cout << 7 / 2.0 << endl;
  // ---- and ends here ----

  return 0;
}
',
       tests = '[{"name":"types print, and 7/2 truncates while 7/2.0 does not","input":[],"expected":"3 24.5 1\n3\n3.5\n"}]'::jsonb,
       instructions = 'This runs on a hosted grader with no hardware, so the board calls in the program print a line instead of doing anything. That printed trace is what the tests check.',
       updated_at = now()
 where title = 'Data types quiz calculator';

-- Flexible countdown
update public.academy_exercises
   set starter_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------


int main() {

  // ---- your code goes between here ----
  // TODO: count from 5 down to 1 with a for loop, print "Launch!",
  //       then count from 5 down to 1 again with a while loop and print
  //       "Launch!" a second time.
  // ---- and ends here ----

  return 0;
}
',
       solution_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------


int main() {

  // ---- your code goes between here ----
  for (int i = 5; i >= 1; i--) {
    cout << i << endl;
  }
  cout << "Launch!" << endl;

  int j = 5;
  while (j >= 1) {
    cout << j << endl;
    j--;
  }
  cout << "Launch!" << endl;
  // ---- and ends here ----

  return 0;
}
',
       tests = '[{"name":"counts down with both loop forms","input":[],"expected":"5\n4\n3\n2\n1\nLaunch!\n5\n4\n3\n2\n1\nLaunch!\n"}]'::jsonb,
       instructions = 'This runs on a hosted grader with no hardware, so the board calls in the program print a line instead of doing anything. That printed trace is what the tests check.',
       updated_at = now()
 where title = 'Flexible countdown';

-- Functions playground
update public.academy_exercises
   set starter_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------


// TODO: write squareArea(double side) returning side * side, and
//       tipFor(double bill) returning 10% of the bill.

int main() {

  double side = 0, bill = 0;
  cin >> side >> bill;

  // ---- your code goes between here ----
  cout << squareArea(side) << endl;
  cout << tipFor(bill) << endl;
  // ---- and ends here ----

  return 0;
}
',
       solution_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------


double squareArea(double side) {
  return side * side;
}

double tipFor(double bill) {
  return bill * 0.10;
}

int main() {

  double side = 0, bill = 0;
  cin >> side >> bill;

  // ---- your code goes between here ----
  cout << squareArea(side) << endl;
  cout << tipFor(bill) << endl;
  // ---- and ends here ----

  return 0;
}
',
       tests = '[{"name":"squares and tips a whole bill","input":["4","200"],"expected":"16\n20\n"},{"name":"squares a decimal and tips a fraction","input":["2.5","50"],"expected":"6.25\n5\n"}]'::jsonb,
       instructions = 'This runs on a hosted grader with no hardware, so the board calls in the program print a line instead of doing anything. That printed trace is what the tests check.',
       updated_at = now()
 where title = 'Functions playground';

-- Hello, engineer!
update public.academy_exercises
   set starter_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------


int main() {

  // ---- your code goes between here ----
  // TODO: print "Hello, engineer!" and then "Next step: algorithms."
  //       on two separate lines.
  // ---- and ends here ----

  return 0;
}
',
       solution_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------


int main() {

  // ---- your code goes between here ----
  cout << "Hello, engineer!" << endl;
  cout << "Next step: algorithms." << endl;
  // ---- and ends here ----

  return 0;
}
',
       tests = '[{"name":"prints both lines exactly","input":[],"expected":"Hello, engineer!\nNext step: algorithms.\n"}]'::jsonb,
       instructions = 'This runs on a hosted grader with no hardware, so the board calls in the program print a line instead of doing anything. That printed trace is what the tests check.',
       updated_at = now()
 where title = 'Hello, engineer!';

-- LED button control
update public.academy_exercises
   set starter_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------

#define HIGH 1
#define LOW 0
#define INPUT_PULLUP 2
void pinMode(int pin, int mode) {
  cout << "pinMode " << pin << " " << mode << endl;
}

void digitalWrite(int pin, int value) {
  cout << "digitalWrite " << pin << " " << (value ? "HIGH" : "LOW") << endl;
}

// What the board reports back. Set from the test input in main.
int g_digitalIn = LOW;
int digitalRead(int pin) { (void)pin; return g_digitalIn; }

// Pin layout and constants this exercise assumes.
const int buttonPin = 2;
const int ledPin = 13;

void loop() {
  // TODO: turn the LED on pin 13 on only while the button on pin 2 is
  //       pressed. The button is INPUT_PULLUP, so pressed reads LOW.
}

int main() {
  cin >> g_digitalIn; // LOW means pressed
  // ---- your code goes between here ----
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, 0);
  // ---- and ends here ----

  return 0;
}
',
       solution_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------

#define HIGH 1
#define LOW 0
#define INPUT_PULLUP 2
void pinMode(int pin, int mode) {
  cout << "pinMode " << pin << " " << mode << endl;
}

void digitalWrite(int pin, int value) {
  cout << "digitalWrite " << pin << " " << (value ? "HIGH" : "LOW") << endl;
}

// What the board reports back. Set from the test input in main.
int g_digitalIn = LOW;
int digitalRead(int pin) { (void)pin; return g_digitalIn; }

// Pin layout and constants this exercise assumes.
const int buttonPin = 2;
const int ledPin = 13;

void loop() {
  if (digitalRead(buttonPin) == LOW) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
}

int main() {
  cin >> g_digitalIn; // LOW means pressed
  // ---- your code goes between here ----
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, 0);
  loop();
  // ---- and ends here ----

  return 0;
}
',
       tests = '[{"name":"pressed lights the LED","input":["0"],"expected":"pinMode 2 2\npinMode 13 0\ndigitalWrite 13 HIGH\n"},{"name":"released leaves it off","input":["1"],"expected":"pinMode 2 2\npinMode 13 0\ndigitalWrite 13 LOW\n"}]'::jsonb,
       instructions = 'This runs on a hosted grader with no hardware, so the board calls in the program print a line instead of doing anything. That printed trace is what the tests check.',
       updated_at = now()
 where title = 'LED button control';

-- Movement primitives
update public.academy_exercises
   set starter_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------

#define HIGH 1
#define LOW 0
#define INPUT_PULLUP 2
void pinMode(int pin, int mode) {
  cout << "pinMode " << pin << " " << mode << endl;
}

void digitalWrite(int pin, int value) {
  cout << "digitalWrite " << pin << " " << (value ? "HIGH" : "LOW") << endl;
}

void analogWrite(int pin, int value) {
  cout << "analogWrite " << pin << " " << value << endl;
}

void delay(int ms) { cout << "delay " << ms << endl; }

// Pin layout and constants this exercise assumes.
const int in1 = 4;
const int in2 = 5;
const int enA = 6;

int main() {

  int speed = 0, duration = 0;
  cin >> speed >> duration;

  // ---- your code goes between here ----
  // TODO: moveForward and turnLeft are defined above. Call each one
  //       once with the speed and duration read above.
  // ---- and ends here ----

  return 0;
}
',
       solution_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------

#define HIGH 1
#define LOW 0
#define INPUT_PULLUP 2
void pinMode(int pin, int mode) {
  cout << "pinMode " << pin << " " << mode << endl;
}

void digitalWrite(int pin, int value) {
  cout << "digitalWrite " << pin << " " << (value ? "HIGH" : "LOW") << endl;
}

void analogWrite(int pin, int value) {
  cout << "analogWrite " << pin << " " << value << endl;
}

void delay(int ms) { cout << "delay " << ms << endl; }

// Pin layout and constants this exercise assumes.
const int in1 = 4;
const int in2 = 5;
const int enA = 6;

void moveForward(int speed, int duration) {
  digitalWrite(in1, HIGH); digitalWrite(in2, LOW);
  analogWrite(enA, speed);
  delay(duration);
  analogWrite(enA, 0);
}

void turnLeft(int speed, int duration) {
  digitalWrite(in1, LOW); digitalWrite(in2, HIGH);
  analogWrite(enA, speed);
  delay(duration);
  analogWrite(enA, 0);
}

int main() {

  int speed = 0, duration = 0;
  cin >> speed >> duration;

  // ---- your code goes between here ----
  moveForward(speed, duration);
  turnLeft(speed, duration);
  // ---- and ends here ----

  return 0;
}
',
       tests = '[{"name":"drives forward then turns left","input":["160","200"],"expected":"digitalWrite 4 HIGH\ndigitalWrite 5 LOW\nanalogWrite 6 160\ndelay 200\nanalogWrite 6 0\ndigitalWrite 4 LOW\ndigitalWrite 5 HIGH\nanalogWrite 6 160\ndelay 200\nanalogWrite 6 0\n"},{"name":"a slower turn still stops afterwards","input":["90","50"],"expected":"digitalWrite 4 HIGH\ndigitalWrite 5 LOW\nanalogWrite 6 90\ndelay 50\nanalogWrite 6 0\ndigitalWrite 4 LOW\ndigitalWrite 5 HIGH\nanalogWrite 6 90\ndelay 50\nanalogWrite 6 0\n"}]'::jsonb,
       instructions = 'This runs on a hosted grader with no hardware, so the board calls in the program print a line instead of doing anything. That printed trace is what the tests check.',
       updated_at = now()
 where title = 'Movement primitives';

-- Obstacle decision ladder
update public.academy_exercises
   set starter_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------

// The motor helpers an exercise assumes. Recorded, not driven.
void moveForward(int speed, int duration) {
  cout << "forward " << speed << " " << duration << endl;
}
void moveReverse(int speed, int duration) {
  cout << "reverse " << speed << " " << duration << endl;
}
void turnLeft(int speed, int duration) {
  cout << "left " << speed << " " << duration << endl;
}
void turnRight(int speed, int duration) {
  cout << "right " << speed << " " << duration << endl;
}
void stop() { cout << "stop" << endl; }
void scanForBall() { cout << "scan" << endl; }

// Named obstacleDistance, not distance: with using namespace std in
// scope, a global called distance is ambiguous against std::distance.
int obstacleDistance = 0;

int main() {
  cin >> obstacleDistance; // centimetres to the obstacle
  // ---- your code goes between here ----
  // TODO: drive forward when obstacleDistance is more than 30, turn
  //       left when it is between 15 and 30, and when it is 15 or less
  //       reverse then turn right.
  // ---- and ends here ----

  return 0;
}
',
       solution_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------

// The motor helpers an exercise assumes. Recorded, not driven.
void moveForward(int speed, int duration) {
  cout << "forward " << speed << " " << duration << endl;
}
void moveReverse(int speed, int duration) {
  cout << "reverse " << speed << " " << duration << endl;
}
void turnLeft(int speed, int duration) {
  cout << "left " << speed << " " << duration << endl;
}
void turnRight(int speed, int duration) {
  cout << "right " << speed << " " << duration << endl;
}
void stop() { cout << "stop" << endl; }
void scanForBall() { cout << "scan" << endl; }

// Named obstacleDistance, not distance: with using namespace std in
// scope, a global called distance is ambiguous against std::distance.
int obstacleDistance = 0;

int main() {
  cin >> obstacleDistance; // centimetres to the obstacle
  // ---- your code goes between here ----
  if (obstacleDistance > 30) {
    moveForward(160, 200);
  } else if (obstacleDistance > 15) {
    turnLeft(160, 200);
  } else {
    moveReverse(150, 300);
    turnRight(160, 250);
  }
  // ---- and ends here ----

  return 0;
}
',
       tests = '[{"name":"a clear path drives forward","input":["50"],"expected":"forward 160 200\n"},{"name":"a close obstacle turns left","input":["20"],"expected":"left 160 200\n"},{"name":"a very close obstacle reverses and turns right","input":["10"],"expected":"reverse 150 300\nright 160 250\n"}]'::jsonb,
       instructions = 'This runs on a hosted grader with no hardware, so the board calls in the program print a line instead of doing anything. That printed trace is what the tests check.',
       updated_at = now()
 where title = 'Obstacle decision ladder';

-- Remote command mapping
update public.academy_exercises
   set starter_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------

// The motor helpers an exercise assumes. Recorded, not driven.
void moveForward(int speed, int duration) {
  cout << "forward " << speed << " " << duration << endl;
}
void moveReverse(int speed, int duration) {
  cout << "reverse " << speed << " " << duration << endl;
}
void turnLeft(int speed, int duration) {
  cout << "left " << speed << " " << duration << endl;
}
void turnRight(int speed, int duration) {
  cout << "right " << speed << " " << duration << endl;
}
void stop() { cout << "stop" << endl; }
void scanForBall() { cout << "scan" << endl; }

int command = 0;

int main() {
  cin >> command; // the remote code for this run
  // ---- your code goes between here ----
  // TODO: map 0x00 forward, 0x01 reverse, 0x02 left, 0x03 right,
  //       and stop() for anything else.
  // ---- and ends here ----

  return 0;
}
',
       solution_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------

// The motor helpers an exercise assumes. Recorded, not driven.
void moveForward(int speed, int duration) {
  cout << "forward " << speed << " " << duration << endl;
}
void moveReverse(int speed, int duration) {
  cout << "reverse " << speed << " " << duration << endl;
}
void turnLeft(int speed, int duration) {
  cout << "left " << speed << " " << duration << endl;
}
void turnRight(int speed, int duration) {
  cout << "right " << speed << " " << duration << endl;
}
void stop() { cout << "stop" << endl; }
void scanForBall() { cout << "scan" << endl; }

int command = 0;

int main() {
  cin >> command; // the remote code for this run
  // ---- your code goes between here ----
  switch (command) {
    case 0x00: moveForward(180, 300); break;
    case 0x01: moveReverse(180, 300); break;
    case 0x02: turnLeft(180, 250); break;
    case 0x03: turnRight(180, 250); break;
    default: stop(); break;
  }
  // ---- and ends here ----

  return 0;
}
',
       tests = '[{"name":"code 0 drives forward","input":["0"],"expected":"forward 180 300\n"},{"name":"code 1 reverses","input":["1"],"expected":"reverse 180 300\n"},{"name":"code 2 turns left","input":["2"],"expected":"left 180 250\n"},{"name":"code 3 turns right","input":["3"],"expected":"right 180 250\n"},{"name":"an unknown code stops","input":["9"],"expected":"stop\n"}]'::jsonb,
       instructions = 'This runs on a hosted grader with no hardware, so the board calls in the program print a line instead of doing anything. That printed trace is what the tests check.',
       updated_at = now()
 where title = 'Remote command mapping';

-- Security state machine
update public.academy_exercises
   set starter_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------

#define HIGH 1
#define LOW 0
#define INPUT_PULLUP 2
void pinMode(int pin, int mode) {
  cout << "pinMode " << pin << " " << mode << endl;
}

void digitalWrite(int pin, int value) {
  cout << "digitalWrite " << pin << " " << (value ? "HIGH" : "LOW") << endl;
}

// Pin layout and constants this exercise assumes.
const int alarmPin = 8;
const int DISARM = 0;
const int ARM = 1;
const int TRIGGERED = 2;

int state = DISARM;
int motion = 0;

int main() {
  cin >> state >> motion; // the current state, then whether there is motion
  // ---- your code goes between here ----
  // TODO: when the state is ARM and there is motion, it becomes
  //       TRIGGERED. Then sound the alarm while the state is TRIGGERED and
  //       keep it silent otherwise.
  // ---- and ends here ----

  return 0;
}
',
       solution_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------

#define HIGH 1
#define LOW 0
#define INPUT_PULLUP 2
void pinMode(int pin, int mode) {
  cout << "pinMode " << pin << " " << mode << endl;
}

void digitalWrite(int pin, int value) {
  cout << "digitalWrite " << pin << " " << (value ? "HIGH" : "LOW") << endl;
}

// Pin layout and constants this exercise assumes.
const int alarmPin = 8;
const int DISARM = 0;
const int ARM = 1;
const int TRIGGERED = 2;

int state = DISARM;
int motion = 0;

int main() {
  cin >> state >> motion; // the current state, then whether there is motion
  // ---- your code goes between here ----
  if (state == ARM && motion) state = TRIGGERED;
  if (state == TRIGGERED) digitalWrite(alarmPin, HIGH);
  else digitalWrite(alarmPin, LOW);
  // ---- and ends here ----

  return 0;
}
',
       tests = '[{"name":"disarmed ignores motion","input":["0","1"],"expected":"digitalWrite 8 LOW\n"},{"name":"armed with motion triggers the alarm","input":["1","1"],"expected":"digitalWrite 8 HIGH\n"},{"name":"armed with no motion stays quiet","input":["1","0"],"expected":"digitalWrite 8 LOW\n"},{"name":"already triggered keeps sounding","input":["2","0"],"expected":"digitalWrite 8 HIGH\n"}]'::jsonb,
       instructions = 'This runs on a hosted grader with no hardware, so the board calls in the program print a line instead of doing anything. That printed trace is what the tests check.',
       updated_at = now()
 where title = 'Security state machine';

-- Sensor readings summary
update public.academy_exercises
   set starter_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------


int main() {

  // ---- your code goes between here ----
  double readings[] = {310, 420, 380, 450, 330};
  int n = 5;
  double total = 0;
  double minimum = readings[0];
  // TODO: loop over the readings to fill in the total and the minimum, then
  //       print the average and the minimum.
  // ---- and ends here ----

  return 0;
}
',
       solution_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------


int main() {

  // ---- your code goes between here ----
  double readings[] = {310, 420, 380, 450, 330};
  int n = 5;
  double total = 0;
  double minimum = readings[0];
  for (int i = 0; i < n; i++) {
    total += readings[i];
    if (readings[i] < minimum) minimum = readings[i];
  }
  cout << "Average: " << total / n << endl;
  cout << "Minimum: " << minimum << endl;
  // ---- and ends here ----

  return 0;
}
',
       tests = '[{"name":"averages the five readings and finds the lowest","input":[],"expected":"Average: 378\nMinimum: 310\n"}]'::jsonb,
       instructions = 'This runs on a hosted grader with no hardware, so the board calls in the program print a line instead of doing anything. That printed trace is what the tests check.',
       updated_at = now()
 where title = 'Sensor readings summary';

-- Servo gate opener
update public.academy_exercises
   set starter_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------

#define HIGH 1
#define LOW 0
#define INPUT_PULLUP 2
void pinMode(int pin, int mode) {
  cout << "pinMode " << pin << " " << mode << endl;
}

int g_analogIn = 0;
int analogRead(int pin) { (void)pin; return g_analogIn; }

struct Servo {
  int pin = -1;
  void attach(int p) { pin = p; cout << "servo attach " << p << endl; }
  void write(int degrees) { cout << "servo " << pin << " " << degrees << endl; }
};
Servo gate;

void delay(int ms) { cout << "delay " << ms << endl; }

// Pin layout and constants this exercise assumes.
const int ldrPin = 0;   // A0
const int servoPin = 9;

int main() {
  cin >> g_analogIn; // the LDR reading for this run
  // ---- your code goes between here ----
  gate.attach(servoPin);
  int light = analogRead(ldrPin);
  // TODO: open the gate to 90 degrees when the reading is above 600,
  //       otherwise close it to 0.
  // ---- and ends here ----

  return 0;
}
',
       solution_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------

#define HIGH 1
#define LOW 0
#define INPUT_PULLUP 2
void pinMode(int pin, int mode) {
  cout << "pinMode " << pin << " " << mode << endl;
}

int g_analogIn = 0;
int analogRead(int pin) { (void)pin; return g_analogIn; }

struct Servo {
  int pin = -1;
  void attach(int p) { pin = p; cout << "servo attach " << p << endl; }
  void write(int degrees) { cout << "servo " << pin << " " << degrees << endl; }
};
Servo gate;

void delay(int ms) { cout << "delay " << ms << endl; }

// Pin layout and constants this exercise assumes.
const int ldrPin = 0;   // A0
const int servoPin = 9;

int main() {
  cin >> g_analogIn; // the LDR reading for this run
  // ---- your code goes between here ----
  gate.attach(servoPin);
  int light = analogRead(ldrPin);
  if (light > 600) {
    gate.write(90);
  } else {
    gate.write(0);
  }
  delay(30);
  // ---- and ends here ----

  return 0;
}
',
       tests = '[{"name":"bright light opens the gate","input":["700"],"expected":"servo attach 9\nservo 9 90\ndelay 30\n"},{"name":"a reading at the threshold closes it","input":["600"],"expected":"servo attach 9\nservo 9 0\ndelay 30\n"},{"name":"dim light closes it","input":["300"],"expected":"servo attach 9\nservo 9 0\ndelay 30\n"}]'::jsonb,
       instructions = 'This runs on a hosted grader with no hardware, so the board calls in the program print a line instead of doing anything. That printed trace is what the tests check.',
       updated_at = now()
 where title = 'Servo gate opener';

-- Soccer chase rules
update public.academy_exercises
   set starter_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------

// The motor helpers an exercise assumes. Recorded, not driven.
void moveForward(int speed, int duration) {
  cout << "forward " << speed << " " << duration << endl;
}
void moveReverse(int speed, int duration) {
  cout << "reverse " << speed << " " << duration << endl;
}
void turnLeft(int speed, int duration) {
  cout << "left " << speed << " " << duration << endl;
}
void turnRight(int speed, int duration) {
  cout << "right " << speed << " " << duration << endl;
}
void stop() { cout << "stop" << endl; }
void scanForBall() { cout << "scan" << endl; }

// Pin layout and constants this exercise assumes.
const int CENTER = 0;
const int LEFT = 1;
const int RIGHT = 2;

int direction = CENTER;

int main() {
  cin >> direction; // where the ball is
  // ---- your code goes between here ----
  // TODO: CENTER drives forward, LEFT turns left, RIGHT turns right,
  //       and anything else scans for the ball.
  // ---- and ends here ----

  return 0;
}
',
       solution_code = '#include <iostream>
#include <string>
using namespace std;
// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------

// The motor helpers an exercise assumes. Recorded, not driven.
void moveForward(int speed, int duration) {
  cout << "forward " << speed << " " << duration << endl;
}
void moveReverse(int speed, int duration) {
  cout << "reverse " << speed << " " << duration << endl;
}
void turnLeft(int speed, int duration) {
  cout << "left " << speed << " " << duration << endl;
}
void turnRight(int speed, int duration) {
  cout << "right " << speed << " " << duration << endl;
}
void stop() { cout << "stop" << endl; }
void scanForBall() { cout << "scan" << endl; }

// Pin layout and constants this exercise assumes.
const int CENTER = 0;
const int LEFT = 1;
const int RIGHT = 2;

int direction = CENTER;

int main() {
  cin >> direction; // where the ball is
  // ---- your code goes between here ----
  if (direction == CENTER) {
    moveForward(200, 100);
  } else if (direction == LEFT) {
    turnLeft(180, 120);
  } else if (direction == RIGHT) {
    turnRight(180, 120);
  } else {
    scanForBall();
  }
  // ---- and ends here ----

  return 0;
}
',
       tests = '[{"name":"ball ahead drives forward","input":["0"],"expected":"forward 200 100\n"},{"name":"ball left turns left","input":["1"],"expected":"left 180 120\n"},{"name":"ball right turns right","input":["2"],"expected":"right 180 120\n"},{"name":"no ball scans","input":["9"],"expected":"scan\n"}]'::jsonb,
       instructions = 'This runs on a hosted grader with no hardware, so the board calls in the program print a line instead of doing anything. That printed trace is what the tests check.',
       updated_at = now()
 where title = 'Soccer chase rules';

-- Not auto-gradable, and now says so instead of appearing to be an oversight.
update public.academy_exercises
   set instructions = 'Connect the ESP32 to WiFi and print its local IP address once connected. This one is marked by a teacher rather than automatically: it needs a real WiFi association, and the grading service deliberately runs with no network, so there is no honest way to test it. Bring a screenshot of the serial monitor showing the address.',
       tests = '[]'::jsonb,
       updated_at = now()
 where title = 'ESP32 connection check';
