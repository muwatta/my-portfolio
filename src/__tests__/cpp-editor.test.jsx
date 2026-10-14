import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CppEditor from "../components/academy/CppEditor";

class MockWorker {
  static lastMessage;

  constructor() {
    this.onmessage = null;
    this.onerror = null;
  }

  postMessage(message) {
    MockWorker.lastMessage = message;
    this.onmessage?.({
      data: { type: "result", id: message.id, output: "LED state: ON" },
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

  it("passes the supplied standard input to the C++ program", async () => {
    vi.stubGlobal("Worker", MockWorker);
    render(
      <CppEditor
        starterCode={"int distance;\ncin >> distance;\ncout << distance;"}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Program input" }), {
      target: { value: "42" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run program" }));

    await waitFor(() => {
      expect(MockWorker.lastMessage.stdin).toBe("42");
    });
  });

  it("only asks for program input when the source reads from cin", () => {
    vi.stubGlobal("Worker", MockWorker);
    render(
      <CppEditor starterCode={"int distance = 60;\ncout << distance;"} />,
    );

    expect(
      screen.queryByRole("textbox", { name: "Program input" }),
    ).not.toBeInTheDocument();

    cleanup();
    render(<CppEditor starterCode={"int distance;\ncin >> distance;"} />);
    expect(
      screen.getByRole("textbox", { name: "Program input" }),
    ).toBeInTheDocument();
  });
});
