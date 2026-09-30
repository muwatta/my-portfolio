// Wraps the C++ exercise fragments into complete, gradeable programs.
//
// The 15 programming exercises were written as bare fragments: no includes, no
// main, and 12 of them calling Arduino APIs that do not exist on a Linux box.
// There is no way to grade those by output without deciding what the hardware
// calls should mean, so this file is that decision, written down once.
//
// The rules:
//
//   - The grader is a Linux process with no hardware and no network. So the
//     board calls are RECORDED, not performed: each prints a line, and the test
//     cases check those lines. A trace is the observable behaviour.
//   - A student's answer is the whole program. The executor compiles whatever is
//     submitted, and the edge function has no notion of prepending a preamble,
//     so the harness has to be visible in the starter code the student edits.
//   - The exercise's own idea is the student's job; everything the exercise
//     merely assumes (pin numbers, motor helpers, a state constant) is supplied.
//     Grading the decision ladder is not the same task as grading moveForward.
//
// ESP32 connection check is deliberately absent. It needs a real WiFi
// association, and the executor runs with no network on purpose. It stays
// teacher-marked rather than being given a test that cannot mean anything.

const INCLUDES = `#include <iostream>
#include <string>
using namespace std;`;

// Only the shims an exercise actually needs, so a beginner's program is not
// buried under twenty lines of board emulation they never call.
const SHIMS = {
  pins: `
#define HIGH 1
#define LOW 0
#define INPUT_PULLUP 2
void pinMode(int pin, int mode) {
  cout << "pinMode " << pin << " " << mode << endl;
}`,
  digitalWrite: `
void digitalWrite(int pin, int value) {
  cout << "digitalWrite " << pin << " " << (value ? "HIGH" : "LOW") << endl;
}`,
  digitalRead: `
// What the board reports back. Set from the test input in main.
int g_digitalIn = LOW;
int digitalRead(int pin) { (void)pin; return g_digitalIn; }`,
  analogRead: `
int g_analogIn = 0;
int analogRead(int pin) { (void)pin; return g_analogIn; }`,
  analogWrite: `
void analogWrite(int pin, int value) {
  cout << "analogWrite " << pin << " " << value << endl;
}`,
  delay: `
void delay(int ms) { cout << "delay " << ms << endl; }`,
  serial: `
struct SerialPort {
  void println(const string& s) { cout << s << endl; }
  void println(int v) { cout << v << endl; }
  void print(const string& s) { cout << s; }
};
SerialPort Serial;`,
  servo: `
struct Servo {
  int pin = -1;
  void attach(int p) { pin = p; cout << "servo attach " << p << endl; }
  void write(int degrees) { cout << "servo " << pin << " " << degrees << endl; }
};
Servo gate;`,
  motors: `
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
void scanForBall() { cout << "scan" << endl; }`,
};

const BOARD_NOTE = `// ---------------------------------------------------------------------------
// Simulated board
//
// These exercises target an Arduino. This grader is a Linux process with no
// hardware, so each board call below prints a line instead of doing anything,
// and the test cases check those lines. That printed trace is what your program
// is judged on.
// ---------------------------------------------------------------------------`;

/**
 * Compose a complete program.
 *
 * The student section is the only part that differs between the starter and the
 * reference solution, and it is marked so both are obviously the same exercise.
 */
export function composeProgram({
  shims = [],
  constants = "",
  globals = "",
  reads = [],
  preamble = "",
  student,
  epilogue = "",
}) {
  const shimSource = shims
    .map((name) => SHIMS[name])
    .filter(Boolean)
    .join("\n");

  const readLines = reads
    .map((line) => `  ${line}`)
    .join("\n");

  // Constants first: a global initialiser such as `int state = DISARM;`
  // refers to one.
  const constantsPart = constants ? `\n// Pin layout and constants this exercise assumes.\n${constants}\n` : "";
  const globalsPart = globals ? `\n${globals}\n` : "";
  const preamblePart = preamble ? `\n  ${preamble}\n` : "";

  return `${INCLUDES}
${BOARD_NOTE}
${shimSource}
${constantsPart}${globalsPart}
int main() {
${readLines}${preamblePart}
  // ---- your code goes between here ----
${student}
  // ---- and ends here ----
${epilogue}
  return 0;
}
`;
}

