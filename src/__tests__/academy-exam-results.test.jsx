import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const api = vi.hoisted(() => ({
  getAcademyExams: vi.fn(),
  getAcademyExamAttempts: vi.fn(),
  getAcademyExamAttemptAnswers: vi.fn(),
  publishAcademyExamResults: vi.fn(),
}));

vi.mock("../lib/academy", () => api);

import AcademyAdminExamResults from "../pages/AcademyAdminExamResults";

const STUDENT = { user: { id: "teacher-1" } };
vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => STUDENT,
}));

const EXAM = {
  id: "exam-1",
  title: "Object Oriented Programming",
  status: "graded",
  pass_mark: 50,
  results_published: false,
  ends_at: new Date(Date.now() - 86400000).toISOString(),
};

const ATTEMPTS = [
  {
    id: "attempt-1",
    student_id: "s1",
    student_name: "Ada Bello",
    attempt_number: 1,
    status: "graded",
    score: 8,
    total_marks: 10,
    correct_count: 8,
    incorrect_count: 1,
    unanswered_count: 1,
    percentage: 80,
    submitted_at: "2026-01-01T10:30:00.000Z",
    client_submitted_at: "2026-01-01T10:30:05.000Z",
    submit_reason: "student",
  },
  {
    id: "attempt-2",
    student_id: "s2",
    student_name: "Bola Adeyemi",
    attempt_number: 1,
    status: "graded",
    score: 4,
    total_marks: 10,
    correct_count: 4,
    incorrect_count: 5,
    unanswered_count: 1,
    percentage: 40,
    submitted_at: "2026-01-01T11:00:00.000Z",
    client_submitted_at: "2026-01-01T14:20:00.000Z",
    submit_reason: "timeout",
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <AcademyAdminExamResults />
    </MemoryRouter>,
  );
}

