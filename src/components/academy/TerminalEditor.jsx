import { useEffect, useMemo, useRef, useState } from "react";
import { createTerminal } from "../../lib/academyTerminal";
import { separateTerminalInstructions } from "../../lib/academyTerminalContent";
import ProtectedContent from "./ProtectedContent";
import TerminalFrame from "./TerminalFrame";

const BANNER =
  "Type help to see the commands. Everything here stays in this browser tab.";

export default function TerminalEditor({ starterScript = "" }) {
  const {
    code: scriptCode,
    instructions,
  } = separateTerminalInstructions(starterScript);
  // The filesystem is seeded from the lesson, so a lesson about grep starts with
  // a file worth grepping rather than an empty prompt.
  const initialFiles = useMemo(() => {
    const files = {};
    for (const line of scriptCode.split("\n")) {
      const match = line.match(/^#\s*(\S+)\s*(.*)$/);
      if (match) files[`/${match[1]}`] = match[2];
    }
    if (Object.keys(files).length === 0) files["/notes.txt"] = "hello\nsecond line\n";
    return files;
  }, [scriptCode]);

  const terminal = useMemo(() => createTerminal(initialFiles), [initialFiles]);
  const [lines, setLines] = useState([]);
  const [input, setInput] = useState("");
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef(null);
  const inputRef = useRef(null);

  function refresh() {
    setLines(terminal.transcript());
  }

  useEffect(() => {
    terminal.reset(initialFiles);
    setLines([{ kind: "system", text: BANNER }]);
    setCommandHistory([]);
    setHistoryIndex(-1);
  }, [terminal, initialFiles]);

  useEffect(() => {
    const output = outputRef.current;
    if (!output) return;
    if (typeof output.scrollTo === "function") {
      output.scrollTo({ top: output.scrollHeight });
    } else {
      output.scrollTop = output.scrollHeight;
    }
  }, [lines]);

  function submit(event) {
    event.preventDefault();
    const line = input;
    terminal.run(line);
    if (line.trim()) {
      setCommandHistory((previous) => [line, ...previous].slice(0, 50));
    }
    setHistoryIndex(-1);
    setInput("");
    refresh();
    inputRef.current?.focus();
  }

  function onKeyDown(event) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.min(historyIndex + 1, commandHistory.length - 1);
      if (next >= 0) {
        setHistoryIndex(next);
        setInput(commandHistory[next]);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = historyIndex - 1;
      setHistoryIndex(next);
      setInput(next >= 0 ? commandHistory[next] : "");
    }
  }

  return (
    <TerminalFrame title="Command-line practice terminal" variant="shell">
      {instructions.length > 0 && (
        <ProtectedContent className="border-b border-emerald-900/70 bg-emerald-950/40 px-4 py-3 text-sm leading-6 text-emerald-100">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300">
            Lesson prompt
          </p>
          <ul className="space-y-1">
            {instructions.map((instruction, index) => (
              <li key={`${instruction}-${index}`}>{instruction}</li>
            ))}
          </ul>
        </ProtectedContent>
      )}
      <div
        ref={outputRef}
        role="log"
        aria-label="Terminal output"
        aria-live="polite"
        className="max-h-80 min-h-48 overflow-auto p-4 font-mono text-sm leading-6"
      >
        {lines.map((line, index) => (
          <p
            key={index}
            className={
              line.kind === "input"
                ? "text-cyan-300"
                : line.kind === "system"
                  ? "text-slate-500"
                  : "text-emerald-200"
            }
          >
            {line.kind === "input" ? `$ ${line.text}` : line.text || " "}
          </p>
        ))}
      </div>

      <form
        onSubmit={submit}
        className="flex items-center gap-2 border-t border-slate-800 px-4 py-3"
      >
        <label htmlFor="terminal-input" className="font-mono text-sm text-emerald-300">
          $
        </label>
        <input
          id="terminal-input"
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          spellCheck="false"
          autoComplete="off"
          placeholder="ls"
          aria-label="Terminal command"
          className="min-h-11 flex-1 bg-transparent font-mono text-sm text-slate-100 outline-none placeholder:text-slate-600"
        />
        <button type="submit" className="button-primary">
          Run
        </button>
        <button
          type="button"
          className="button-secondary border-slate-700 text-slate-200"
          onClick={() => {
            terminal.reset(initialFiles);
            setLines([{ kind: "system", text: BANNER }]);
            setCommandHistory([]);
            setHistoryIndex(-1);
          }}
        >
          Reset
        </button>
      </form>
    </TerminalFrame>
  );
}
