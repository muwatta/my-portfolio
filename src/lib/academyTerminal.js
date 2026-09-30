// A small, safe terminal that runs entirely in the page.
//
// Nothing here touches a real filesystem, a real process or the network. The
// filesystem is a plain object held in memory, and only the commands in COMMANDS
// exist, so a lesson cannot do anything a real shell could do to a student's
// machine. That is the whole point: a student gets to practise a real prompt and
// real commands without a server, and a sandbox escape is not a thing this file
// can express.

const MAX_HISTORY = 60;
const MAX_OUTPUT = 20000;
const MAX_LIST = 400;

function splitArgs(line) {
  // Deliberately simple quoting: enough for `grep "two words" file`, which is
  // all a lesson needs, and it does not try to be a shell.
  const args = [];
  let current = "";
  let quote = null;
  for (const character of line) {
    if (quote) {
      if (character === quote) quote = null;
      else current += character;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (current) args.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  if (current) args.push(current);
  return args;
}

function normalise(path, cwd) {
  const parts = (path.startsWith("/") ? path : `${cwd}/${path}`).split("/");
  const out = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return `/${out.join("/")}`.replace(/\/+$/, "") || "/";
}

function parentOf(path) {
  if (path === "/") return null;
  const cut = path.lastIndexOf("/");
  return cut <= 0 ? "/" : path.slice(0, cut);
}

function baseName(path) {
  return path === "/" ? "/" : path.slice(path.lastIndexOf("/") + 1);
}

export function createTerminal(initialFiles = {}) {
  // Two structures rather than one. `files` holds the contents of each file, and
  // `dirs` holds the directories. The first version stored a directory's child
  // names inside the directory's own key, which meant a new file was invisible
  // to ls because nothing kept the parent's list up to date, and the root was
  // not in the map at all so `ls` and `cd .` both failed.
  const files = {};
  const dirs = new Set(["/"]);
  let cwd = "/";
  const history = [];
  const transcript = [];

  const seed = (next) => {
    for (const [path, contents] of Object.entries(next ?? {})) {
      const full = normalise(path, "/");
      if (full === "/") continue;
      files[full] = String(contents);
      // Every ancestor of a file is a directory.
      let parent = parentOf(full);
      while (parent) {
        dirs.add(parent);
        parent = parentOf(parent);
      }
    }
  };

  function write(text) {
    transcript.push({ kind: "output", text: String(text) });
  }

  const isDir = (path) => dirs.has(path);
  const isFile = (path) => Object.prototype.hasOwnProperty.call(files, path);

  // Lists the immediate children of a directory, derived from the keys rather
  // than kept in step by hand, so a file can never be invisible to ls.
  function childrenOf(path) {
    const prefix = path === "/" ? "/" : `${path}/`;
    const seen = new Set();
    for (const candidate of [...dirs, ...Object.keys(files)]) {
      if (candidate === path || !candidate.startsWith(prefix)) continue;
      const rest = candidate.slice(prefix.length);
      if (!rest) continue;
      seen.add(rest.split("/")[0]);
    }
    return [...seen].sort();
  }

  function resolve(name) {
    return normalise(name, cwd);
  }

  const COMMANDS = {
    help: {
      summary: "list the commands this terminal understands",
      run() {
        const names = Object.keys(COMMANDS).sort();
        write("Available commands:");
        for (const name of names) write(`  ${name.padEnd(10)} ${COMMANDS[name].summary}`);
        write("");
        write('Arguments: use quotes for anything with a space, like grep "two words" notes.txt');
      },
    },
    pwd: {
      summary: "print the current directory",
      run() {
        write(cwd);
      },
    },
    ls: {
      summary: "list what is in a directory",
      run(args) {
        const target = resolve(args[0] ?? ".");
        if (!isDir(target)) {
          write(`ls: ${args[0] ?? "."}: no such directory`);
          return;
        }
        const names = childrenOf(target);
        if (names.length === 0) {
          write("(empty)");
          return;
        }
        for (const name of names.slice(0, MAX_LIST)) {
          const full = target === "/" ? `/${name}` : `${target}/${name}`;
          write(isDir(full) ? `${name}/` : name);
        }
        if (names.length > MAX_LIST) write(`... and ${names.length - MAX_LIST} more`);
      },
    },
    cd: {
      summary: "change directory",
      run(args) {
        const target = resolve(args[0] ?? "/");
        if (!isDir(target)) {
          write(`cd: ${args[0]}: no such directory`);
          return;
        }
        cwd = target;
      },
    },
    cat: {
      summary: "print a file",
      run(args) {
        if (!args.length) {
          write("cat: tell me which file, like cat notes.txt");
          return;
        }
        for (const name of args) {
          const full = resolve(name);
          if (isFile(full)) write(files[full].replace(/\n$/, ""));
          else write(`cat: ${name}: no such file`);
        }
      },
    },
    mkdir: {
      summary: "make a directory",
      run(args) {
        for (const name of args) {
          const full = resolve(name);
          if (isDir(full) || isFile(full)) {
            write(`mkdir: ${name}: already exists`);
            continue;
          }
          dirs.add(full);
        }
      },
    },
    touch: {
      summary: "make an empty file",
      run(args) {
        for (const name of args) {
          const full = resolve(name);
          if (isDir(full)) {
            write(`touch: ${name}: is a directory`);
            continue;
          }
          if (!isFile(full)) files[full] = "";
        }
      },
    },
    rm: {
      summary: "delete a file",
      run(args) {
        for (const name of args) {
          const full = resolve(name);
          if (isDir(full)) {
            // A real rm -r would delete a tree. This one cannot, so a lesson can
            // teach rm without the sandbox being able to destroy anything.
            write(`rm: ${name}: refusing to remove a directory, remove one named file at a time`);
            continue;
          }
          if (isFile(full)) delete files[full];
          else write(`rm: ${name}: no such file`);
        }
      },
    },
    echo: {
      summary: "print text",
      run(args) {
        write(args.join(" "));
      },
    },
    head: {
      summary: "print the first lines of a file",
      run(args) {
        let count = 10;
        let name = null;
        for (let index = 0; index < args.length; index += 1) {
          if (args[index] === "-n") {
            count = Number(args[index + 1]) || 10;
            index += 1;
          } else {
            name = args[index];
          }
        }
        const full = name ? resolve(name) : null;
        if (!full || !isFile(full)) {
          write(`head: ${name ?? ""}: no such file`);
          return;
        }
        write(files[full].split("\n").slice(0, count).join("\n"));
      },
    },
    wc: {
      summary: "count lines, words and characters",
      run(args) {
        const name = args.find((argument) => argument !== "-l" && argument !== "-w");
        const full = name ? resolve(name) : null;
        if (!full || !isFile(full)) {
          write(`wc: ${name ?? ""}: no such file`);
          return;
        }
        const body = files[full];
        // Lines are counted as newlines, which is what wc does. Splitting on
        // "\n" and taking the length counts a trailing newline as an extra blank
        // line, so a file ending in a newline reported one line too many.
        const lines = (body.match(/\n/g) ?? []).length;
        const words = body.split(/\s+/).filter(Boolean).length;
        write(`${lines} ${words} ${body.length} ${name}`);
      },
    },
    grep: {
      summary: "find lines containing some text",
      run(args) {
        const pattern = args[0];
        const name = args[1];
        if (!pattern) {
          write("grep: tell me what to look for, like grep error notes.txt");
          return;
        }
        const full = name ? resolve(name) : null;
        if (!full || !isFile(full)) {
          write(`grep: ${name ?? ""}: no such file`);
          return;
        }
        let found = 0;
        files[full].split("\n").forEach((line, index) => {
          if (line.toLowerCase().includes(pattern.toLowerCase())) {
            found += 1;
            write(`${index + 1}: ${line}`);
          }
        });
        if (found === 0) write("no matches");
      },
    },
    find: {
      summary: "find files by name",
      run(args) {
        const at = args.indexOf("-name");
        const pattern = at >= 0 ? (args[at + 1] ?? "*") : "*";
        const needle = pattern.replace(/\*/g, "").toLowerCase();
        for (const path of Object.keys(files).sort()) {
          if (!needle || baseName(path).toLowerCase().includes(needle)) write(path);
        }
      },
    },
    history: {
      summary: "show the commands you have run",
      run() {
        history.forEach((entry, index) => write(`${String(index + 1).padStart(3)}  ${entry}`));
      },
    },
    date: {
      summary: "print a date",
      run() {
        write(new Date().toString());
      },
    },
    whoami: {
      summary: "print who you are",
      run() {
        write("student");
      },
    },
    clear: {
      summary: "clear the screen",
      run() {
        transcript.length = 0;
      },
    },
    man: {
      summary: "explain one command",
      run(args) {
        const command = COMMANDS[args[0]];
        if (!command) {
          write(`No manual entry for ${args[0] ?? ""}. Try help.`);
          return;
        }
        write(`${args[0]}: ${command.summary}`);
      },
    },
  };

  function run(line) {
    const trimmed = String(line ?? "").trim();
    if (!trimmed) return;
    history.push(trimmed);
    if (history.length > MAX_HISTORY) history.shift();
    transcript.push({ kind: "input", text: trimmed });

    const [name, ...args] = splitArgs(trimmed);
    const command = COMMANDS[name];
    if (!command) {
      write(`${name}: command not found. Type help to see what this terminal has.`);
      return;
    }
    try {
      command.run(args);
    } catch (error) {
      write(`${name}: ${error.message}`);
    }
  }

  seed(initialFiles);

  return {
    run,
    reset(next) {
      for (const key of Object.keys(files)) delete files[key];
      dirs.clear();
      dirs.add("/");
      cwd = "/";
      history.length = 0;
      transcript.length = 0;
      seed(next ?? initialFiles);
    },
    // Copied on the way out so React gets a new array and actually re-renders.
    transcript: () => [...transcript],
    cwd: () => cwd,
  };
}

export const TERMINAL_COMMANDS = [
  "help", "pwd", "ls", "cd", "cat", "mkdir", "touch", "rm",
  "echo", "head", "wc", "grep", "find", "history", "date",
  "whoami", "clear", "man",
];
