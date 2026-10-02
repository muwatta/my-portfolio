import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PasswordPolicyNotice from "../components/academy/PasswordPolicyNotice";
import { getAcademyNotifications } from "../lib/academy";

vi.mock("../lib/academy", () => ({
  getAcademyNotifications: vi.fn(),
}));

const NOTICE = {
  id: "n1",
  type: "password_policy_update",
  title: "Please choose a stronger password",
  message: "Academy now asks for stronger passwords.",
};

describe("PasswordPolicyNotice", () => {
  beforeEach(() => {
    window.localStorage.clear();
    getAcademyNotifications.mockReset();
  });

  it("stays hidden when the student has no pending notice", async () => {
    getAcademyNotifications.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <PasswordPolicyNotice userId="u1" />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(getAcademyNotifications).toHaveBeenCalledWith("u1"),
    );
    expect(
      screen.queryByText("Strengthen your password"),
    ).not.toBeInTheDocument();
  });

  it("invites an update without implying access is at risk", async () => {
    getAcademyNotifications.mockResolvedValue([NOTICE]);
    render(
      <MemoryRouter>
        <PasswordPolicyNotice userId="u1" />
      </MemoryRouter>,
    );
    const heading = await screen.findByText("Strengthen your password");
    expect(heading).toBeInTheDocument();
    // The requirement was that a student who ignores this keeps working, so the
    // copy must say so rather than implying a lockout.
    expect(
      screen.getByText(/optional and you keep full access/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /update my password/i }),
    ).toHaveAttribute("href", "/academy/forgot-password");
  });

  it("ignores unrelated notifications", async () => {
    getAcademyNotifications.mockResolvedValue([
      { id: "n2", type: "announcement", title: "Class moved" },
    ]);
    render(
      <MemoryRouter>
        <PasswordPolicyNotice userId="u1" />
      </MemoryRouter>,
    );
    await waitFor(() => expect(getAcademyNotifications).toHaveBeenCalled());
    expect(
      screen.queryByText("Strengthen your password"),
    ).not.toBeInTheDocument();
  });

  it("never blocks the dashboard when the lookup fails", async () => {
    getAcademyNotifications.mockRejectedValue(new Error("offline"));
    render(
      <MemoryRouter>
        <PasswordPolicyNotice userId="u1" />
      </MemoryRouter>,
    );
    await waitFor(() => expect(getAcademyNotifications).toHaveBeenCalled());
    expect(
      screen.queryByText("Strengthen your password"),
    ).not.toBeInTheDocument();
  });

  it("stays dismissed after reloading", async () => {
    getAcademyNotifications.mockResolvedValue([NOTICE]);
    const first = render(
      <MemoryRouter>
        <PasswordPolicyNotice userId="u1" />
      </MemoryRouter>,
    );
    await screen.findByText("Strengthen your password");
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(
      screen.queryByText("Strengthen your password"),
    ).not.toBeInTheDocument();

    first.unmount();
    getAcademyNotifications.mockClear();
    render(
      <MemoryRouter>
        <PasswordPolicyNotice userId="u1" />
      </MemoryRouter>,
    );
    // The stored flag is read during the initial state, so the banner must not
    // come back and the lookup must not even be attempted.
    await waitFor(() =>
      expect(screen.queryByText("Strengthen your password")).not.toBeInTheDocument(),
    );
    expect(getAcademyNotifications).not.toHaveBeenCalled();
  });
});