import { useEffect, useRef, useState } from "react";

const MAX_SOURCE_LENGTH = 100000;
const EXECUTION_TIMEOUT = 5000;
let sharedWorker;
let activeJob;
let jobQueue = [];

function rejectJobs(message) {
  const worker = sharedWorker;
  const currentJob = activeJob;
  const queuedJobs = jobQueue;
  sharedWorker = null;
  activeJob = null;
  jobQueue = [];
  worker?.terminate();
  if (currentJob) {
    window.clearTimeout(currentJob.timeout);
    currentJob.reject(new Error(message));
  }
  queuedJobs.forEach((job) => job.reject(new Error(message)));
}

function dispatchJob() {
  if (!sharedWorker || activeJob || !jobQueue.length) return;
  activeJob = jobQueue.shift();
  activeJob.timeout = window.setTimeout(
    () => rejectJobs("Execution stopped. Check the loop condition or reduce the program size."),
    EXECUTION_TIMEOUT,
  );
  sharedWorker.postMessage({ type: "run", id: activeJob.id, code: activeJob.code });
}

function getWorker() {
  if (sharedWorker) return sharedWorker;
  sharedWorker = new Worker(new URL("../../workers/cppWorker.js", import.meta.url));
  sharedWorker.onmessage = (event) => {
    const job = activeJob;
    if (!job || event.data?.id !== job.id) return;
    window.clearTimeout(job.timeout);
    activeJob = null;
    if (event.data.type === "result") job.resolve(event.data.output);
    if (event.data.type === "error") job.reject(new Error(event.data.message));
    dispatchJob();
  };
  sharedWorker.onerror = (event) => rejectJobs(event.message || "C++ lab failed.");
  return sharedWorker;
}

function runCpp(code) {
  if (code.length > MAX_SOURCE_LENGTH) {
    return Promise.reject(new Error("This program is too large for the beginner console lab."));
  }
  return new Promise((resolve, reject) => {
    jobQueue.push({ id: `${Date.now()}-${Math.random()}`, code, resolve, reject });
    try {
      getWorker();
      dispatchJob();
    } catch (error) {
      rejectJobs(error.message || "C++ lab could not start.");
    }
  });
}

export default function CppEditor({ starterCode = "" }) {
  const [code, setCode] = useState(starterCode);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const runId = useRef(0);

  useEffect(() => {
    runId.current += 1;
    setCode(starterCode);
    setOutput("");
    setError("");
  }, [starterCode]);

  useEffect(() => () => {
    runId.current += 1;
  }, []);

  async function run() {
    if (running) return;
    const currentRun = ++runId.current;
    setRunning(true);
    setOutput("");
    setError("");
    try {
      const result = await runCpp(code);
      if (currentRun === runId.current) setOutput(result);
    } catch (runError) {
      if (currentRun === runId.current) setError(runError.message);
    } finally {
      if (currentRun === runId.current) setRunning(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
        <span>C++ Console Lab</span>
        <span>Beginner subset</span>
      </div>
      <textarea
        aria-label="C++ code editor"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        spellCheck="false"
        className="min-h-64 w-full resize-y bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100 outline-none"
      />
      <div className="flex flex-wrap gap-2 border-t border-slate-800 p-3">
        <button type="button" className="button-primary" onClick={run} disabled={running}>
          {running ? "Running..." : "Run C++"}
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