const todo = (lines) =>
  lines.map((line) => `  // ${line}`).join("\n");

export const EXERCISES = [
  {
    title: "Branch the smart lens",
    student: `  bool dark = isDark;
  bool movement = motion;
  // TODO: print "Security light ON" when it is dark AND motion is detected,
  //       "Preparing" when it is only dark, and "Bright" otherwise.
  //       Check the combined case first.`,
    reference: `  if (isDark && motion) {
    cout << "Security light ON" << endl;
  } else if (isDark) {
    cout << "Preparing" << endl;
  } else {
    cout << "Bright" << endl;
  }`,
    globals: `// The sensors this exercise reads. Set from the test input in main.
int isDark = 0;
int motion = 0;`,
    reads: ["cin >> isDark >> motion; // first value is darkness, second is motion"],
    tests: [
      { name: "dark with motion arms the light", input: ["1", "1"], expected: "Security light ON\n" },
      { name: "dark with no motion prepares", input: ["1", "0"], expected: "Preparing\n" },
      { name: "daylight with motion is bright", input: ["0", "1"], expected: "Bright\n" },
      { name: "daylight with no motion is bright", input: ["0", "0"], expected: "Bright\n" },
    ],
  },
  {
    title: "Calibrated night light",
    shims: ["pins", "digitalWrite", "analogRead", "serial"],
    constants: `const int ldrPin = 0;   // A0
const int ledPin = 9;
const int darkThreshold = 400;`,
    student: `  int reading = analogRead(ldrPin);
  Serial.println(reading);
  // TODO: turn the LED on only when the reading is below the threshold,
  //       and off otherwise.`,
    reference: `  int reading = analogRead(ldrPin);
  Serial.println(reading);
  if (reading < darkThreshold) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }`,
    reads: ["cin >> g_analogIn; // the LDR reading for this run"],
    tests: [
      { name: "a dark reading turns the LED on", input: ["250"], expected: "250\ndigitalWrite 9 HIGH\n" },
      { name: "a reading at the threshold turns it off", input: ["400"], expected: "400\ndigitalWrite 9 LOW\n" },
      { name: "a bright reading turns it off", input: ["512"], expected: "512\ndigitalWrite 9 LOW\n" },
    ],
  },
  {
    title: "Data types quiz calculator",
    student: `  int count = 3;
  double temp = 24.5;
  bool ready = true;
  // TODO: print all three on one line, then print 7 / 2, then 7 / 2.0 on
  //       their own lines. Watch the integer division.`,
    reference: `  int count = 3;
  double temp = 24.5;
  bool ready = true;
  cout << count << " " << temp << " " << ready << endl;
  cout << 7 / 2 << endl;
  cout << 7 / 2.0 << endl;`,
    tests: [
      {
        name: "types print, and 7/2 truncates while 7/2.0 does not",
        input: [],
        // bool prints as 1, and 7/2 is integer division while 7/2.0 is not.
        // Both are the point of the exercise.
        expected: "3 24.5 1\n3\n3.5\n",
      },
    ],
  },
  {
    title: "Flexible countdown",
    student: `  // TODO: count from 5 down to 1 with a for loop, print "Launch!",
  //       then count from 5 down to 1 again with a while loop and print
  //       "Launch!" a second time.`,
    reference: `  for (int i = 5; i >= 1; i--) {
    cout << i << endl;
  }
  cout << "Launch!" << endl;

  int j = 5;
  while (j >= 1) {
    cout << j << endl;
    j--;
  }
  cout << "Launch!" << endl;`,
    tests: [
      { name: "counts down with both loop forms", input: [], expected: "5\n4\n3\n2\n1\nLaunch!\n5\n4\n3\n2\n1\nLaunch!\n" },
    ],
  },
  {
    title: "Functions playground",
    student: `  // TODO: write squareArea(double side) returning side * side, and
  //       tipFor(double bill) returning 10% of the bill, then print both
  //       results for the two numbers read above.
  cout << squareArea(side) << endl;
  cout << tipFor(bill) << endl;`,
    reference: `  cout << squareArea(side) << endl;
  cout << tipFor(bill) << endl;`,
    // The two functions are the work and belong above main. The prints stay in
    // main, so the reference is split across both halves.
    aboveMainStudent: `// TODO: write squareArea(double side) returning side * side, and
//       tipFor(double bill) returning 10% of the bill.`,
    aboveMainReference: `double squareArea(double side) {
  return side * side;
}

double tipFor(double bill) {
  return bill * 0.10;
}`,
    student: `  cout << squareArea(side) << endl;
  cout << tipFor(bill) << endl;`,
    reference: `  cout << squareArea(side) << endl;
  cout << tipFor(bill) << endl;`,
    preamble: `double side = 0, bill = 0;
  cin >> side >> bill;`,
    tests: [
      { name: "squares and tips a whole bill", input: ["4", "200"], expected: "16\n20\n" },
      { name: "squares a decimal and tips a fraction", input: ["2.5", "50"], expected: "6.25\n5\n" },
    ],
  },
  {
    title: "Hello, engineer!",
    student: `  // TODO: print "Hello, engineer!" and then "Next step: algorithms."
  //       on two separate lines.`,
    reference: `  cout << "Hello, engineer!" << endl;
  cout << "Next step: algorithms." << endl;`,
    tests: [
      { name: "prints both lines exactly", input: [], expected: "Hello, engineer!\nNext step: algorithms.\n" },
    ],
  },
  {
    title: "LED button control",
    shims: ["pins", "digitalWrite", "digitalRead"],
    constants: `const int buttonPin = 2;
const int ledPin = 13;`,
    // The exercise is written as an Arduino loop(), so loop() is defined above
    // main and called once from it. That keeps the student's function shape,
    // which is the point of the exercise.
    aboveMainStudent: `void loop() {
  // TODO: turn the LED on pin 13 on only while the button on pin 2 is
  //       pressed. The button is INPUT_PULLUP, so pressed reads LOW.
}`,
    aboveMainReference: `void loop() {
  if (digitalRead(buttonPin) == LOW) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
}`,
    student: `  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, 0);`,
    reference: `  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, 0);
  loop();`,
    reads: ["cin >> g_digitalIn; // LOW means pressed"],
    tests: [
      { name: "pressed lights the LED", input: ["0"], expected: "pinMode 2 2\npinMode 13 0\ndigitalWrite 13 HIGH\n" },
      { name: "released leaves it off", input: ["1"], expected: "pinMode 2 2\npinMode 13 0\ndigitalWrite 13 LOW\n" },
    ],
  },
  {
    title: "Movement primitives",
    shims: ["pins", "digitalWrite", "analogWrite", "delay"],
    constants: `const int in1 = 4;
const int in2 = 5;
const int enA = 6;`,
    aboveMainReference: `void moveForward(int speed, int duration) {
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
}`,
    student: `  // TODO: moveForward and turnLeft are defined above. Call each one
  //       once with the speed and duration read above.`,
    reference: `  moveForward(speed, duration);
  turnLeft(speed, duration);`,
    preamble: `int speed = 0, duration = 0;
  cin >> speed >> duration;`,
    tests: [
      { name: "drives forward then turns left", input: ["160", "200"], expected: "digitalWrite 4 HIGH\ndigitalWrite 5 LOW\nanalogWrite 6 160\ndelay 200\nanalogWrite 6 0\ndigitalWrite 4 LOW\ndigitalWrite 5 HIGH\nanalogWrite 6 160\ndelay 200\nanalogWrite 6 0\n" },
      { name: "a slower turn still stops afterwards", input: ["90", "50"], expected: "digitalWrite 4 HIGH\ndigitalWrite 5 LOW\nanalogWrite 6 90\ndelay 50\nanalogWrite 6 0\ndigitalWrite 4 LOW\ndigitalWrite 5 HIGH\nanalogWrite 6 90\ndelay 50\nanalogWrite 6 0\n" },
    ],
  },
  {
    title: "Obstacle decision ladder",
    shims: ["motors"],
    globals: `// Named obstacleDistance, not distance: with using namespace std in
// scope, a global called distance is ambiguous against std::distance.
int obstacleDistance = 0;`,
    student: `  // TODO: drive forward when obstacleDistance is more than 30, turn
  //       left when it is between 15 and 30, and when it is 15 or less
  //       reverse then turn right.`,
    reference: `  if (obstacleDistance > 30) {
    moveForward(160, 200);
  } else if (obstacleDistance > 15) {
    turnLeft(160, 200);
  } else {
    moveReverse(150, 300);
    turnRight(160, 250);
  }`,
    reads: ["cin >> obstacleDistance; // centimetres to the obstacle"],
    tests: [
      { name: "a clear path drives forward", input: ["50"], expected: "forward 160 200\n" },
      { name: "a close obstacle turns left", input: ["20"], expected: "left 160 200\n" },
      { name: "a very close obstacle reverses and turns right", input: ["10"], expected: "reverse 150 300\nright 160 250\n" },
    ],
  },
  {
    title: "Remote command mapping",
    shims: ["motors"],
    globals: `int command = 0;`,
    student: `  // TODO: map 0x00 forward, 0x01 reverse, 0x02 left, 0x03 right,
  //       and stop() for anything else.`,
    reference: `  switch (command) {
    case 0x00: moveForward(180, 300); break;
    case 0x01: moveReverse(180, 300); break;
    case 0x02: turnLeft(180, 250); break;
    case 0x03: turnRight(180, 250); break;
    default: stop(); break;
  }`,
    reads: ["cin >> command; // the remote code for this run"],
    tests: [
      { name: "code 0 drives forward", input: ["0"], expected: "forward 180 300\n" },
      { name: "code 1 reverses", input: ["1"], expected: "reverse 180 300\n" },
      { name: "code 2 turns left", input: ["2"], expected: "left 180 250\n" },
      { name: "code 3 turns right", input: ["3"], expected: "right 180 250\n" },
      { name: "an unknown code stops", input: ["9"], expected: "stop\n" },
    ],
  },
  {
    title: "Security state machine",
    shims: ["pins", "digitalWrite"],
    constants: `const int alarmPin = 8;
const int DISARM = 0;
const int ARM = 1;
const int TRIGGERED = 2;`,
    globals: `int state = DISARM;
int motion = 0;`,
    student: `  // TODO: when the state is ARM and there is motion, it becomes
  //       TRIGGERED. Then sound the alarm while the state is TRIGGERED and
  //       keep it silent otherwise.`,
    reference: `  if (state == ARM && motion) state = TRIGGERED;
  if (state == TRIGGERED) digitalWrite(alarmPin, HIGH);
  else digitalWrite(alarmPin, LOW);`,
    reads: ["cin >> state >> motion; // the current state, then whether there is motion"],
    tests: [
      { name: "disarmed ignores motion", input: ["0", "1"], expected: "digitalWrite 8 LOW\n" },
      { name: "armed with motion triggers the alarm", input: ["1", "1"], expected: "digitalWrite 8 HIGH\n" },
      { name: "armed with no motion stays quiet", input: ["1", "0"], expected: "digitalWrite 8 LOW\n" },
      { name: "already triggered keeps sounding", input: ["2", "0"], expected: "digitalWrite 8 HIGH\n" },
    ],
  },
  {
    title: "Sensor readings summary",
    student: `  double readings[] = {310, 420, 380, 450, 330};
  int n = 5;
  double total = 0;
  double minimum = readings[0];
  // TODO: loop over the readings to fill in the total and the minimum, then
  //       print the average and the minimum.`,
    reference: `  double readings[] = {310, 420, 380, 450, 330};
  int n = 5;
  double total = 0;
  double minimum = readings[0];
  for (int i = 0; i < n; i++) {
    total += readings[i];
    if (readings[i] < minimum) minimum = readings[i];
  }
  cout << "Average: " << total / n << endl;
  cout << "Minimum: " << minimum << endl;`,
    tests: [
      { name: "averages the five readings and finds the lowest", input: [], expected: "Average: 378\nMinimum: 310\n" },
    ],
  },
  {
    title: "Servo gate opener",
    shims: ["pins", "analogRead", "servo", "delay"],
    constants: `const int ldrPin = 0;   // A0
const int servoPin = 9;`,
    student: `  gate.attach(servoPin);
  int light = analogRead(ldrPin);
  // TODO: open the gate to 90 degrees when the reading is above 600,
  //       otherwise close it to 0.`,
    reference: `  gate.attach(servoPin);
  int light = analogRead(ldrPin);
  if (light > 600) {
    gate.write(90);
  } else {
    gate.write(0);
  }
  delay(30);`,
    reads: ["cin >> g_analogIn; // the LDR reading for this run"],
    tests: [
      { name: "bright light opens the gate", input: ["700"], expected: "servo attach 9\nservo 9 90\ndelay 30\n" },
      { name: "a reading at the threshold closes it", input: ["600"], expected: "servo attach 9\nservo 9 0\ndelay 30\n" },
      { name: "dim light closes it", input: ["300"], expected: "servo attach 9\nservo 9 0\ndelay 30\n" },
    ],
  },
  {
    title: "Soccer chase rules",
    shims: ["motors"],
    constants: `const int CENTER = 0;
const int LEFT = 1;
const int RIGHT = 2;`,
    globals: `int direction = CENTER;`,
    student: `  // TODO: CENTER drives forward, LEFT turns left, RIGHT turns right,
  //       and anything else scans for the ball.`,
    reference: `  if (direction == CENTER) {
    moveForward(200, 100);
  } else if (direction == LEFT) {
    turnLeft(180, 120);
  } else if (direction == RIGHT) {
    turnRight(180, 120);
  } else {
    scanForBall();
  }`,
    reads: ["cin >> direction; // where the ball is"],
    tests: [
      { name: "ball ahead drives forward", input: ["0"], expected: "forward 200 100\n" },
      { name: "ball left turns left", input: ["1"], expected: "left 180 120\n" },
      { name: "ball right turns right", input: ["2"], expected: "right 180 120\n" },
      { name: "no ball scans", input: ["9"], expected: "scan\n" },
    ],
  },
];