describe("AcademyAdminExamResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAcademyExams.mockResolvedValue({ data: [EXAM], error: null });
    api.getAcademyExamAttempts.mockResolvedValue({ data: ATTEMPTS, error: null });
    api.getAcademyExamAttemptAnswers.mockResolvedValue({ data: [], error: null });
    api.publishAcademyExamResults.mockResolvedValue({ data: true, error: null });
  });

  it("lists each attempt with the score the server worked out", async () => {
    renderPage();
    expect(await screen.findByText("Ada Bello")).toBeInTheDocument();
    expect(screen.getByText("Bola Adeyemi")).toBeInTheDocument();
    expect(screen.getByText("80% (8/10)")).toBeInTheDocument();
    expect(screen.getByText("40% (4/10)")).toBeInTheDocument();
  });

  it("summarises the class without re-grading anything", async () => {
    renderPage();
    expect(await screen.findByText("Ada Bello")).toBeInTheDocument();
    // (80 + 40) / 2
    expect(screen.getByText("60.0%")).toBeInTheDocument();
    expect(screen.getByText("2 finished")).toBeInTheDocument();
  });

  it("releases results to students on request", async () => {
    renderPage();
    // Wait for the attempt data, not just the button: the control stays disabled
    // until there is something to release.
    expect(await screen.findByText("Ada Bello")).toBeInTheDocument();
    const release = screen.getByRole("button", { name: /release results/i });
    expect(release).not.toBeDisabled();
    fireEvent.click(release);
    await waitFor(() =>
      expect(api.publishAcademyExamResults).toHaveBeenCalledWith("exam-1", true),
    );
    expect(
      await screen.findByText(/results released/i),
    ).toBeInTheDocument();
  });

  it("can withhold results again after publishing", async () => {
    api.getAcademyExams.mockResolvedValue({
      data: [{ ...EXAM, results_published: true }],
      error: null,
    });
    renderPage();
    expect(await screen.findByText("Ada Bello")).toBeInTheDocument();
    const withhold = screen.getByRole("button", { name: /withhold results/i });
    fireEvent.click(withhold);
    await waitFor(() =>
      expect(api.publishAcademyExamResults).toHaveBeenCalledWith("exam-1", false),
    );
  });

  it("refuses to release a paper nobody has sat", async () => {
    api.getAcademyExamAttempts.mockResolvedValue({ data: [], error: null });
    renderPage();
    await waitFor(() =>
      expect(api.publishAcademyExamResults).not.toHaveBeenCalled(),
    );
    expect(
      await screen.findByRole("button", { name: /release results/i }),
    ).toBeDisabled();
  });

  it("flags a paper that finished well after its deadline on the server", async () => {
    // A timeout submit synced three hours later is a different situation from a
    // clean hand-in, and the teacher should be able to see that.
    renderPage();
    expect(await screen.findByText("Bola Adeyemi")).toBeInTheDocument();
    const late = screen.getAllByText("synced late");
    expect(late).toHaveLength(1);
  });

  it("does not flag a clean hand-in as late", async () => {
    renderPage();
    expect(await screen.findByText("Ada Bello")).toBeInTheDocument();
    // Scoped to Ada's own row: the flag is a per-attempt thing, and a table-wide
    // query would find the other student's late finish.
    const row = screen.getByText("Ada Bello").closest("tr");
    expect(row.textContent).not.toContain("synced late");
  });

  it("explains why releasing is not possible rather than only greying it out", async () => {
    api.getAcademyExamAttempts.mockResolvedValue({ data: [], error: null });
    renderPage();
    // A disabled control with no reason reads as a broken page.
    expect(
      await screen.findByText(/nothing to release/i),
    ).toBeInTheDocument();
  });

  it("holds a paper back while it is still open", async () => {
    api.getAcademyExams.mockResolvedValue({
      data: [{ ...EXAM, ends_at: new Date(Date.now() + 86400000).toISOString() }],
      error: null,
    });
    renderPage();
    expect(await screen.findByText(/paper is still open/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /release results/i })).toBeDisabled();
  });

  it("still allows results to be withheld on a paper that is still open", async () => {
    api.getAcademyExams.mockResolvedValue({
      data: [
        {
          ...EXAM,
          results_published: true,
          ends_at: new Date(Date.now() + 86400000).toISOString(),
        },
      ],
      error: null,
    });
    renderPage();
    expect(await screen.findByText("Ada Bello")).toBeInTheDocument();
    const withhold = screen.getByRole("button", { name: /withhold results/i });
    // Taking marks back is always allowed; only releasing them waits.
    expect(withhold).not.toBeDisabled();
    fireEvent.click(withhold);
    await waitFor(() =>
      expect(api.publishAcademyExamResults).toHaveBeenCalledWith("exam-1", false),
    );
  });

  it("explains a failed release instead of pretending it worked", async () => {
    api.publishAcademyExamResults.mockResolvedValue({
      data: null,
      error: { message: "Only teachers can publish." },
    });
    renderPage();
    expect(await screen.findByText("Ada Bello")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /release results/i }));
    expect(await screen.findByText(/only teachers can publish/i)).toBeInTheDocument();
  });

  it("surfaces a load failure", async () => {
    api.getAcademyExamAttempts.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });
    renderPage();
    expect(await screen.findByText(/permission denied/i)).toBeInTheDocument();
  });
});

describe("results are reachable and the runner is linked", () => {
  it("routes the results page behind the admin guard", () => {
    const app = readFileSync("src/App.jsx", "utf8");
    const nav = readFileSync("src/components/academy/AdminContentNav.jsx", "utf8");
    expect(app).toMatch(/path="\/academy\/admin\/exam-results"/);
    expect(app).toMatch(/AcademyAdminExamResults/);
    expect(nav).toMatch(/Exam results/);
  });

  it("gives students a way to reach their own examinations", () => {
    const nav = readFileSync("src/components/academy/StudentSectionNav.jsx", "utf8");
    // The first link of a section is its primary button, so Examinations has to
    // sit after it or it never renders.
    expect(nav).toMatch(/\{ label: "Examinations", to: "\/academy\/exams" \}/);
  });

  it("uses the results RPC, not the one that publishes the paper", () => {
    const lib = readFileSync("src/lib/academy.js", "utf8");
    expect(lib).toMatch(/academy_exam_publish_results/);
    expect(lib).toMatch(/p_publish: publish/);
  });
});
