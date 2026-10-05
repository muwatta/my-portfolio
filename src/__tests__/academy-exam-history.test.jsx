import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const api = vi.hoisted(() => ({
  getAcademyAvailableExams: vi.fn(),
  getAcademyExamHistory: vi.fn(),
  getAcademyExamLiveAttempt: vi.fn(),
  getAcademyExamEvents: vi.fn(),
}));

vi.mock("../lib/academy", () => api);

import AcademyExams from "../pages/AcademyExams";

const HISTORY = [
  {
    attempt_id: "attempt-1",
    exam_id: "exam-1",
    exam_title: "Object Oriented Programming",
    attempt_number: 1,
    started_at: "2026-01-01T10:00:00.000Z",
    submitted_at: "2026-01-01T10:30:00.000Z",
    submit_reason: "student",
    status: "graded",
    results_published: true,
    score: 8,
    total_marks: 10,
    percentage: 80,
    correct_count: 8,
    incorrect_count: 1,
    unanswered_count: 1,
    pass_mark: 50,
  },
  {
    attempt_id: "attempt-2",
    exam_id: "exam-2",
    exam_title: "Robotics",
    attempt_number: 2,
    started_at: "2026-01-08T10:00:00.000Z",
    submitted_at: "2026-01-08T10:20:00.000Z",
    submit_reason: "timeout",
    status: "graded",
    results_published: false,
    score: null,
    total_marks: null,
    percentage: null,
    correct_count: null,
    incorrect_count: null,
    unanswered_count: null,
    pass_mark: 60,
  },
];

describe("student exam history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAcademyAvailableExams.mockResolvedValue({ data: [], error: null });
    api.getAcademyExamHistory.mockResolvedValue({ data: HISTORY, error: null });
    api.getAcademyExamLiveAttempt.mockResolvedValue({ data: null, error: null });
    api.getAcademyExamEvents.mockResolvedValue({ data: [], error: null });
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <AcademyExams />
      </MemoryRouter>,
    );
  }

  it("shows a released score a student can come back to", async () => {
    renderPage();
    expect(await screen.findByText("80%")).toBeInTheDocument();
    expect(screen.getByText("8 of 10 marks")).toBeInTheDocument();
    expect(
      screen.getByText(/8 correct, 1 wrong, 1 left blank/i),
    ).toBeInTheDocument();
  });

  it("shows the pass mark so a score can be read against it", async () => {
    renderPage();
    expect(await screen.findByText(/pass mark 50%/i)).toBeInTheDocument();
  });

  it("says a result is marked but not released, without showing numbers", async () => {
    renderPage();
    expect(
      await screen.findByText(/has not released this result yet/i),
    ).toBeInTheDocument();
    // The unreleased row must not carry a score even though the function
    // returns the columns, which is what makes this worth asserting.
    const row = screen.getByText("Robotics").closest("li");
    expect(row.textContent).not.toContain("%");
    expect(row.textContent).not.toContain("marks");
  });

  it("records how an attempt finished", async () => {
    renderPage();
    expect(await screen.findByText(/time expired/i)).toBeInTheDocument();
  });

  it("hides the history section entirely when there is no history", async () => {
    api.getAcademyExamHistory.mockResolvedValue({ data: [], error: null });
    renderPage();
    expect(await screen.findByText(/no tests have been set/i)).toBeInTheDocument();
    expect(screen.queryByText("Your attempts")).toBeNull();
  });

  it("does not break the list when the history call fails", async () => {
    api.getAcademyExamHistory.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    renderPage();
    // The paper list is the primary job; history failing must not blank it.
    expect(
      await screen.findByText(/no tests have been set/i),
    ).toBeInTheDocument();
  });
});

describe("history and event functions", () => {
  const migration = readFileSync(
    "supabase/migrations/20261299000000_exam_history_and_events.sql",
    "utf8",
  );

  it("never returns a score for an unreleased exam", () => {
    // The publication check has to live in the function, because a client that
    // was merely trusted to hide the numbers would be one bad query away from
    // leaking every score in the cohort.
    expect(migration).toMatch(
      /case when e\.results_published then a\.score end/,
    );
    expect(migration).toMatch(
      /case when e\.results_published then a\.percentage end/,
    );
    expect(migration).toMatch(
      /case when e\.results_published then a\.correct_count end/,
    );
  });

  it("scopes history to the caller's own attempts", () => {
    expect(migration).toMatch(/where a\.student_id = auth\.uid\(\)/);
  });

  it("gates the event log on staff and caps how much it returns", () => {
    expect(migration).toMatch(/and public\.academy_is_teacher\(\)/);
    expect(migration).toMatch(/limit greatest\(1, least\(coalesce\(p_limit, 100\), 500\)\)/);
  });

  it("revokes both from anon so neither is a public endpoint", () => {
    expect(migration).toMatch(
      /revoke execute on function public\.academy_exam_student_history\(\) from public, anon/,
    );
    expect(migration).toMatch(
      /revoke execute on function public\.academy_exam_event_log\(uuid, integer\) from public, anon/,
    );
  });

  it("labels only actions the engine actually writes", () => {
    const page = readFileSync("src/pages/AcademyAdminExamResults.jsx", "utf8");
    for (const action of [
      "exam_started",
      "exam_submitted",
      "exam_auto_submitted",
      "results_published",
      "results_unpublished",
    ]) {
      expect(page).toMatch(new RegExp(`${action}:`));
    }
  });
});

describe("the builder hands off to the mark sheet", () => {
  it("links to the results page for the exam just published", () => {
    const builder = readFileSync("src/pages/AcademyAdminExamBuilder.jsx", "utf8");
    expect(builder).toMatch(/\/academy\/admin\/exam-results\?exam=\$\{selectedId\}/);
  });

  it("and the results page reads that parameter", () => {
    const resultPage = readFileSync("src/pages/AcademyAdminExamResults.jsx", "utf8");
    expect(resultPage).toMatch(/searchParams\.get\("exam"\)/);
  });
});
