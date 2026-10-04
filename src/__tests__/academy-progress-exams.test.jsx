import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const authState = vi.hoisted(() => ({
  current: { user: { id: "student-1" } },
}));

const api = vi.hoisted(() => ({
  getAcademyProgress: vi.fn(),
  getAcademyStudentOverview: vi.fn(),
  getAcademyExamHistory: vi.fn(),
}));

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => authState.current,
}));

vi.mock("../lib/academy", () => api);

vi.mock("../lib/academyOffline", () => ({
  fetchWithOfflineFallback: ({ fetcher }) =>
    fetcher().then((result) => ({ ...result, offline: false })),
}));

import AcademyProgress from "../pages/AcademyProgress";

const HISTORY = [
  {
    attempt_id: "a1",
    exam_title: "Object Oriented Programming",
    status: "graded",
    results_published: true,
    score: 8,
    total_marks: 10,
    percentage: 80,
  },
  {
    attempt_id: "a2",
    exam_title: "Robotics",
    status: "graded",
    results_published: true,
    score: 4,
    total_marks: 10,
    percentage: 40,
  },
  {
    attempt_id: "a3",
    exam_title: "Databases",
    status: "graded",
    results_published: false,
    score: null,
    total_marks: null,
    percentage: null,
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <AcademyProgress />
    </MemoryRouter>,
  );
}

describe("examinations on the progress page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.current = { user: { id: "student-1" } };
    api.getAcademyProgress.mockResolvedValue({
      data: {
        completionPercent: 50,
        completedLessons: 5,
        lessonCount: 10,
        submissions: 3,
        currentWeek: 4,
      },
      error: null,
      configured: true,
    });
    api.getAcademyStudentOverview.mockResolvedValue({ data: {} });
    api.getAcademyExamHistory.mockResolvedValue({ data: HISTORY, error: null });
  });

  it("counts the papers a student has sat", async () => {
    renderPage();
    // Three attempts, one still in nothing, so all three are sat.
    expect(await screen.findByText("Papers sat")).toBeInTheDocument();
    const sat = screen.getByText("Papers sat").parentElement;
    expect(sat.textContent).toContain("3");
  });

  it("renders the course checkpoint without crashing", async () => {
    renderPage();
    expect(await screen.findByText("Course checkpoint")).toBeInTheDocument();
  });

  it("counts only released results", async () => {
    renderPage();
    const released = await screen.findByText("Results released");
    expect(released.parentElement.textContent).toContain("2");
  });

  it("averages released results only", async () => {
    renderPage();
    // (80 + 40) / 2. The unreleased attempt is not counted as a zero, which
    // would drag the figure to 40%.
    expect(await screen.findByText("60.0%")).toBeInTheDocument();
  });

  it("lists a released score", async () => {
    renderPage();
    expect(await screen.findByText("80% (8/10)")).toBeInTheDocument();
  });

  it("shows an unreleased attempt as sat with no number beside it", async () => {
    renderPage();
    expect(
      await screen.findByText(/marked, result not released/i),
    ).toBeInTheDocument();
    // The server sent null for the score, so there is nothing to show and the
    // page must not invent one.
    const row = screen.getByText("Databases").closest("li");
    expect(row.textContent).not.toContain("%");
  });

  it("says nothing at all when no exam has been sat", async () => {
    api.getAcademyExamHistory.mockResolvedValue({ data: [], error: null });
    renderPage();
    await waitFor(() => expect(api.getAcademyExamHistory).toHaveBeenCalled());
    expect(screen.queryByText("Examinations")).toBeNull();
  });

  it("still renders progress when the exam history call fails", async () => {
    api.getAcademyExamHistory.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    renderPage();
    // Progress is the primary job of this page; an exam outage must not blank it.
    expect(await screen.findByText("Lessons completed")).toBeInTheDocument();
    expect(screen.queryByText("Examinations")).toBeNull();
  });
});

describe("the leaderboard award", () => {
  const award = readFileSync(
    "supabase/migrations/20261304000000_exam_leaderboard_fix.sql",
    "utf8",
  );
  const widening = readFileSync(
    "supabase/migrations/20261303000000_exam_progress_and_leaderboard.sql",
    "utf8",
  );

  it("admits the exam as a source of points", () => {
    // The original check had no 'exam' value, so an exam award was rejected by
    // the table itself.
    expect(widening).toMatch(
      /check \(source_type in \('assignment', 'quiz', 'practice', 'project', 'lesson', 'exam'\)\)/,
    );
  });

  it("reads the period as a row, not as a uuid", () => {
    // The first version passed academy_ensure_active_week_period() straight into
    // period_id. That function returns the whole row, so it failed at runtime
    // and stopped a teacher releasing marks.
    expect(award).toMatch(
      /select \(public\.academy_ensure_active_week_period\(\)\)\.id into v_period_id/,
    );
  });

  it("counts only a student's best attempt, so the board cannot be farmed", () => {
    expect(award).toMatch(/select distinct on \(a\.student_id\)/);
    expect(award).toMatch(/order by a\.student_id, a\.percentage desc/);
  });

  it("skips attempts that were never graded rather than scoring them zero", () => {
    expect(award).toMatch(/a\.percentage is not null/);
    expect(award).toMatch(/a\.status <> 'in_progress'/);
  });

  it("takes the points off again when results are withheld", () => {
    expect(award).toMatch(
      /delete from public\.academy_leaderboard_points\s+where source_type = 'exam' and source_id = p_exam_id/,
    );
  });

  it("never lets a leaderboard fault stop marks being released", () => {
    expect(award).toMatch(
      /begin\s+perform public\.academy_exam_sync_leaderboard\(p_exam_id\);\s+exception when others then/,
    );
    expect(award).toMatch(/leaderboard_sync_failed/);
  });
});
