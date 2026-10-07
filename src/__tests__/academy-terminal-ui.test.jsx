import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CppEditor from "../components/academy/CppEditor";
import PythonEditor from "../components/academy/PythonEditor";
import TerminalEditor from "../components/academy/TerminalEditor";
import { separateTerminalInstructions } from "../lib/academyTerminalContent";

describe("terminal lesson instructions", () => {
  it("separates TODO comments from editable source without changing other lines", () => {
    const source = [
      "# TODO: Print the three required lines, one line at a time.",
      "print('first')",
      "#notes.txt first line",
    ].join("\n");

    expect(separateTerminalInstructions(source)).toEqual({
      code: "print('first')\n#notes.txt first line",
      instructions: ["Print the three required lines, one line at a time."],
    });
  });

  it("shows Python TODO prompts outside the editable source and blocks copying", () => {
    render(
      <PythonEditor
        starterCode={"# TODO: Print the three required lines, one line at a time.\nprint('first')"}
      />,
    );

    const prompt = screen.getByText(
      "Print the three required lines, one line at a time.",
    );
    expect(prompt.closest(".select-none")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Python code editor" })).toHaveValue(
      "print('first')",
    );
    expect(fireEvent.copy(prompt)).toBe(false);
  });

  it("uses a distinct C++ terminal frame and keeps TODO prompts out of source", () => {
    render(
      <CppEditor
        starterCode={"// TODO: Explain the output before running the program.\nint main() {}"}
      />,
    );

    expect(
      screen.getByRole("region", { name: "C++ Practice Terminal" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "C++ code editor" }),
    ).toHaveValue("int main() {}");
    const prompt = screen.getByText(
      "Explain the output before running the program.",
    );
    expect(fireEvent.copy(prompt)).toBe(false);
  });

  it("uses the command-line terminal frame and protects its TODO prompt", () => {
    render(
      <TerminalEditor
        starterScript={"# TODO: List the files and read the notes.\n#notes.txt hello"}
      />,
    );

    expect(
      screen.getByRole("region", {
        name: "Command-line practice terminal",
      }),
    ).toBeInTheDocument();
    const prompt = screen.getByText("List the files and read the notes.");
    expect(prompt.closest(".select-none")).toBeInTheDocument();
    expect(fireEvent.copy(prompt)).toBe(false);
  });
});
