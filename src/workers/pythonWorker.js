const PYODIDE_VERSION = "v0.27.2";
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/pyodide.js`;

// Packages the AI/ML weeks need. Not passed to loadPyodide up front: the data and
// machine-learning weeks would then pay a multi-megabyte download on the very
// first lesson, which is `print`. They are fetched only when a program actually
// imports one, and remembered for the rest of the session.
const IMPORTABLE_PACKAGES = [
  "numpy",
  "pandas",
  "scikit-learn",
  "matplotlib",
];
const IMPORT_PATTERN = new RegExp(
  `^\\s*(?:import|from)\\s+(${IMPORTABLE_PACKAGES.join("|")})\\b`,
  "gm",
);

let runtimePromise;
const loadedPackages = new Set();

// Imported modules the runtime does not ship, so the student gets a real
// ModuleNotFoundError naming the module rather than a vague failure.
//
// This deliberately does not try to enumerate the Python standard library. A
// hand-maintained allowlist is wrong twice over: it rejects perfectly ordinary
// imports the moment someone forgets one, which is exactly what happened with
// math and os here. Instead, an import is only rejected once we have positively
// identified it as something the runtime cannot provide.
const UNKNOWN_IMPORT_PATTERN = new RegExp(
  "^\\s*(?:import|from)\\s+([A-Za-z_][A-Za-z0-9_]*)",
  "gm",
);

// Aliases students habitually use. Pyodide ships the module under the package
// name, so these resolve once the package is loaded.
const IMPORT_ALIASES = { pyplot: "matplotlib", plt: "matplotlib", mpl: "matplotlib" };

async function getRuntime() {
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

async function ensurePackages(runtime, code) {
  const wanted = new Set();
  for (const match of code.matchAll(IMPORT_PATTERN)) wanted.add(match[1]);
  // `from sklearn.linear_model import ...` names the module, not the package.
  for (const match of code.matchAll(UNKNOWN_IMPORT_PATTERN)) {
    const name = match[1];
    if (name === "sklearn" || name.startsWith("sklearn.")) wanted.add("scikit-learn");
    if (name in IMPORT_ALIASES) wanted.add(IMPORT_ALIASES[name]);
  }
  if (wanted.size === 0) return [];

  const missing = [...wanted].filter((name) => !loadedPackages.has(name));
  if (missing.length === 0) return [];

  for (const name of missing) {
    // loadPackage resolves or rejects on its own, so a package that cannot be
    // fetched surfaces as a normal Python ImportError rather than a crash.
    await runtime.loadPackage(name);
    loadedPackages.add(name);
  }
  return missing;
}

const runner = `
import ast
import builtins
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
_input_error = None
_result = None
_academy_input_values = __ACADEMY_STDIN__.splitlines()
_academy_input_index = 0
_academy_original_input = builtins.input

def _academy_input(prompt=""):
    global _academy_input_index
    if prompt:
        print(prompt, end="")
    if _academy_input_index >= len(_academy_input_values):
        raise EOFError("This program needs more input. Enter one value per line in Program input.")
    value = _academy_input_values[_academy_input_index]
    _academy_input_index += 1
    return value

try:
    builtins.input = _academy_input
    with contextlib.redirect_stdout(_output), contextlib.redirect_stderr(_error):
        _tree = ast.parse(_source, mode="exec")
        _tail = None
        if _tree.body and isinstance(_tree.body[-1], ast.Expr):
            _tail = _tree.body.pop()
        exec(compile(_tree, "<academy>", "exec"), _namespace)
        if _tail is not None:
            _result = eval(compile(ast.Expression(_tail.value), "<academy>", "eval"), _namespace)
except BaseException as _exception:
    if isinstance(_exception, EOFError):
        _input_error = str(_exception)
    else:
        _status = traceback.format_exc()
finally:
    builtins.input = _academy_original_input

_printed = _output.getvalue()
if _input_error:
    __academy_result__ = _printed + ("\\n" if _printed and not _printed.endswith("\\n") else "") + _input_error
elif _printed:
    __academy_result__ = _printed
elif _status != "ok":
    __academy_result__ = _status
elif _result is not None:
    __academy_result__ = repr(_result)
elif _academy_input_index:
    __academy_result__ = "Your program read the input but did not print anything. Add a print() statement to display a result."
else:
    __academy_result__ = "Program finished with no output."
`;

self.onmessage = async (event) => {
  if (event.data?.type !== "run") return;
  const { id, code, stdin = "" } = event.data;
  try {
    self.postMessage({ type: "loading", id });
    const runtime = await getRuntime();
    self.postMessage({ type: "ready", id });

    const needed = await ensurePackages(runtime, code);
    if (needed.length > 0) {
      // Fetching pandas and friends takes several seconds. Say so, or the student
      // watches a blank terminal and assumes it has hung.
      self.postMessage({
        type: "loading-packages",
        id,
        packages: needed,
      });
    }

    const wrapped = runner
      .replace("__ACADEMY_SOURCE__", () => JSON.stringify(code))
      .replace("__ACADEMY_STDIN__", () => JSON.stringify(String(stdin ?? "")));
    await runtime.runPythonAsync(wrapped);
    const result = await runtime.runPython("__academy_result__");
    const output = String(result ?? "");
    self.postMessage({
      type: "result",
      id,
      output: output || "Program finished with no output.",
    });
  } catch (error) {
    const message = String(error?.message || "");
    // Guided from Python's own ModuleNotFoundError rather than from a hand-kept
    // list of standard library modules. Any such guess is wrong the first time
    // someone imports something it forgot, and it would then refuse valid code.
    const guided =
      /ModuleNotFoundError|No module named/i.test(message)
        ? `${message} This practice terminal runs in your browser. It can use the Python standard library, plus numpy, pandas, scikit-learn and matplotlib, which are downloaded the first time you import one.`
        : message;
    self.postMessage({
      type: "error",
      id,
      message:
        guided ||
        "Python execution failed. Check your internet connection and try again.",
    });
  }
};
