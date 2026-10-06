import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadWorker() {
  vi.resetModules();
  const importScripts = vi.fn();
  const loadPyodide = vi.fn();
  globalThis.importScripts = importScripts;
  globalThis.loadPyodide = loadPyodide;
  await import("../workers/pythonWorker.js");
  const messages = [];
  globalThis.self.postMessage = (message) => messages.push(message);
  const loadPackage = vi.fn().mockResolvedValue(undefined);
  loadPyodide.mockResolvedValue({
    runPythonAsync: vi.fn().mockResolvedValue(undefined),
    runPython: vi.fn().mockResolvedValue("done"),
    loadPackage,
  });
  return { worker: globalThis.self, loadPyodide, loadPackage, messages };
}

let savedImportScripts;
let savedLoadPyodide;

beforeEach(() => {
  savedImportScripts = globalThis.importScripts;
  savedLoadPyodide = globalThis.loadPyodide;
});

afterEach(() => {
  if (savedImportScripts === undefined) delete globalThis.importScripts;
  else globalThis.importScripts = savedImportScripts;
  if (savedLoadPyodide === undefined) delete globalThis.loadPyodide;
  else globalThis.loadPyodide = savedLoadPyodide;
  vi.restoreAllMocks();
});

describe("python practice worker package loading", () => {
  it("does not fetch any package for a first-lesson program", async () => {
    // Week 1 is print. Loading pandas here would make the opening lesson of the
    // course pay a multi-megabyte download.
    const { worker, loadPyodide, loadPackage } = await loadWorker();
    await worker.onmessage({ data: { type: "run", id: "a", code: "print('hi')" } });

    expect(loadPyodide).toHaveBeenCalledTimes(1);
    // Still no packages argument on the runtime itself.
    expect(loadPyodide.mock.calls[0][0].packages).toBeUndefined();
    expect(loadPackage).not.toHaveBeenCalled();
  });

  it("still runs standard library programs", async () => {
    const { worker, messages } = await loadWorker();
    await worker.onmessage({
      data: { type: "run", id: "b", code: "import math\nprint(math.sqrt(9))" },
    });
    expect(messages.map((m) => m.type)).toEqual(["loading", "ready", "result"]);
  });

  it("fetches pandas on first use and tells the student it is happening", async () => {
    const { worker, loadPackage, messages } = await loadWorker();
    await worker.onmessage({
      data: { type: "run", id: "c", code: "import pandas as pd\nprint(pd)" },
    });

    expect(loadPackage).toHaveBeenCalledWith("pandas");
    const notice = messages.find((m) => m.type === "loading-packages");
    expect(notice).toBeDefined();
    expect(notice.packages).toEqual(["pandas"]);
  });

  it("recognises numpy, scikit-learn and matplotlib too", async () => {
    for (const [module, pkg] of [
      ["import numpy as np", "numpy"],
      ["from sklearn.linear_model import LinearRegression", "scikit-learn"],
      ["import matplotlib.pyplot as plt", "matplotlib"],
    ]) {
      const { worker, loadPackage } = await loadWorker();
      await worker.onmessage({ data: { type: "run", id: module, code: module } });
      expect(loadPackage).toHaveBeenCalledWith(pkg);
    }
  });

  it("downloads once and reuses the package for later runs", async () => {
    const { worker, loadPackage } = await loadWorker();
    const code = "import pandas as pd\nprint(1)";
    await worker.onmessage({ data: { type: "run", id: "d1", code } });
    await worker.onmessage({ data: { type: "run", id: "d2", code } });
    expect(loadPackage).toHaveBeenCalledTimes(1);
  });

  it("guides a missing module from Python's own error", async () => {
    // Python decides what it ships. The worker only adds advice to the error
    // Python raises, so a valid standard-library import is never refused.
    const { worker, loadPyodide, messages } = await loadWorker();
    loadPyodide.mockResolvedValue({
      runPythonAsync: vi.fn().mockRejectedValue(
        new Error("ModuleNotFoundError: No module named 'requests'"),
      ),
      runPython: vi.fn(),
      loadPackage: vi.fn().mockResolvedValue(undefined),
    });
    await worker.onmessage({
      data: { type: "run", id: "e", code: "import requests\nprint(1)" },
    });
    const error = messages.find((m) => m.type === "error");
    expect(error.message).toMatch(/No module named 'requests'/);
    expect(error.message).toMatch(/numpy, pandas, scikit-learn and matplotlib/);
  });

  it("does not pre-judge imports, so any standard library module runs", async () => {
    // The earlier implementation kept a hand-written allowlist and rejected
    // `math` and `os` because they were missing from it. Python is the authority.
    const { worker, messages } = await loadWorker();
    for (const code of ["import math", "import os", "import json", "import random"]) {
      await worker.onmessage({ data: { type: "run", id: code, code } });
    }
    expect(messages.filter((m) => m.type === "error")).toHaveLength(0);
    expect(messages.filter((m) => m.type === "result")).toHaveLength(4);
  });

  it("resolves sklearn and the plotting alias to the package it lives in", async () => {
    const { worker, loadPackage } = await loadWorker();
    await worker.onmessage({
      data: { type: "run", id: "g", code: "import pyplot as plt\nfrom sklearn.svm import SVC" },
    });
    expect(loadPackage).toHaveBeenCalledWith("matplotlib");
    expect(loadPackage).toHaveBeenCalledWith("scikit-learn");
  });
});