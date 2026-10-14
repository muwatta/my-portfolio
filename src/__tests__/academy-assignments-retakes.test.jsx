import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => ({ user: { id: "student-1" } }),
}));
vi.mock("../hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => ({ online: true, slow: false }),
}));
vi.mock("../lib/academy", () => ({
  getAcademyAssignments: vi.fn(),
}));
vi.mock("../lib/academyOffline", () => ({
  fetchWithOfflineFallback: vi.fn(),
}));
vi.mock("../lib/offlineStore", () => ({
  OFFLINE_STORES: { assignments: "assignments" },
}));
vi.mock("../components/academy/AcademyConnectionState", () => ({
  default: () => <div data-testid="connection-state" />,
}));

const { getAcademyAssignments } = await import("../lib/academy");
const { fetchWithOfflineFallback } = await import("../lib/academyOffline");
const AcademyAssignments = (await import("../pages/AcademyAssignments.jsx"))
  .default;

describe("weekly assignment retakes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAcademyAssignments.mockResolvedValue({ data: [], error: null });
    fetchWithOfflineFallback.mockImplementation(async ({ fetcher }) => ({
      ...(await fetcher()),
      offline: false,
      configured: true,
    }));
  });

  it("keeps marked previous weeks visible with their best mark and retake link", async () => {
    getAcademyAssignments.mockResolvedValue({
      data: [
        {
          id: "week-one",
          title: "C++ Week 1",
          points: 25,
          week_number: 1,
          completed_mark: 80,
          attempts_used: 2,
          retry_limit: 3,
        },
        {
          id: "week-two",
          title: "C++ Week 2",
          points: 25,
          week_number: 2,
          locked: true,
          completed_mark: null,
          attempts_used: 0,
          retry_limit: 3,
        },
      ],
      error: null,
    });

    render(
      <MemoryRouter>
        <AcademyAssignments />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Done · Best mark 80/100")).toBeInTheDocument();
    });
    expect(screen.getByText(/use another attempt/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /C\+\+ Week 1/ }),
    ).toHaveAttribute("href", "/academy/assignments/week-one");
    expect(
      screen.getByText("Waiting for the previous week to be marked"),
    ).toBeInTheDocument();
  });

  it("shows a pending submission as waiting for a mark, not done", async () => {
    getAcademyAssignments.mockResolvedValue({
      data: [
        {
          id: "week-one",
          title: "C++ Week 1",
          points: 25,
          week_number: 1,
          completed_mark: null,
          attempts_used: 1,
          retry_limit: 3,
        },
      ],
      error: null,
    });

    render(
      <MemoryRouter>
        <AcademyAssignments />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Submitted · waiting for your mark")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Done · Best mark/)).not.toBeInTheDocument();
  });
});
