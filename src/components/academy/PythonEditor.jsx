import { useEffect, useRef, useState } from "react";

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js";
let pyodidePromise;

function loadPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${PYODIDE_URL}"]`);
      if (existing) {
        existing.addEventListener("load", () =>
          resolve(
            window.loadPyodide({
              indexURL: PYODIDE_URL.replace("pyodide.js", ""),
            }),
          ),
        );
        existing.addEventListener("error", reject);
        return;
      }
      const script = document.createElement("script");
      script.src = PYODIDE_URL;
      script.async = true;
      script.onload = () =>
        window
          .loadPyodide({ indexURL: PYODIDE_URL.replace("pyodide.js", "") })
          .then(resolve, reject);
      script.onerror = () =>
        reject(new Error("Python runtime could not be loaded."));
      document.head.appendChild(script);
    });
  }
  return pyodidePromise;
}

export default function PythonEditor({ starterCode = "", onSubmit }) {
  const [code, setCode] = useState(starterCode);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const runId = useRef(0);

  useEffect(() => setCode(starterCode), [starterCode]);

  async function run() {
    const currentRun = ++runId.current;
    setRunning(true);
    setOutput("");
    setError("");
    try {
      const pyodide = await loadPyodide();
      const wrapped = `import io, contextlib\n_output = io.StringIO()\nwith contextlib.redirect_stdout(_output):\n    exec(${JSON.stringify(code)}, {})\n_output.getvalue()`;
      const result = await Promise.race([
        pyodide.runPythonAsync(wrapped),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error("Execution timed out. Check for an infinite loop."),
              ),
            5000,
          ),
        ),
      ]);
      if (currentRun === runId.current)
        setOutput(String(result || "No output."));
    } catch (runError) {
      if (currentRun === runId.current)
        setError(runError.message || "Python execution failed.");
    } finally {
      if (currentRun === runId.current) setRunning(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100">
      <textarea
        aria-label="Python code editor"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        spellCheck="false"
        className="min-h-64 w-full resize-y bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100 outline-none"
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 p-3">
        <button
          type="button"
          className="button-primary"
          onClick={run}
          disabled={running}
        >
          {running ? "Running..." : "Run Python"}
        </button>
        <button
          type="button"
          className="button-secondary border-slate-700 text-slate-200"
          onClick={() => {
            setCode(starterCode);
            setOutput("");
            setError("");
          }}
        >
          Reset
        </button>
        {onSubmit && (
          <button
            type="button"
            className="button-secondary border-slate-700 text-slate-200"
            onClick={() => onSubmit(code)}
          >
            Submit code
          </button>
        )}
      </div>
      {(output || error) && (
        <pre
          role={error ? "alert" : "status"}
          className={`border-t border-slate-800 p-4 text-sm whitespace-pre-wrap ${error ? "text-red-300" : "text-emerald-300"}`}
        >
          {error || output}
        </pre>
      )}
    </section>
  );
}
