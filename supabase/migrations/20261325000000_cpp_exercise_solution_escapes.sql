-- Every one of the 15 C++ programming exercises had its reference solution
-- stored with escaped newlines: the text contains a backslash followed by 'n', not
-- a line break. So the reference solution, the thing a student is shown and the
-- thing that has to compile, was not valid C++ at all. It went unnoticed because
-- nothing reads solution_code.
--
-- chr(92) is a backslash. Spelled this way because in a LIKE pattern a backslash
-- is the escape character, so a quoted backslash-n silently means "percent, n"
-- and the guard would match nothing.

-- Every one of the 15 C++ programming exercises had its reference solution
-- stored with escaped newlines: the text contains a backslash followed by 'n',
-- not a line break. So the reference solution, the thing a student is shown and
-- the thing that has to compile, was not valid C++ at all. It had gone unnoticed
-- because nothing read solution_code.
--
-- Branch the smart lens
update public.academy_exercises
   set solution_code = 'if (isDark && motion) {
  cout << "Security light ON" << endl;
} else if (isDark) {
  cout << "Preparing" << endl;
} else {
  cout << "Bright" << endl;
}',
       updated_at = now()
 where title = 'Branch the smart lens'
   and position(chr(92) || 'n' in solution_code) > 0;
-- Calibrated night light
update public.academy_exercises
   set solution_code = 'int reading = analogRead(ldrPin);
Serial.println(reading);
if (reading < darkThreshold) {
  digitalWrite(ledPin, HIGH);
} else {
  digitalWrite(ledPin, LOW);
}',
       updated_at = now()
 where title = 'Calibrated night light'
   and position(chr(92) || 'n' in solution_code) > 0;
-- Data types quiz calculator
update public.academy_exercises
   set solution_code = 'int count = 3;
double temp = 24.5;
bool ready = true;
cout << count << " " << temp << " " << ready << endl;
cout << 7 / 2 << endl;
cout << 7 / 2.0 << endl;',
       updated_at = now()
 where title = 'Data types quiz calculator'
   and position(chr(92) || 'n' in solution_code) > 0;
-- ESP32 connection check
update public.academy_exercises
   set solution_code = 'WiFi.begin(ssid, password);
while (WiFi.status() != WL_CONNECTED) {
  delay(500);
}
Serial.println(WiFi.localIP());',
       updated_at = now()
 where title = 'ESP32 connection check'
   and position(chr(92) || 'n' in solution_code) > 0;
-- Flexible countdown
update public.academy_exercises
   set solution_code = 'for (int i = 5; i >= 1; i--) {
  cout << i << endl;
}
cout << "Launch!" << endl;

int j = 5;
while (j >= 1) {
  cout << j << endl;
  j--;
}
cout << "Launch!" << endl;',
       updated_at = now()
 where title = 'Flexible countdown'
   and position(chr(92) || 'n' in solution_code) > 0;
-- Functions playground
update public.academy_exercises
   set solution_code = 'double squareArea(double side) {
  return side * side;
}
double tipFor(double bill) {
  return bill * 0.10;
}',
       updated_at = now()
 where title = 'Functions playground'
   and position(chr(92) || 'n' in solution_code) > 0;
-- Hello, engineer!
update public.academy_exercises
   set solution_code = 'cout << "Hello, engineer!" << endl;
cout << "Next step: algorithms." << endl;',
       updated_at = now()
 where title = 'Hello, engineer!'
   and position(chr(92) || 'n' in solution_code) > 0;
-- LED button control
update public.academy_exercises
   set solution_code = 'void loop() {
  if (digitalRead(buttonPin) == LOW) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
}',
       updated_at = now()
 where title = 'LED button control'
   and position(chr(92) || 'n' in solution_code) > 0;
-- Movement primitives
update public.academy_exercises
   set solution_code = 'void moveForward(int speed, int duration) {
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
}',
       updated_at = now()
 where title = 'Movement primitives'
   and position(chr(92) || 'n' in solution_code) > 0;
-- Obstacle decision ladder
update public.academy_exercises
   set solution_code = 'if (distance > 30) {
  moveForward(160, 200);
} else if (distance > 15) {
  turnLeft(160, 200);
} else {
  moveReverse(150, 300);
  turnRight(160, 250);
}',
       updated_at = now()
 where title = 'Obstacle decision ladder'
   and position(chr(92) || 'n' in solution_code) > 0;
-- Remote command mapping
update public.academy_exercises
   set solution_code = 'switch (command) {
  case 0x00: moveForward(180, 300); break;
  case 0x01: moveReverse(180, 300); break;
  case 0x02: turnLeft(180, 250); break;
  case 0x03: turnRight(180, 250); break;
  default: stop(); break;
}',
       updated_at = now()
 where title = 'Remote command mapping'
   and position(chr(92) || 'n' in solution_code) > 0;
-- Security state machine
update public.academy_exercises
   set solution_code = 'if (state == ARM && motion) state = TRIGGERED;
if (state == TRIGGERED) digitalWrite(alarmPin, HIGH);
else digitalWrite(alarmPin, LOW);
// (disarm sets state back to DISARM)',
       updated_at = now()
 where title = 'Security state machine'
   and position(chr(92) || 'n' in solution_code) > 0;
-- Sensor readings summary
update public.academy_exercises
   set solution_code = 'double readings[] = {310, 420, 380, 450, 330};
int n = 5;
double total = 0;
double minimum = readings[0];
for (int i = 0; i < n; i++) {
  total += readings[i];
  if (readings[i] < minimum) minimum = readings[i];
}
cout << "Average: " << total / n << endl;
cout << "Minimum: " << minimum << endl;',
       updated_at = now()
 where title = 'Sensor readings summary'
   and position(chr(92) || 'n' in solution_code) > 0;
-- Servo gate opener
update public.academy_exercises
   set solution_code = 'int light = analogRead(ldrPin);
if (light > 600) {
  gate.write(90);
} else {
  gate.write(0);
}
delay(30);',
       updated_at = now()
 where title = 'Servo gate opener'
   and position(chr(92) || 'n' in solution_code) > 0;
-- Soccer chase rules
update public.academy_exercises
   set solution_code = 'if (direction == CENTER) {
  moveForward(200, 100);
} else if (direction == LEFT) {
  turnLeft(180, 120);
} else if (direction == RIGHT) {
  turnRight(180, 120);
} else {
  scanForBall();
}',
       updated_at = now()
 where title = 'Soccer chase rules'
   and position(chr(92) || 'n' in solution_code) > 0;
-- "Sensor readings summary" also computed the average and the minimum and
-- printed neither, while its own instructions ask for both printed. The prints
-- are folded into the update above so the reference solution actually does what
-- the exercise says.
