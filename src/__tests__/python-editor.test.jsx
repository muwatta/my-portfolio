import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PythonEditor from "../components/academy/PythonEditor";

class MockWorker {
  static lastMessage;

  constructor() {
    this.onmessage = null;
    this.onerror = null;
  }

  postMessage(message) {
    MockWorker.lastMessage = message;
    this.onmessage?.({
      data: { type: "result", id: message.id, output: "12" },
    });
  }

  terminate() {}
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Python practice terminal input", () => {
  it("sends entered input lines to the Python worker", async () => {
    vi.stubGlobal("Worker", MockWorker);
    render(
      <PythonEditor starterCode={"temperature = int(input())\nprint(temperature)"} />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Program input" }), {
      target: { value: "12\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Python" }));

    await waitFor(() => {
      expect(MockWorker.lastMessage).toMatchObject({
        code: "temperature = int(input())\nprint(temperature)",
        stdin: "12\n",
      });
      expect(screen.getByRole("status")).toHaveTextContent("12");
    });
  });
});
