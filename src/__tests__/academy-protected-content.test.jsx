import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ProtectedContent from "../components/academy/ProtectedContent";

describe("student instructional content protection", () => {
  it("prevents selecting, copying, cutting, and editing instructional text", () => {
    render(
      <ProtectedContent>
        <p>Read the assignment instructions.</p>
      </ProtectedContent>,
    );

    const text = screen.getByText("Read the assignment instructions.");
    const container = text.parentElement;

    expect(container).toHaveClass("select-none");
    expect(container).toHaveAttribute("contenteditable", "false");

    const copy = fireEvent.copy(text);
    const cut = fireEvent.cut(text);
    const contextMenu = fireEvent.contextMenu(text);

    expect(copy).toBe(false);
    expect(cut).toBe(false);
    expect(contextMenu).toBe(false);
  });

  it("blocks keyboard copy and cut shortcuts", () => {
    render(<ProtectedContent>Question prompt</ProtectedContent>);

    const content = screen.getByText("Question prompt");
    expect(
      fireEvent.keyDown(content, { key: "c", ctrlKey: true }),
    ).toBe(false);
    expect(
      fireEvent.keyDown(content, { key: "x", metaKey: true }),
    ).toBe(false);
  });
});
