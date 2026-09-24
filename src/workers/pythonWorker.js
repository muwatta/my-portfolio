const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js";
let runtimePromise;

function getRuntime() {
  if (!runtimePromise) {
    globalThis.importScripts(PYODIDE_URL);
    runtimePromise = globalThis.loadPyodide({
      indexURL: PYODIDE_URL.replace("pyodide.js", ""),
    });
  }
  return runtimePromise;
}

self.onmessage = async (event) => {
  if (event.data?.type !== "run") return;
  const { id, code } = event.data;
  try {
    self.postMessage({ type: "loading", id });
    const runtime = await getRuntime();
    self.postMessage({ type: "ready", id });
    const wrapped = `
import contextlib
import io

class _LimitedWriter:
    def __init__(self, limit):
        self.limit = limit
        self.parts = []
        self.length = 0
        self.truncated = False

    def write(self, value):
        value = str(value)
        remaining = self.limit - self.length
        if remaining > 0:
            self.parts.append(value[:remaining])
            self.length += len(value[:remaining])
        if len(value) > max(remaining, 0):
            self.truncated = True
        return len(value)

    def getvalue(self):
        suffix = "\\n\\nOutput limit reached. Only the first 100,000 characters are shown." if self.truncated else ""
        return "".join(self.parts) + suffix

_output = _LimitedWriter(100000)
_error = _LimitedWriter(20000)
with contextlib.redirect_stdout(_output), contextlib.redirect_stderr(_error):
    exec(${JSON.stringify(code)}, {})
_output.getvalue()
`;
    const result = await runtime.runPythonAsync(wrapped);
    self.postMessage({
      type: "result",
      id,
      output: String(result || "No output."),
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      id,
      message: error?.message || "Python execution failed.",
    });
  }
};
