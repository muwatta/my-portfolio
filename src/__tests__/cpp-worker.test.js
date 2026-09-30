import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// The worker is plain script aimed at a SharedWorker, so it is loaded the same
// way the browser loads it: as source, with the message handler stripped off.
const source = readFileSync("src/workers/cppWorker.js", "utf8")
  .replace(/self\.onmessage[\s\S]*$/, "")
  .replace(/export\s+default\s+\w+;?/, "");
const { BeginnerCpp } = new Function(
  `${source}; return { BeginnerCpp };`,
)();

const run = (code) => new BeginnerCpp().run(code);
const main = (body) => `#include <iostream>\nusing namespace std;\n\nint main() {\n${body}\n  return 0;\n}`;

describe("decisions", () => {
  it("runs an else if ladder", () => {
    // This was rejected outright. Six of the C++ course's own code blocks were
    // written this way, so a lesson could teach a construct the runner refused.
    expect(
      run(main('  int score = 60;\n  if (score >= 75) {\n    cout << "Distinction" << endl;\n  } else if (score >= 50) {\n    cout << "Pass" << endl;\n  } else {\n    cout << "Retake" << endl;\n  }')),
    ).toBe("Pass\n");
  });

  it("does not run the else when a branch was taken", () => {
    expect(
      run(main('  int score = 90;\n  if (score >= 75) {\n    cout << "Distinction" << endl;\n  } else if (score >= 50) {\n    cout << "Pass" << endl;\n  } else {\n    cout << "Retake" << endl;\n  }')),
    ).toBe("Distinction\n");
  });

  it("runs only the first true branch of a ladder", () => {
    // The parser used to step over the chain wrongly and run a second branch,
    // printing two answers to a question that has one.
    const output = run(
      main('  int score = 30;\n  if (score >= 75) {\n    cout << "A" << endl;\n  } else if (score >= 50) {\n    cout << "B" << endl;\n  } else {\n    cout << "C" << endl;\n  }'),
    );
    expect(output).toBe("C\n");
  });

  it("accepts a body without braces", () => {
    expect(
      run(main('  int a = 3;\n  if (a > 5)\n    cout << "big" << endl;\n  else\n    cout << "small" << endl;')),
    ).toBe("small\n");
  });
});

describe("accumulating values", () => {
  it("supports compound assignment", () => {
    expect(run(main("  int total = 10;\n  total += 5;\n  cout << total << endl;"))).toBe(
      "15\n",
    );
  });

  it("supports every compound operator", () => {
    expect(run(main("  int n = 8;\n  n -= 3;\n  n *= 2;\n  n /= 2;\n  n %= 5;\n  cout << n << endl;"))).toBe(
      "0\n",
    );
  });

  it("refuses compound assignment to an undeclared name", () => {
    expect(() => run(main("  missing += 1;"))).toThrow(/not declared/);
  });
});

describe("arrays", () => {
  it("accepts a sized array filled in by assignment", () => {
    // How most C++ declares a set of sensor readings, and how two of the
    // course's array lessons are written.
    expect(
      run(main('  int values[3];\n  values[0] = 4;\n  values[1] = 5;\n  values[2] = 6;\n  int total = 0;\n  for (int i = 0; i < 3; i++) {\n    total += values[i];\n  }\n  cout << total << endl;')),
    ).toBe("15\n");
  });

  it("still accepts an initialiser list", () => {
    expect(
      run(main("  int values[3] = {1, 2, 3};\n  cout << values[2] << endl;")),
    ).toBe("3\n");
  });
});

describe("switch", () => {
  it("runs the matching case only", () => {
    expect(
      run(main('  int d = 1;\n  switch (d) {\n    case 1:\n      cout << "left" << endl;\n      break;\n    case 2:\n      cout << "right" << endl;\n      break;\n  }')),
    ).toBe("left\n");
  });

  it("falls through into later cases, as C++ does", () => {
    // Missing the break is the classic beginner bug, so the lab reproduces the
    // real behaviour rather than quietly doing the tidy thing.
    expect(
      run(main('  int d = 1;\n  switch (d) {\n    case 1:\n      cout << "a" << endl;\n    case 2:\n      cout << "b" << endl;\n      break;\n    default:\n      cout << "c" << endl;\n  }')),
    ).toBe("a\nb\n");
  });

  it("uses default when nothing matches", () => {
    expect(
      run(main('  int d = 9;\n  switch (d) {\n    case 1:\n      cout << "a" << endl;\n      break;\n    default:\n      cout << "c" << endl;\n  }')),
    ).toBe("c\n");
  });
});

describe("do while", () => {
  it("runs the body at least once", () => {
    expect(
      run(main('  int n = 1;\n  do {\n    cout << n << endl;\n    n = n - 1;\n  } while (n > 0);')),
    ).toBe("1\n");
  });
});

describe("functions", () => {
  it("accepts a void function called as a statement", () => {
    // `greet();` used to be parsed as a variable that did not exist, which is
    // how every void function is used.
    expect(
      run('void greet() {\n  cout << "hi" << endl;\n}\n\nint main() {\n  greet();\n  return 0;\n}'),
    ).toBe("hi\n");
  });

  it("accepts a helper defined after main", () => {
    expect(
      run('int main() {\n  cout << twice(4) << endl;\n  return 0;\n}\n\nint twice(int n) {\n  return n * 2;\n}'),
    ).toBe("8\n");
  });

  it("does not let a return inside a function end the program", () => {
    expect(
      run('int twice(int n) {\n  return n * 2;\n}\n\nint main() {\n  cout << twice(4) << endl;\n  cout << "still here" << endl;\n  return 0;\n}'),
    ).toBe("8\nstill here\n");
  });

  it("names the missing function rather than reporting an unknown statement", () => {
    expect(() => run(main("  moveForward(140, 1500);"))).toThrow(
      /moveForward\(\) is not defined in this snippet/,
    );
  });
});

describe("wider numeric types", () => {
  it("accepts long and unsigned long", () => {
    expect(run(main("  unsigned long lastFeed = 0;\n  long big = 5000000000;\n  cout << big << endl;"))).toBe(
      "5000000000\n",
    );
  });
});

describe("honest failures", () => {
  it("says hardware code cannot run in a browser", () => {
    // A student writing an Arduino sketch in a console lab should be told why,
    // not shown a wall of "unsupported statement".
    expect(() => run(main('  digitalWrite(7, HIGH);'))).toThrow(
      /talks to hardware, so it cannot run in a browser/,
    );
  });

  it("rejects structs and classes instead of silently printing nothing", () => {
    // Silently skipping them produced "Program finished with no output", which
    // is indistinguishable from correct code that prints nothing.
    expect(() => run("struct Point { int x; int y; };\nint main() { return 0; }")).toThrow(
      /Structs, classes, enums and templates/,
    );
  });

  it("still refuses input, which needs a real console", () => {
    expect(() => run(main("  int n;\n  cin >> n;"))).toThrow(/Input is not available/);
  });
});
