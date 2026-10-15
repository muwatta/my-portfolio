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
          latest_submission_status: "graded",
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
      expect(screen.getByText("Marked · Best mark 80/100")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/submit again/i),
    ).toBeInTheDocument();
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
          latest_submission_status: "submitted",
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

  it("shows a pending retake alongside an earlier best mark", async () => {
    getAcademyAssignments.mockResolvedValue({
      data: [
        {
          id: "week-one",
          title: "C++ Week 1",
          points: 25,
          week_number: 1,
          completed_mark: 80,
          attempts_used: 4,
          latest_submission_status: "submitted",
        },
      ],
      error: null,
    });

    render(
      <MemoryRouter>
        <AcademyAssignments />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Best mark 80/100"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/best mark remains saved; your latest submission is awaiting a mark/i),
    ).toBeInTheDocument();
  });

  it("renders only one card when an assignment is duplicated in the returned list", async () => {
    getAcademyAssignments.mockResolvedValue({
      data: [
        {
          id: "week-one",
          title: "C++ Week 1",
          points: 25,
          week_number: 1,
          completed_mark: null,
          attempts_used: 0,
        },
        {
          id: "week-one",
          title: "C++ Week 1",
          points: 25,
          week_number: 1,
          completed_mark: null,
          attempts_used: 0,
        },
      ],
      error: null,
    });

    render(
      <MemoryRouter>
        <AcademyAssignments />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getAllByRole("link", { name: /C\+\+ Week 1/ })).toHaveLength(
        1,
      ),
    );
  });

  it("shows a new attempt as awaiting a mark while retaining the best prior mark", async () => {
    getAcademyAssignments.mockResolvedValue({
      data: [
        {
          id: "week-one",
          title: "C++ Week 1",
          points: 25,
          week_number: 1,
          completed_mark: 80,
          attempts_used: 4,
          latest_submission_status: "submitted",
        },
      ],
      error: null,
    });

    render(
      <MemoryRouter>
        <AcademyAssignments />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Best mark 80/100")).toBeInTheDocument();
    expect(
      screen.getByText(
        /best mark remains saved; your latest submission is awaiting a mark/i,
      ),
    ).toBeInTheDocument();
  });
});
