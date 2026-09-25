const PYODIDE_VERSION = "v0.27.2";
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/pyodide.js`;
let runtimePromise;

function getRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      if (typeof globalThis.importScripts !== "function") {
        throw new Error("This browser cannot start the Python practice terminal.");
      }
      globalThis.importScripts(PYODIDE_URL);
      if (typeof globalThis.loadPyodide !== "function") {
        throw new Error("The Python runtime could not be loaded from the CDN.");
      }
      return globalThis.loadPyodide({
        indexURL: PYODIDE_URL.replace("pyodide.js", ""),
      });
    })().catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

const runner = `
import ast
import contextlib
import io
import traceback

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

    def isatty(self):
        return False

    def getvalue(self):
        suffix = "\\n\\nOutput limit reached. Only the first 100,000 characters are shown." if self.truncated else ""
        return "".join(self.parts) + suffix

_source = __ACADEMY_SOURCE__
_namespace = {"__name__": "__main__"}
_output = _LimitedWriter(100000)
_error = _LimitedWriter(20000)
_status = "ok"
_result = None

try:
    with contextlib.redirect_stdout(_output), contextlib.redirect_stderr(_error):
        _tree = ast.parse(_source, mode="exec")
        _tail = None
        if _tree.body and isinstance(_tree.body[-1], ast.Expr):
            _tail = _tree.body.pop()
        exec(compile(_tree, "<academy>", "exec"), _namespace)
        if _tail is not None:
            _result = eval(compile(ast.Expression(_tail.value), "<academy>", "eval"), _namespace)
except BaseException:
    _status = traceback.format_exc()

_printed = _output.getvalue()
if _printed:
    __academy_result__ = _printed
elif _status != "ok":
    __academy_result__ = _status
elif _result is not None:
    __academy_result__ = repr(_result)
else:
    __academy_result__ = "Program finished with no output."
`;

self.onmessage = async (event) => {
  if (event.data?.type !== "run") return;
  const { id, code } = event.data;
  try {
    self.postMessage({ type: "loading", id });
    const runtime = await getRuntime();
    self.postMessage({ type: "ready", id });
    const wrapped = runner.replace("__ACADEMY_SOURCE__", () => JSON.stringify(code));
    await runtime.runPythonAsync(wrapped);
    const result = await runtime.runPython("__academy_result__");
    const output = String(result ?? "");
    self.postMessage({
      type: "result",
      id,
      output: output || "Program finished with no output.",
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      id,
      message:
        error?.message ||
        "Python execution failed. Check your internet connection and try again.",
    });
  }
};
