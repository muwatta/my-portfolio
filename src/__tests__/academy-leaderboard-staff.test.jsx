import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AcademyLeaderboard from "../pages/AcademyLeaderboard";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { getAcademyWeeklyLeaderboard } from "../lib/academy";
import { fetchWithOfflineFallback } from "../lib/academyOffline";

vi.mock("../hooks/useAcademyAuth", () => ({ useAcademyAuth: vi.fn() }));
vi.mock("../lib/academy", () => ({
  getAcademyWeeklyLeaderboard: vi.fn(),
  invalidateAcademyCache: vi.fn(),
}));
vi.mock("../lib/academyOffline", () => ({
  fetchWithOfflineFallback: vi.fn(),
}));
vi.mock("../lib/supabase", () => ({ supabase: null }));

const ROWS = [
  { student_id: "s1", display_name: "Ada", points: 900, rank: 1 },
  { student_id: "s2", display_name: "Ben", points: 400, rank: 2 },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <AcademyLeaderboard />
    </MemoryRouter>,
  );
}

describe("an administrator reading the leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAcademyWeeklyLeaderboard.mockResolvedValue(ROWS);
    fetchWithOfflineFallback.mockImplementation(async ({ fetcher }) => ({
      data: await fetcher(),
      error: null,
      offline: false,
      configured: true,
    }));
  });

  it("sees the whole cohort, not just a personal rank", async () => {
    // Staff never appear on the board themselves, so there is no row for them.
    useAcademyAuth.mockReturnValue({
      user: { id: "admin-1" },
      isAdmin: true,
      isTeacher: false,
    });
    renderPage();

    await waitFor(() => expect(screen.getByText("Ada")).toBeInTheDocument());
    expect(screen.getByText("Ben")).toBeInTheDocument();
    expect(screen.getByText("900")).toBeInTheDocument();
    // The personal summary must not appear for someone who is not ranked.
    expect(screen.queryByText(/your rank/i)).not.toBeInTheDocument();
    // Instead they get the size of the list they are looking at.
    expect(screen.getByText(/2 students ranked/i)).toBeInTheDocument();
  });

  it("still marks a student who is on the board as themselves", async () => {
    useAcademyAuth.mockReturnValue({
      user: { id: "s1" },
      isAdmin: false,
      isTeacher: false,
    });
    renderPage();

    await waitFor(() => expect(screen.getByText(/your rank/i)).toBeInTheDocument());
    // Rank and the personal marker are separate nested text nodes.
    expect(
      screen.getByText(
        (_, node) =>
          node?.textContent?.replace(/\s+/g, " ").trim() === "Rank 1 · you",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/students ranked/i)).not.toBeInTheDocument();
  });

  it("gives a teacher the cohort count as well", async () => {
    useAcademyAuth.mockReturnValue({
      user: { id: "teacher-1" },
      isAdmin: false,
      isTeacher: true,
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/2 students ranked/i)).toBeInTheDocument(),
    );
  });

  it("highlights the top finishers with a podium and point progress", async () => {
    useAcademyAuth.mockReturnValue({
      user: { id: "admin-1" },
      isAdmin: true,
      isTeacher: false,
    });
    getAcademyWeeklyLeaderboard.mockResolvedValue([
      ...ROWS,
      { student_id: "s3", display_name: "Cy", points: 250, rank: 3 },
      { student_id: "s4", display_name: "Dee", points: 120, rank: 4 },
    ]);
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /top explorers/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: /top three students this week/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Weekly rankings")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /ada points/i })).toHaveAttribute(
      "aria-valuenow",
      "900",
    );
    expect(screen.getByText(/dee/i)).toBeInTheDocument();
  });

  it("links students from the empty state to lessons and practice", async () => {
    getAcademyWeeklyLeaderboard.mockResolvedValue([]);
    useAcademyAuth.mockReturnValue({
      user: { id: "s-new" },
      isAdmin: false,
      isTeacher: false,
    });
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /your first win is waiting/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to lessons/i })).toHaveAttribute(
      "href",
      "/academy/lessons",
    );
    expect(screen.getByRole("link", { name: /start practice/i })).toHaveAttribute(
      "href",
      "/academy/practice",
    );
  });

  it("does not claim a cohort size before the rows arrive", async () => {
    getAcademyWeeklyLeaderboard.mockResolvedValue([]);
    fetchWithOfflineFallback.mockImplementation(async ({ fetcher }) => ({
      data: await fetcher(),
      error: null,
      offline: false,
      configured: true,
    }));
    useAcademyAuth.mockReturnValue({
      user: { id: "admin-1" },
      isAdmin: true,
      isTeacher: false,
    });
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/no verified activity yet/i)).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: /no student points yet/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /go to lessons/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /start practice/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/students ranked/i)).not.toBeInTheDocument();
  });
});