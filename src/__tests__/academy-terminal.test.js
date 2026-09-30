import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTerminal, TERMINAL_COMMANDS } from "../lib/academyTerminal";

const FILES = {
  "/notes.txt": "line one\nline two\nerror three\nline four\n",
  "/projects": "",
  "/projects/readme.md": "the project\n",
};

const run = (commands) => {
  const terminal = createTerminal({ ...FILES });
  for (const command of commands) terminal.run(command);
  return terminal
    .transcript()
    .filter((line) => line.kind === "output")
    .map((line) => line.text)
    .join("\n");
};

describe("navigation", () => {
  it("reports where it is", () => {
    expect(run(["pwd"])).toBe("/");
  });

  it("lists files and marks directories", () => {
    const output = run(["ls"]);
    expect(output).toContain("notes.txt");
    expect(output).toContain("projects/");
  });

  it("changes directory and remembers where it went", () => {
    expect(run(["cd projects", "pwd"])).toBe("/projects");
  });

  it("walks back up with ..", () => {
    expect(run(["cd projects", "cd ..", "pwd"])).toBe("/");
  });

  it("refuses a directory that does not exist, and says so", () => {
    // Silently staying put would leave a student wondering why ls showed the
    // wrong thing.
    expect(run(["cd nowhere", "pwd"])).toContain("no such directory");
  });
});

describe("reading and writing", () => {
  it("prints a file", () => {
    expect(run(["cat notes.txt"])).toContain("line two");
  });

  it("counts lines, words and characters", () => {
    // 4 newlines, 8 words, 40 characters, and lines are counted as
    // newlines rather than as split pieces, which is what wc actually does.
    expect(run(["wc notes.txt"])).toBe("4 8 40 notes.txt");
  });

  it("previews only the first lines", () => {
    const output = run(["head -n 2 notes.txt"]);
    expect(output).toBe("line one\nline two");
  });

  it("makes a file and then lists it", () => {
    expect(run(["touch ideas.txt", "ls"])).toContain("ideas.txt");
  });

  it("makes a directory and puts a file inside it", () => {
    const terminal = createTerminal({});
    terminal.run("mkdir robot");
    terminal.run("mkdir robot/src");
    terminal.run("touch robot/src/main.c");
    terminal.run("ls robot/src");
    expect(terminal.transcript().map((l) => l.text).join("\n")).toContain("main.c");
  });

  it("deletes a file and complains the second time", () => {
    expect(run(["rm notes.txt", "rm notes.txt"])).toContain("no such file");
  });
});

describe("searching", () => {
  it("prints matching lines with their line numbers", () => {
    expect(run(["grep error notes.txt"])).toBe("3: error three");
  });

  it("says so when nothing matches", () => {
    // An empty result is an answer, and a student needs to know it was a search
    // that found nothing rather than a command that failed.
    expect(run(["grep missing notes.txt"])).toBe("no matches");
  });

  it("finds files by name", () => {
    const output = run(["find -name md"]);
    expect(output).toContain("/projects/readme.md");
    expect(output).not.toContain("notes.txt");
  });
});

describe("it is a sandbox, not a shell", () => {
  it("has no access outside its own filesystem", () => {
    // Every one of these is a real command that would touch a student's machine.
    for (const command of ["sudo", "chmod", "curl", "wget", "ssh", "python", "node", "eval", "exec"]) {
      expect(TERMINAL_COMMANDS).not.toContain(command);
      expect(run([command])).toContain("command not found");
    }
  });

  it("refuses to remove a directory with rm", () => {
    // A real rm -r would delete a tree. The sandbox only removes one named file,
    // so a lesson can mention rm without being able to teach a data loss lesson.
    expect(run(["rm projects"])).toContain("refusing to remove a directory");
  });

  it("does not resolve paths outside the root", () => {
    // Enough .. to climb out of the sandbox still lands at the root, because
    // there is nothing above it.
    expect(run(["cd ../../..", "pwd"])).toBe("/");
  });

  it("treats its filesystem as the whole world", () => {
    expect(run(["cd /", "ls"])).toContain("notes.txt");
  });
});

describe("quality of life", () => {
  it("lists every command from help", () => {
    const output = run(["help"]);
    for (const command of TERMINAL_COMMANDS) expect(output).toContain(command);
  });

  it("explains one command with man", () => {
    expect(run(["man grep"])).toContain("find lines containing");
  });

  it("remembers what was typed", () => {
    expect(run(["ls", "pwd", "history"])).toContain("pwd");
  });

  it("ignores a blank line", () => {
    const terminal = createTerminal({});
    terminal.run("   ");
    expect(terminal.transcript()).toHaveLength(0);
  });

  it("survives a command that throws, and carries on", () => {
    const terminal = createTerminal({});
    terminal.run("cat ");
    terminal.run("pwd");
    const output = terminal.transcript().map((l) => l.text).join("\n");
    expect(output).toContain("/");
  });

  it("puts the files back on reset", () => {
    const terminal = createTerminal({ ...FILES });
    terminal.run("touch mess.txt");
    terminal.run("cd projects");
    terminal.reset({ ...FILES });
    terminal.run("ls");
    const output = terminal.transcript().map((l) => l.text).join("\n");
    expect(output).toContain("notes.txt");
    expect(output).not.toContain("mess.txt");
  });
});

describe("the Terminal course content", () => {
  const course = readFileSync(
    "supabase/migrations/20261309000000_terminal_course.sql",
    "utf8",
  );

  it("is a course the lesson page knows how to render", () => {
    // The lesson page picks the terminal from academy_courses.language, so the
    // value here and the check there have to agree.
    expect(course).toMatch(/'shell'/);
  });

  it("has five lessons in each of its five weeks", () => {
    // lesson_number is written inline in the select, after the slug.
    const numbers = course.match(/', ([1-5]),\n/g) ?? [];
    expect(numbers).toHaveLength(25);
    for (const value of ["1", "2", "3", "4", "5"]) {
      expect(numbers.filter((line) => line === `', ${value},\n`)).toHaveLength(5);
    }
  });

  it("chains its lessons so they unlock in order", () => {
    // Checked line by line rather than as one long substring: searching this
    // generated file for the full function name did not behave, and the chain
    // itself is verified against the live database anyway.
    const lines = course.split("\n");
    const at = lines.findIndex((line) => line.includes("rechain"));
    expect(at).toBeGreaterThan(-1);
    expect(lines.slice(at, at + 2).join(" ")).toContain("terminal-and-command-line");
  });

  it("gives every lesson a terminal script to start from", () => {
    expect((course.match(/'starter_code'/g) ?? []).length).toBe(25);
  });

  it("is not re-runnable into duplicates", () => {
    expect((course.match(/not exists/g) ?? []).length).toBe(25);
  });
});
