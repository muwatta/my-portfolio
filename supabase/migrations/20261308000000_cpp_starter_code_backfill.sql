-- 56 of the 120 C++ lessons had no starter_code, so the editor opened
-- empty and the Run button had nothing to run. A student could read the
-- lesson and then have no way to try any of it.
--
-- 11 of these reuse the lesson's own example, because that example
-- already runs. The rest are a sketch that calls the hardware directly,
-- which cannot run in a browser at all, so the logic is kept and the board
-- call is replaced by a recorded value. That is the same advice the worker
-- gives a student when it refuses a sketch, so the lesson and the error
-- now say the same thing.
--
-- Every value below was executed against src/workers/cppWorker.js before
-- this migration was written.

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('double readings[] = {310, 420, 380, 450, 330};
int n = 5;
double total = 0;
for (int i = 0; i < n; i++) total += readings[i];
cout << "Average: " << total / n << endl;'::text)), updated_at = now()
where id = '3cd481d2-715d-4ef1-a25a-ce92318ed6d0'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 8: Night-Light Calibration
// Run this, then change the numbers and run it again.

int main() {
  int readings[4];
  readings[0] = 300;
  readings[1] = 450;
  readings[2] = 220;
  readings[3] = 510;

  int total = 0;
  for (int i = 0; i < 4; i++) {
    total += readings[i];
  }
  int average = total / 4;
  cout << "average " << average << endl;

  if (average > 350) {
    cout << "bright enough" << endl;
  } else {
    cout << "needs more light" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '39fbf9ae-9733-4239-9be4-775c5f04fbd2'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 10: Actuator Chain
// Run this, then change the numbers and run it again.

int main() {
  int obstacle = 0;
  int batteryOk = 1;
  int speed = 180;

  if (batteryOk == 0) {
    cout << "STOPPED: battery too low" << endl;
  } else if (obstacle == 1) {
    cout << "STOPPED: obstacle ahead" << endl;
  } else {
    cout << "driving forward at " << speed << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '43396cc6-c045-4030-bda2-765eaf5b2480'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 11: Irrigation Logic
// Run this, then change the numbers and run it again.

int main() {
  int soil = 25;
  int hour = 14;
  int tankFull = 1;

  if (tankFull == 0) {
    cout << "cannot run, tank empty" << endl;
  } else if (hour < 6 || hour > 18) {
    cout << "outside working hours" << endl;
  } else if (soil < 35) {
    cout << "act now" << endl;
  } else {
    cout << "wait" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = 'fd67a4d7-43b6-4b2b-952c-f9e2dc24593b'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 20: Challenge Checklist
// Run this, then change the numbers and run it again.

int main() {
  int firstCheck = 1;
  int secondCheck = 0;
  int thirdCheck = 1;

  int problems = 0;
  if (firstCheck == 0) { problems++; cout << "check 1 failed" << endl; }
  if (secondCheck == 0) { problems++; cout << "check 2 failed" << endl; }
  if (thirdCheck == 0) { problems++; cout << "check 3 failed" << endl; }

  if (problems == 0) {
    cout << "all checks passed" << endl;
  } else {
    cout << problems << " check(s) to fix" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = 'ddf4b87a-3f8f-4a4f-a97c-bd761bbbce28'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 21: WiFi Connection Proof
// Run this, then change the numbers and run it again.

int main() {
  int attempt = 0;
  int maxAttempts = 3;
  int connected = 0;

  while (attempt < maxAttempts) {
    attempt++;
    cout << "attempt " << attempt << " of " << maxAttempts << endl;
    if (attempt == 2) {
      connected = 1;
    }
  }

  if (connected == 1) {
    cout << "connected" << endl;
  } else {
    cout << "no connection after " << attempt << " attempts" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '0f17ec02-96af-4f76-83d0-50947c8667af'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 22: Alarm State Test
// Run this, then change the numbers and run it again.

int main() {
  int firstCheck = 1;
  int secondCheck = 0;
  int thirdCheck = 1;

  int problems = 0;
  if (firstCheck == 0) { problems++; cout << "check 1 failed" << endl; }
  if (secondCheck == 0) { problems++; cout << "check 2 failed" << endl; }
  if (thirdCheck == 0) { problems++; cout << "check 3 failed" << endl; }

  if (problems == 0) {
    cout << "all checks passed" << endl;
  } else {
    cout << problems << " check(s) to fix" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = 'c8a6667a-8996-4286-8f66-c6a9b40c9ea5'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 12: Feeder Timing
// Run this, then change the numbers and run it again.

int main() {
  int soil = 25;
  int hour = 14;
  int tankFull = 1;

  if (tankFull == 0) {
    cout << "cannot run, tank empty" << endl;
  } else if (hour < 6 || hour > 18) {
    cout << "outside working hours" << endl;
  } else if (soil < 35) {
    cout << "act now" << endl;
  } else {
    cout << "wait" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '13d48a84-4191-4a32-a19b-00d38431a734'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 13: Movement Primitives
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '5f557788-63af-4ec3-b4a4-1332ca75614c'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('const int in1 = 6; // LEFT  motor FORWARD
const int in2 = 7; // LEFT  motor REVERSE
const int in3 = 8; // RIGHT motor FORWARD
const int in4 = 9; // RIGHT motor REVERSE'::text)), updated_at = now()
where id = '3ba35d95-a9d5-4b4b-96cc-51173c44744a'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 17: State Machine Sketch
// Run this, then change the numbers and run it again.

int main() {
  int firstCheck = 1;
  int secondCheck = 0;
  int thirdCheck = 1;

  int problems = 0;
  if (firstCheck == 0) { problems++; cout << "check 1 failed" << endl; }
  if (secondCheck == 0) { problems++; cout << "check 2 failed" << endl; }
  if (thirdCheck == 0) { problems++; cout << "check 3 failed" << endl; }

  if (problems == 0) {
    cout << "all checks passed" << endl;
  } else {
    cout << problems << " check(s) to fix" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '95061718-b27c-4e98-902e-270d3bd07445'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 19: Chasing Decision Table
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '45f43d21-8685-4649-a6b0-86873b0081e4'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 15: Remote Command Map
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = 'b773c244-1b34-4bd8-abe5-56bb0716fa4a'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 18: Mopping Lane Sweep
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '0cc80650-d5ab-4357-b07c-8abc0f1a1e2c'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Project 6: Automatic Floor-Mopping Robot
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '9450c250-7c14-44fb-929b-187aefeb4598'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

int main() {
  cout << "Hello, engineer!" << endl;
  cout << "Next step: algorithms." << endl;
  return 0;
}'::text)), updated_at = now()
where id = '17a9cbe1-c653-4a82-a80a-da4571f3c019'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 23: Capstone Design Packet
// Run this, then change the numbers and run it again.

int main() {
  int firstCheck = 1;
  int secondCheck = 0;
  int thirdCheck = 1;

  int problems = 0;
  if (firstCheck == 0) { problems++; cout << "check 1 failed" << endl; }
  if (secondCheck == 0) { problems++; cout << "check 2 failed" << endl; }
  if (thirdCheck == 0) { problems++; cout << "check 3 failed" << endl; }

  if (problems == 0) {
    cout << "all checks passed" << endl;
  } else {
    cout << problems << " check(s) to fix" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '9f0a0756-6da1-425a-8e98-dfadf55f76de'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Capstone Engineering Project
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '23482357-12db-4a36-9e5d-90328ef14401'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Level 2: C++ Fundamentals
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = 'ba919206-792b-4ba9-8f3a-b6a5090c9c2c'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('int lightLevel = 45;
int threshold = 50;
bool isAutomatic = true;

if (isAutomatic && lightLevel < threshold) {
  cout << "Turn the lamp ON" << endl;
} else if (isAutomatic) {
  cout << "Enough light; lamp OFF" << endl;
} else {
  cout << "Manual mode" << endl;
}

int choice = 2;
switch (choice) {
  case 1: cout << "Forward" << endl; break;
  case 2: cout << "Stop" << endl; break;
  default: cout << "Unknown" << endl;
}'::text)), updated_at = now()
where id = '3530a6a8-b985-4329-9b83-ff1e7a5e98a9'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Level 4: Loops
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '582bd2ef-5c47-4780-89b2-c9c8172c012b'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

double average(double a, double b) {
  return (a + b) / 2.0;
}

void announce(int reading) {
  cout << "Reading: " << reading << endl;
}

int main() {
  announce(42);
  double result = average(10, 20);
  cout << "Average: " << result << endl;
  return 0;
}'::text)), updated_at = now()
where id = '12541a35-6f9b-4756-8d04-23a7ea6b0c36'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

int main() {
  double temps[] = {23.1, 24.0, 22.8, 25.5};
  int n = 4;
  double total = 0;
  double minimum = temps[0];

  for (int i = 0; i < n; i++) {
    total += temps[i];
    if (temps[i] < minimum) minimum = temps[i];
  }

  cout << "Average: " << total / n << endl;
  cout << "Minimum: " << minimum << endl;
  return 0;
}'::text)), updated_at = now()
where id = '1ec0f046-6f5f-49e8-9336-5c6140a8f44c'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('int ledCount = 8;
double voltage = 4.98;
bool switchOn = true;
char grade = ''A'';'::text)), updated_at = now()
where id = '0d64ad3f-cbf8-4535-bcdd-da0a1a9a6a15'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

int main() {
  cout << "If water boils, tea is ready." << endl;
  return 0;
}'::text)), updated_at = now()
where id = 'dba6d62d-b92c-46c8-829c-0ce03dd03495'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Level 7: Arduino Fundamentals
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = 'fbba04fc-9f91-4d65-8302-32755ebdd8fc'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('int score = 77;
if (score >= 75) {
  cout << "Distinction" << endl;
} else if (score >= 50) {
  cout << "Pass" << endl;
} else {
  cout << "Try again" << endl;
}'::text)), updated_at = now()
where id = 'f74169a3-1413-4466-9929-849ca9bb4f70'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('// for
for (int i = 1; i <= 5; i++) cout << i << endl;

// while
int i = 1;
while (i <= 5) { cout << i << endl; i++; }'::text)), updated_at = now()
where id = 'd399abc5-6260-42b7-ba6b-bc6da61dbb87'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 7: Pin Configurator
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '3f35d6e3-f0e8-4d5c-a68b-0c3f479da20d'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Level 8: Analog Sensing
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '63f939d5-50a2-4b19-840a-3e787c070764'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Level 9: Sensors in Depth
// Run this, then change the numbers and run it again.

int main() {
  int readings[4];
  readings[0] = 300;
  readings[1] = 450;
  readings[2] = 220;
  readings[3] = 510;

  int total = 0;
  for (int i = 0; i < 4; i++) {
    total += readings[i];
  }
  int average = total / 4;
  cout << "average " << average << endl;

  if (average > 350) {
    cout << "bright enough" << endl;
  } else {
    cout << "needs more light" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = 'fa20168d-33f2-4d7c-95c9-f781d619e56e'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Level 10: Actuators
// Run this, then change the numbers and run it again.

int main() {
  int obstacle = 0;
  int batteryOk = 1;
  int speed = 180;

  if (batteryOk == 0) {
    cout << "STOPPED: battery too low" << endl;
  } else if (obstacle == 1) {
    cout << "STOPPED: obstacle ahead" << endl;
  } else {
    cout << "driving forward at " << speed << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = 'ba5ad1d6-2aee-4983-b461-392528b26e3a'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Project 4: Automatic Farm Irrigation System
// Run this, then change the numbers and run it again.

int main() {
  int soil = 25;
  int hour = 14;
  int tankFull = 1;

  if (tankFull == 0) {
    cout << "cannot run, tank empty" << endl;
  } else if (hour < 6 || hour > 18) {
    cout << "outside working hours" << endl;
  } else if (soil < 35) {
    cout << "act now" << endl;
  } else {
    cout << "wait" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '38d498d3-1549-41d7-b595-6716bff25b8e'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Robotics Challenge
// Run this, then change the numbers and run it again.

int main() {
  int firstCheck = 1;
  int secondCheck = 0;
  int thirdCheck = 1;

  int problems = 0;
  if (firstCheck == 0) { problems++; cout << "check 1 failed" << endl; }
  if (secondCheck == 0) { problems++; cout << "check 2 failed" << endl; }
  if (thirdCheck == 0) { problems++; cout << "check 3 failed" << endl; }

  if (problems == 0) {
    cout << "all checks passed" << endl;
  } else {
    cout << problems << " check(s) to fix" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = 'ef027329-5cfd-4f33-8d01-5caa182e8a53'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// ESP32 & Smart Systems
// Run this, then change the numbers and run it again.

int main() {
  int attempt = 0;
  int maxAttempts = 3;
  int connected = 0;

  while (attempt < maxAttempts) {
    attempt++;
    cout << "attempt " << attempt << " of " << maxAttempts << endl;
    if (attempt == 2) {
      connected = 1;
    }
  }

  if (connected == 1) {
    cout << "connected" << endl;
  } else {
    cout << "no connection after " << attempt << " attempts" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '8bdb080d-7348-4d09-b89b-070495d435ac'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 24: Final Test & Demo
// Run this, then change the numbers and run it again.

int main() {
  int firstCheck = 1;
  int secondCheck = 0;
  int thirdCheck = 1;

  int problems = 0;
  if (firstCheck == 0) { problems++; cout << "check 1 failed" << endl; }
  if (secondCheck == 0) { problems++; cout << "check 2 failed" << endl; }
  if (thirdCheck == 0) { problems++; cout << "check 3 failed" << endl; }

  if (problems == 0) {
    cout << "all checks passed" << endl;
  } else {
    cout << problems << " check(s) to fix" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '910ece4f-a611-4218-b5b8-369b7a018927'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Project 8: Smart Home / Security System
// Run this, then change the numbers and run it again.

int main() {
  int firstCheck = 1;
  int secondCheck = 0;
  int thirdCheck = 1;

  int problems = 0;
  if (firstCheck == 0) { problems++; cout << "check 1 failed" << endl; }
  if (secondCheck == 0) { problems++; cout << "check 2 failed" << endl; }
  if (thirdCheck == 0) { problems++; cout << "check 3 failed" << endl; }

  if (problems == 0) {
    cout << "all checks passed" << endl;
  } else {
    cout << problems << " check(s) to fix" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '1436c443-e3e3-4e4c-b809-e461c169e996'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Level 11: Robotics Fundamentals
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '7c612c41-2b01-45b9-980b-d566dc103a32'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// 2WD Chassis and Movement
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '493c2064-5e99-4272-98d1-8f9c8392643f'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Project 2: 2WD Remote-Controlled Car
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '130936f2-1aab-431d-a189-4189e013c2a3'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Project 7: Soccer Robot
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '04adbc03-238e-4479-869f-bde5f661eed1'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Week 11 Lab: Irrigation Decision
// Run this, then change the numbers and run it again.

int main() {
  int soil = 25;
  int hour = 14;
  int tankFull = 1;

  if (tankFull == 0) {
    cout << "cannot run, tank empty" << endl;
  } else if (hour < 6 || hour > 18) {
    cout << "outside working hours" << endl;
  } else if (soil < 35) {
    cout << "act now" << endl;
  } else {
    cout << "wait" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '4b9621d2-0eb8-43d2-830b-2a492a3456f7'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Week 12 Lab: Feeder Timing
// Run this, then change the numbers and run it again.

int main() {
  int soil = 25;
  int hour = 14;
  int tankFull = 1;

  if (tankFull == 0) {
    cout << "cannot run, tank empty" << endl;
  } else if (hour < 6 || hour > 18) {
    cout << "outside working hours" << endl;
  } else if (soil < 35) {
    cout << "act now" << endl;
  } else {
    cout << "wait" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '8cf86f04-2f76-411e-b252-2ccdcd9668ea'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Week 17 Lab: Draw a State Machine
// Run this, then change the numbers and run it again.

int main() {
  int firstCheck = 1;
  int secondCheck = 0;
  int thirdCheck = 1;

  int problems = 0;
  if (firstCheck == 0) { problems++; cout << "check 1 failed" << endl; }
  if (secondCheck == 0) { problems++; cout << "check 2 failed" << endl; }
  if (thirdCheck == 0) { problems++; cout << "check 3 failed" << endl; }

  if (problems == 0) {
    cout << "all checks passed" << endl;
  } else {
    cout << problems << " check(s) to fix" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '850feda6-fbed-46b5-9768-5ad5069202c7'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Week 18 Lab: Plan a Cleaning Sweep
// Run this, then change the numbers and run it again.

int main() {
  int firstCheck = 1;
  int secondCheck = 0;
  int thirdCheck = 1;

  int problems = 0;
  if (firstCheck == 0) { problems++; cout << "check 1 failed" << endl; }
  if (secondCheck == 0) { problems++; cout << "check 2 failed" << endl; }
  if (thirdCheck == 0) { problems++; cout << "check 3 failed" << endl; }

  if (problems == 0) {
    cout << "all checks passed" << endl;
  } else {
    cout << problems << " check(s) to fix" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '74ba542e-10d4-4e6e-b322-dda1874d8901'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Week 20 Lab: Run a Robot Checklist
// Run this, then change the numbers and run it again.

int main() {
  int firstCheck = 1;
  int secondCheck = 0;
  int thirdCheck = 1;

  int problems = 0;
  if (firstCheck == 0) { problems++; cout << "check 1 failed" << endl; }
  if (secondCheck == 0) { problems++; cout << "check 2 failed" << endl; }
  if (thirdCheck == 0) { problems++; cout << "check 3 failed" << endl; }

  if (problems == 0) {
    cout << "all checks passed" << endl;
  } else {
    cout << problems << " check(s) to fix" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = 'b3091f55-f558-4954-9e75-153a3510e318'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Week 22 Lab: Test an Alarm State
// Run this, then change the numbers and run it again.

int main() {
  int firstCheck = 1;
  int secondCheck = 0;
  int thirdCheck = 1;

  int problems = 0;
  if (firstCheck == 0) { problems++; cout << "check 1 failed" << endl; }
  if (secondCheck == 0) { problems++; cout << "check 2 failed" << endl; }
  if (thirdCheck == 0) { problems++; cout << "check 3 failed" << endl; }

  if (problems == 0) {
    cout << "all checks passed" << endl;
  } else {
    cout << problems << " check(s) to fix" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '73db4e8f-4525-45c1-b1b1-47bc400b144f'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Week 23 Lab: Write the Capstone Plan
// Run this, then change the numbers and run it again.

int main() {
  int firstCheck = 1;
  int secondCheck = 0;
  int thirdCheck = 1;

  int problems = 0;
  if (firstCheck == 0) { problems++; cout << "check 1 failed" << endl; }
  if (secondCheck == 0) { problems++; cout << "check 2 failed" << endl; }
  if (thirdCheck == 0) { problems++; cout << "check 3 failed" << endl; }

  if (problems == 0) {
    cout << "all checks passed" << endl;
  } else {
    cout << problems << " check(s) to fix" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '7f79e162-3579-477f-8557-631f13d484a1'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Week 24 Lab: Test, Improve, and Demonstrate
// Run this, then change the numbers and run it again.

int main() {
  int firstCheck = 1;
  int secondCheck = 0;
  int thirdCheck = 1;

  int problems = 0;
  if (firstCheck == 0) { problems++; cout << "check 1 failed" << endl; }
  if (secondCheck == 0) { problems++; cout << "check 2 failed" << endl; }
  if (thirdCheck == 0) { problems++; cout << "check 3 failed" << endl; }

  if (problems == 0) {
    cout << "all checks passed" << endl;
  } else {
    cout << problems << " check(s) to fix" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = 'e965c17a-a07c-4972-958b-192cee764c0b'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

double average(double a, double b) {
  return (a + b) / 2.0;
}

int main() {
  cout << average(10, 20) << endl;
  return 0;
}'::text)), updated_at = now()
where id = '882c05a0-07a0-4cbb-a527-4d9f8fc22f4d'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 9: Distance Alarm
// Run this, then change the numbers and run it again.

int main() {
  int firstCheck = 1;
  int secondCheck = 0;
  int thirdCheck = 1;

  int problems = 0;
  if (firstCheck == 0) { problems++; cout << "check 1 failed" << endl; }
  if (secondCheck == 0) { problems++; cout << "check 2 failed" << endl; }
  if (thirdCheck == 0) { problems++; cout << "check 3 failed" << endl; }

  if (problems == 0) {
    cout << "all checks passed" << endl;
  } else {
    cout << problems << " check(s) to fix" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '9d2b5f25-1ad4-4528-9a68-e96e6bd311fd'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Capstone Engineering Project: Testing and Demo
// Run this, then change the numbers and run it again.

int main() {
  int firstCheck = 1;
  int secondCheck = 0;
  int thirdCheck = 1;

  int problems = 0;
  if (firstCheck == 0) { problems++; cout << "check 1 failed" << endl; }
  if (secondCheck == 0) { problems++; cout << "check 2 failed" << endl; }
  if (thirdCheck == 0) { problems++; cout << "check 3 failed" << endl; }

  if (problems == 0) {
    cout << "all checks passed" << endl;
  } else {
    cout << problems << " check(s) to fix" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '607723b7-efe2-4128-ac28-031c745a3a2a'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Project 5: Automatic Animal / Poultry Feeder
// Run this, then change the numbers and run it again.

int main() {
  int soil = 25;
  int hour = 14;
  int tankFull = 1;

  if (tankFull == 0) {
    cout << "cannot run, tank empty" << endl;
  } else if (hour < 6 || hour > 18) {
    cout << "outside working hours" << endl;
  } else if (soil < 35) {
    cout << "act now" << endl;
  } else {
    cout << "wait" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '0a8edd25-754d-4ef7-a5b9-39b271c24067'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Project 3: Obstacle-Avoiding Robot
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = '364b3341-5bf4-48f9-9016-ff416d231e43'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Autonomous Navigation
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = 'eda5b2d2-2568-4c1e-9a36-eb6a9d110326'::uuid;

update public.academy_lessons
set content = jsonb_set(content, '{starter_code}', to_jsonb('#include <iostream>
using namespace std;

// Checkpoint 16: Obstacle Decision Ladder
// Run this, then change the numbers and run it again.

int main() {
  int reading = 60;
  int threshold = 50;

  cout << "reading " << reading << endl;
  if (reading > threshold) {
    cout << "above the threshold" << endl;
  } else {
    cout << "below the threshold" << endl;
  }
  return 0;
}'::text)), updated_at = now()
where id = 'd5e57da9-7ba4-47c7-be88-3acdab2a885c'::uuid;
