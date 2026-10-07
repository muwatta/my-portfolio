import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CppEditor from "../components/academy/CppEditor";

class MockWorker {
  constructor() {
    this.onmessage = null;
    this.onerror = null;
  }

  postMessage({ id }) {
    this.onmessage?.({
      data: { type: "result", id, output: "LED state: ON" },
    });
  }

  terminate() {}
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("C++ practice terminal", () => {
  it("runs the lesson starter code and displays its output in the lesson", async () => {
    vi.stubGlobal("Worker", MockWorker);
    render(<CppEditor starterCode={'cout << "LED state: ON";'} />);

    expect(screen.getByText("C++ Practice Terminal")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "C++ code editor" })).toHaveValue(
      'cout << "LED state: ON";',
    );

    fireEvent.click(screen.getByRole("button", { name: "Run program" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("LED state: ON");
    });
  });
});