// An exercise whose work belongs above main rather than inside it declares
// aboveMainStudent (what the student is given) and aboveMainReference (what
// must pass). Both halves are explicit: inferring one from the other produced
// stray braces and bodies in the wrong place.
const indentBlock = (body) =>
  body
    .split("\n")
    .map((line) => (line.trim() ? `  ${line}` : line))
    .join("\n");

// The in-main body and the above-main body are chosen separately, because an
// exercise can have work in both places. Passing spec.student in both branches
// is what silently built every "reference solution" out of TODO comments.
const build = (spec, inMain, aboveMain) => {
  let source = composeProgram({
    shims: spec.shims,
    constants: spec.constants,
    globals: spec.globals,
    reads: spec.reads,
    preamble: spec.preamble,
    student: inMain,
    epilogue: spec.epilogue,
  });
  if (aboveMain) {
    source = source.replace("\nint main() {", `\n${aboveMain}\nint main() {`);
  }
  return source;
};

/** The complete program a student edits. */
export const starterFor = (spec) =>
  build(
    spec,
    spec.student,
    spec.aboveMainStudent ? `${spec.aboveMainStudent}\n` : null,
  );

/** The complete program that must pass the tests. */
export const solutionFor = (spec) =>
  build(
    spec,
    spec.reference,
    spec.aboveMainReference
      ? `${spec.aboveMainReference}\n`
      : spec.aboveMainStudent
        ? `${spec.aboveMainStudent}\n${indentBlock(spec.reference)}\n}\n`
        : null,
  );

