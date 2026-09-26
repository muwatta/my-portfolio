import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AcademyConnectionState from "../components/academy/AcademyConnectionState";

describe("AcademyConnectionState", () => {
  it("shows a skeleton instead of a blank area while loading", () => {
    const { container } = render(<AcademyConnectionState loading />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status.textContent).toContain("Loading your content");
    expect(container.querySelectorAll('[aria-hidden="true"]').length)
      .toBeGreaterThan(0);
  });

  it("explains an offline state and offers a way to retry", () => {
    const onRetry = vi.fn();
    render(<AcademyConnectionState online={false} onRetry={onRetry} />);

    expect(screen.getByText("You're offline")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reconnect/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps the user engaged with a challenge instead of an empty page", () => {
    render(<AcademyConnectionState online={false} />);

    expect(screen.getByText("While you wait")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show the answer/i })).toBeInTheDocument();
  });

  it("reveals the answer on request", () => {
    render(<AcademyConnectionState online={false} />);
    fireEvent.click(screen.getByRole("button", { name: /show the answer/i }));
    expect(
      screen.queryByRole("button", { name: /show the answer/i }),
    ).toBeNull();
  });

  it("distinguishes a slow connection from being offline", () => {
    render(<AcademyConnectionState online slow />);
    expect(screen.getByText("Connection is slow")).toBeInTheDocument();
  });

  it("lets a page supply its own copy", () => {
    render(
      <AcademyConnectionState
        online={false}
        title="Practice is not downloaded"
        description="Reconnect once to download practice exercises."
        showChallenge={false}
      />,
    );
    expect(screen.getByText("Practice is not downloaded")).toBeInTheDocument();
    expect(
      screen.getByText("Reconnect once to download practice exercises."),
    ).toBeInTheDocument();
    expect(screen.queryByText("While you wait")).toBeNull();
  });
});
