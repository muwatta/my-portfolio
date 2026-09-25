import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PYODIDE_VERSION = "v0.27.2";

async function loadWorker() {
  vi.resetModules();
  const importScripts = vi.fn();
  const loadPyodide = vi.fn();
  globalThis.importScripts = importScripts;
  globalThis.loadPyodide = loadPyodide;
  await import("../workers/pythonWorker.js");
  return { worker: globalThis.self, importScripts, loadPyodide };
}

describe("python practice worker", () => {
  let messages;
  let originalImportScripts;
  let originalLoadPyodide;

  beforeEach(() => {
    messages = [];
    originalImportScripts = globalThis.importScripts;
    originalLoadPyodide = globalThis.loadPyodide;
    globalThis.self.postMessage = vi.fn((message) => messages.push(message));
  });

  afterEach(() => {
    if (originalImportScripts === undefined) delete globalThis.importScripts;
    else globalThis.importScripts = originalImportScripts;
    if (originalLoadPyodide === undefined) delete globalThis.loadPyodide;
    else globalThis.loadPyodide = originalLoadPyodide;
    vi.restoreAllMocks();
  });

  it("pins the Pyodide version and reports loading before execution", async () => {
    const runPythonAsync = vi.fn().mockResolvedValue(undefined);
    const runPython = vi.fn().mockResolvedValue("hello from python");
    const { worker, importScripts, loadPyodide } = await loadWorker();
    loadPyodide.mockResolvedValue({ runPythonAsync, runPython });

    await worker.onmessage({ data: { type: "run", id: "job-1", code: "print('hi')" } });

    const scriptUrl = importScripts.mock.calls[0][0];
    expect(scriptUrl).toContain(`/pyodide/${PYODIDE_VERSION}/`);
    expect(loadPyodide).toHaveBeenCalledWith({
      indexURL: `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`,
    });
    expect(messages.map((message) => message.type)).toEqual([
      "loading",
      "ready",
      "result",
    ]);
    const result = messages.find((message) => message.type === "result");
    expect(result.output).toBe("hello from python");
  });

  it("passes student code to the runtime and reads the captured result", async () => {
    const runPythonAsync = vi.fn().mockResolvedValue(undefined);
    const runPython = vi.fn().mockResolvedValue("42");
    const { worker, loadPyodide } = await loadWorker();
    loadPyodide.mockResolvedValue({ runPythonAsync, runPython });

    await worker.onmessage({
      data: { type: "run", id: "job-2", code: 'print("total", 6 * 7)' },
    });

    const submitted = runPythonAsync.mock.calls[0][0];
    expect(submitted).toContain('print(\\"total\\", 6 * 7)');
    expect(submitted).toContain("__academy_result__");
    expect(runPython).toHaveBeenCalledWith("__academy_result__");
  });

  it("returns a readable message and allows a retry when the runtime fails", async () => {
    const runPythonAsync = vi.fn().mockResolvedValue(undefined);
    const runPython = vi.fn().mockResolvedValue("recovered");
    const { worker, loadPyodide } = await loadWorker();
    loadPyodide.mockRejectedValueOnce(new Error("network down"));
    loadPyodide.mockResolvedValue({ runPythonAsync, runPython });

    await worker.onmessage({ data: { type: "run", id: "job-3", code: "print(1)" } });
    const failure = messages.find((message) => message.type === "error");
    expect(failure.message).toBe("network down");

    messages = [];
    await worker.onmessage({ data: { type: "run", id: "job-4", code: "print(1)" } });
    expect(messages.find((message) => message.type === "result").output).toBe(
      "recovered",
    );
  });

  it("explains when the browser cannot start the terminal", async () => {
    delete globalThis.importScripts;
    vi.resetModules();
    await import("../workers/pythonWorker.js");

    await globalThis.self.onmessage({
      data: { type: "run", id: "job-5", code: "print(1)" },
    });

    const failure = messages.find((message) => message.type === "error");
    expect(failure.message).toMatch(/cannot start the Python practice terminal/i);
  });
});
