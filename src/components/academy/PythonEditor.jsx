import { useEffect, useRef, useState } from "react";

const MAX_SOURCE_LENGTH = 100000;
const EXECUTION_TIMEOUT = 15000;
const RUNTIME_LOAD_TIMEOUT = 180000;
let sharedWorker;
let activeJob;
let jobQueue = [];

function rejectJobs(message) {
  const currentWorker = sharedWorker;
  const currentJob = activeJob;
  const queuedJobs = jobQueue;
  sharedWorker = null;
  activeJob = null;
  jobQueue = [];
  if (currentWorker) {
    currentWorker.onmessage = null;
    currentWorker.onerror = null;
    currentWorker.terminate();
  }
  if (currentJob) {
    window.clearTimeout(currentJob.timeout);
    currentJob.reject(new Error(message));
  }
  queuedJobs.forEach((job) => job.reject(new Error(message)));
}

function getWorker() {
  if (sharedWorker) return sharedWorker;
  sharedWorker = new Worker(
    new URL("../../workers/pythonWorker.js", import.meta.url),
  );
  sharedWorker.onmessage = (event) => {
    const job = activeJob;
    if (!job || event.data?.id !== job.id) return;
    if (event.data.type === "loading") {
      job.loading = true;
      job.onLoading?.(true);
    }
    if (event.data.type === "ready") {
      job.loading = false;
      window.clearTimeout(job.timeout);
      job.timeout = window.setTimeout(() => {
        rejectJobs(
          "Execution stopped. Your program took too long to finish. Check for infinite loops or very large operations.",
        );
      }, EXECUTION_TIMEOUT);
      job.onLoading?.(false);
    }
    if (event.data.type === "result") {
      window.clearTimeout(job.timeout);
      activeJob = null;
      job.resolve(event.data.output);
      dispatchJob();
    }
    if (event.data.type === "error") {
      window.clearTimeout(job.timeout);
      activeJob = null;
      job.reject(new Error(event.data.message));
      dispatchJob();
    }
  };
  sharedWorker.onerror = (event) => {
    rejectJobs(event.message || "Python runtime failed.");
  };
  return sharedWorker;
}

function dispatchJob() {
  if (!sharedWorker || activeJob || !jobQueue.length) return;
  activeJob = jobQueue.shift();
  activeJob.loading = true;
  activeJob.timeout = window.setTimeout(() => {
    rejectJobs(
      activeJob?.loading
        ? "The Python runtime took too long to download. Check your connection and try again."
        : "Execution stopped. Your program took too long to finish. Check for infinite loops or very large operations.",
    );
  }, RUNTIME_LOAD_TIMEOUT);
  sharedWorker.postMessage({
    type: "run",
    id: activeJob.id,
    code: activeJob.code,
  });
}

function runPython(code, onLoading) {
  if (code.length > MAX_SOURCE_LENGTH) {
    return Promise.reject(
      new Error("Program is too large to run in the browser practice terminal."),
    );
  }
  return new Promise((resolve, reject) => {
    jobQueue.push({
      id: `${Date.now()}-${Math.random()}`,
      code,
      onLoading,
      resolve,
      reject,
    });
    try {
      getWorker();
      dispatchJob();
    } catch (error) {
      rejectJobs(error.message || "Python runtime could not be started.");
    }
  });
}

export default function PythonEditor({ starterCode = "", onSubmit }) {
  const [code, setCode] = useState(starterCode);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [loadingRuntime, setLoadingRuntime] = useState(false);
  const runId = useRef(0);

  useEffect(() => {
    runId.current += 1;
    setCode(starterCode);
    setOutput("");
    setError("");
  }, [starterCode]);

  useEffect(
    () => () => {
      runId.current += 1;
    },
    [],
  );

  async function run() {
    if (running || loadingRuntime) return;
    const currentRun = ++runId.current;
    setRunning(true);
    setOutput("");
    setError("");
    try {
      const result = await runPython(code, (loading) => {
        if (currentRun === runId.current) setLoadingRuntime(loading);
      });
      if (currentRun === runId.current) setOutput(result);
    } catch (runError) {
      if (currentRun === runId.current) {
        setError(runError.message || "Python execution failed.");
      }
    } finally {
      if (currentRun === runId.current) {
        setLoadingRuntime(false);
        setRunning(false);
      }
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
          disabled={running || loadingRuntime}
        >
          {loadingRuntime
            ? "Preparing Python..."
            : running
              ? "Running..."
              : "Run Python"}
        </button>
        <button
          type="button"
          className="button-secondary border-slate-700 text-slate-200"
          onClick={() => {
            runId.current += 1;
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
            disabled={running || loadingRuntime}
          >
            Submit code
          </button>
        )}
      </div>
      {(output || error) && (
        <pre
          role={error ? "alert" : "status"}
          className={`max-h-96 overflow-auto whitespace-pre-wrap border-t border-slate-800 p-4 text-sm ${error ? "text-red-300" : "text-emerald-300"}`}
        >
          {error || output}
        </pre>
      )}
    </section>
  );
}
