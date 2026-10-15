import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAcademyNotifications = vi.fn();
const markAcademyNotificationRead = vi.fn();
const fetchWithOfflineFallback = vi.fn();

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => ({ user: { id: "admin-1" } }),
}));

vi.mock("../lib/academy", () => ({
  getAcademyNotifications: (...args) => getAcademyNotifications(...args),
  markAcademyNotificationRead: (...args) =>
    markAcademyNotificationRead(...args),
}));

vi.mock("../lib/academyOffline", () => ({
  fetchWithOfflineFallback: (...args) => fetchWithOfflineFallback(...args),
}));

vi.mock("../lib/academySync", () => ({
  enqueueAcademyOperation: vi.fn(),
}));

import AcademyNotifications from "../pages/AcademyNotifications";

describe("superadmin notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAcademyNotifications.mockResolvedValue({
      data: [
        {
          id: "notice-1",
          type: "registration",
          title: "New student registration",
          message: "A new student is waiting for registration review.",
          read_at: null,
          created_at: "2026-10-15T08:00:00.000Z",
        },
      ],
      error: null,
      configured: true,
    });
    fetchWithOfflineFallback.mockImplementation(async ({ fetcher }) => ({
      ...(await fetcher()),
      offline: false,
    }));
    markAcademyNotificationRead.mockResolvedValue({ error: null });
  });

  it("shows unread status, registration action, and marks an item read", async () => {
    render(
      <MemoryRouter>
        <AcademyNotifications />
      </MemoryRouter>,
    );

    expect(await screen.findByText("1 unread update")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Review registrations" }),
    ).toHaveAttribute("href", "/academy/admin/registrations");
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));

    await waitFor(() =>
      expect(screen.getByText("You are up to date.")).toBeInTheDocument(),
    );
    expect(markAcademyNotificationRead).toHaveBeenCalledWith(
      "notice-1",
      "admin-1",
    );
  });

  it("shows a readable error when marking a notification as read fails", async () => {
    markAcademyNotificationRead.mockResolvedValue({
      error: { message: "Permission denied" },
    });
    render(
      <MemoryRouter>
        <AcademyNotifications />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Mark read" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Permission denied",
    );
  });
});
