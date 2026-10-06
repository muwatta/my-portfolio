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

// stdin mirrors the editor: a run is given whatever input the exercise supplies.
const run = (code, stdin = "") => new BeginnerCpp(stdin).run(code);
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

  it("reads standard input, which ten of the course's exercises need", () => {
    // This used to throw "Input is not available in this first console lab yet",
    // which meant two thirds of the C++ exercises could not be run at all. Every
    // reference test for them supplies input, so refusing to read it made the lab
    // unusable for its own content.
    expect(run(main("  int n;\n  cin >> n;\n  cout << n * 2 << endl;"), "21")).toBe(
      "42\n",
    );
  });

  it("reads chained values in order", () => {
    expect(
      run(main("  int a;\n  int b;\n  cin >> a >> b;\n  cout << a + b << endl;"), "3 4"),
    ).toBe("7\n");
  });

  it("accepts the std:: qualified form", () => {
    expect(
      run(
        "#include <iostream>\nint main() {\n  int x;\n  std::cin >> x;\n  std::cout << x << endl;\n  return 0;\n}",
        "9",
      ),
    ).toBe("9\n");
  });

  it("says so when the program reads more input than it was given", () => {
    // A real cin would block or hit EOF. Failing loudly beats silently reading
    // nothing, which would look like a passing run with a wrong answer.
    expect(() => run(main("  int n;\n  cin >> n;\n  cout << n;"), "")).toThrow(
      /more input than was supplied/,
    );
  });

  it("still refuses getline, which it does not model", () => {
    // Fails loudly rather than quietly reading nothing, which would look like a
    // passing run with an empty answer. The exact wording comes from the generic
    // unknown-identifier path, so assert that it throws at all.
    expect(() =>
      run(main("  string line;\n  getline(cin, line);\n  cout << line;"), "hi"),
    ).toThrow(/getline/);
  });
});

describe("operator precedence", () => {
  it("multiplies before adding", () => {
    expect(run(main("  cout << 2 + 3 * 4 << endl;"))).toBe("14\n");
  });

  it("still respects parentheses", () => {
    expect(run(main("  cout << (2 + 3) * 4 << endl;"))).toBe("20\n");
  });

  it("compares before combining with and", () => {
    // Splitting on the rightmost operator of the whole expression, which is what
    // this did first, tried to evaluate "300 && attempts" as a number and then
    // looped forever or gave up.
    expect(
      run(main("  int a = 3; int b = 5; int c = 1; int d = 9;\n  if (a < b && c < d) {\n    cout << \"both\" << endl;\n  }")),
    ).toBe("both\n");
  });

  it("compares two array elements in one condition", () => {
    // The array-access pattern was greedy, so `centre[step] < left[step] && ...`
    // was read as one array index and the whole comparison was lost.
    expect(
      run(main("  int left[2]; int centre[2]; int right[2];\n  left[0] = 40; centre[0] = 10; right[0] = 20;\n  left[1] = 5; centre[1] = 40; right[1] = 30;\n  for (int step = 0; step < 2; step++) {\n    if (centre[step] < left[step] && centre[step] < right[step]) {\n      cout << \"forward\" << endl;\n    } else if (left[step] < right[step]) {\n      cout << \"left\" << endl;\n    } else {\n      cout << \"right\" << endl;\n    }\n  }")),
    ).toBe("forward\nleft\n");
  });

  it("treats a trailing minus as a sign, not an operation", () => {
    // `difference * -1` split at the sign and tried to evaluate `difference *`.
    expect(
      run(main("  int difference = 5;\n  if (difference < 0) {\n    difference = difference * -1;\n  }\n  cout << difference << endl;")),
    ).toBe("5\n");
  });

  it("runs the conditional operator", () => {
    expect(run(main("  int kept = 3; int total = 60;\n  cout << (kept > 0 ? total / kept : 0) << endl;"))).toBe(
      "20\n",
    );
    expect(run(main("  int kept = 0; int total = 60;\n  cout << (kept > 0 ? total / kept : 0) << endl;"))).toBe(
      "0\n",
    );
  });
});

describe("array indices that are expressions", () => {
  it("assigns through a computed index", () => {
    expect(
      run(main("  int kept[3];\n  int count = 0;\n  kept[count] = 7;\n  count++;\n  cout << kept[0] << endl;")),
    ).toBe("7\n");
  });
});
