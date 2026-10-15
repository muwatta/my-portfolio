import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => ({ user: { id: "student-1" } }),
}));
vi.mock("../lib/supabase", () => ({ supabase: null }));
vi.mock("../lib/academy", () => ({
  getAcademyAssignment: vi.fn(),
  getAcademyCourseMaterials: vi.fn(),
  getAcademyMaterialUrl: vi.fn(),
  getSubmissionCount: vi.fn(),
  getAcademySubmissionHistory: vi.fn(),
  requestAcademyDeterministicGrading: vi.fn(),
  submitAssignment: vi.fn(),
}));
vi.mock("../lib/academyOffline", () => ({
  fetchWithOfflineFallback: vi.fn(),
}));
vi.mock("../lib/offlineStore", () => ({
  OFFLINE_STORES: { assignments: "assignments", drafts: "drafts" },
  getOfflineRecord: vi.fn(),
  putOfflineRecord: vi.fn(),
  deleteOfflineRecord: vi.fn(),
}));
vi.mock("../lib/academySync", () => ({ enqueueAcademyOperation: vi.fn() }));
// Both editors are reduced to a marker so the assertion is about which one the
// page chose, not about how each editor renders or whether its worker runs.
vi.mock("../components/academy/PythonEditor", () => ({
  default: ({ stdin }) => (
    <div data-testid="python-editor" data-stdin={stdin} />
  ),
}));
vi.mock("../components/academy/CppEditor", () => ({
  default: ({ stdin, code, onCodeChange }) => (
    <div data-testid="cpp-editor" data-stdin={stdin}>
      <textarea
        aria-label="Mock C++ source"
        value={code}
        onChange={(event) => onCodeChange(event.target.value)}
      />
    </div>
  ),
}));

const {
  getAcademyAssignment,
  getAcademyCourseMaterials,
  getAcademyMaterialUrl,
  getSubmissionCount,
  getAcademySubmissionHistory,
  requestAcademyDeterministicGrading,
  submitAssignment,
} = await import("../lib/academy");
const { fetchWithOfflineFallback } = await import("../lib/academyOffline");
const { getOfflineRecord } = await import("../lib/offlineStore");
const AcademyAssignment = (await import("../pages/AcademyAssignment.jsx")).default;

function assignmentFor(language) {
  return {
    data: {
      id: "a1",
      title: "Blink an LED",
      instructions: "Program input example: 3000",
      points: 10,
      retry_limit: 3,
      allowed_submission_types: ["code"],
      starter_code: "// starter",
      published: true,
      lesson_id: "lesson-1",
      academy_courses: { id: "c1", slug: "cpp", title: "C++", language },
    },
    error: null,
    configured: true,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/academy/assignments/a1"]}>
      <Routes>
        <Route
          path="/academy/assignments/:id"
          element={<AcademyAssignment />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("which editor an assignment offers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSubmissionCount.mockResolvedValue({ count: 0, error: null });
    getAcademySubmissionHistory.mockResolvedValue({ data: [], error: null });
    getAcademyCourseMaterials.mockResolvedValue({ data: [], error: null });
    getAcademyMaterialUrl.mockResolvedValue({ data: null, error: null });
    getOfflineRecord.mockResolvedValue(null);
    // getAcademyAssignment returns a { data, error, configured } envelope and the
    // page assigns result.data. Returning the envelope itself would leave every
    // field undefined, and the editor branch would fall through to Python for the
    // wrong reason.
    fetchWithOfflineFallback.mockImplementation(async ({ fetcher }) => {
      const result = await fetcher();
      return {
        data: result?.data ?? null,
        error: result?.error ?? null,
        offline: false,
        configured: true,
      };
    });
  });

  it("offers the C++ editor for a C++ course", async () => {
    getAcademyAssignment.mockResolvedValue(assignmentFor("cpp"));
    renderPage();
    await waitFor(() => expect(screen.getByTestId("cpp-editor")).toBeInTheDocument());
    expect(screen.queryByTestId("python-editor")).not.toBeInTheDocument();
    expect(screen.getByTestId("cpp-editor")).toHaveAttribute("data-stdin", "3000");
  });

  it("offers the Python editor for a Python course", async () => {
    getAcademyAssignment.mockResolvedValue(assignmentFor("python"));
    renderPage();
    await waitFor(() => expect(screen.getByTestId("python-editor")).toBeInTheDocument());
    expect(screen.queryByTestId("cpp-editor")).not.toBeInTheDocument();
    expect(screen.getByTestId("python-editor")).toHaveAttribute(
      "data-stdin",
      "3000",
    );
  });

  it("submits the latest edited code and explains when automatic grading is unavailable", async () => {
    getAcademyAssignment.mockResolvedValue(assignmentFor("cpp"));
    getSubmissionCount.mockResolvedValue({ count: 3, error: null });
    getAcademySubmissionHistory
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [{ id: "submission-1", attempt_number: 1, status: "submitted" }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: "submission-1", attempt_number: 1, status: "submitted" }],
        error: null,
      });
    submitAssignment.mockResolvedValue({ data: null, error: null });
    requestAcademyDeterministicGrading.mockResolvedValue({
      data: null,
      error: new Error("Grader unavailable"),
    });

    renderPage();
    expect(
      await screen.findByText("Attempts made: 3 · Unlimited submissions"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit assignment" }),
    ).toBeEnabled();
    fireEvent.change(await screen.findByLabelText("Mock C++ source"), {
      target: { value: "int main() { return 0; }" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit assignment" }));

    await waitFor(() =>
      expect(submitAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          assignmentId: "a1",
          sourceCode: "int main() { return 0; }",
        }),
      ),
    );
    expect(requestAcademyDeterministicGrading).toHaveBeenCalledWith(
      "submission-1",
    );
    expect(
      await screen.findByText(
        /submission was received, but automatic grading is unavailable/i,
      ),
    ).toBeInTheDocument();
  });

  it("explains why a locked weekly assignment cannot be submitted", async () => {
    const result = assignmentFor("cpp");
    getAcademyAssignment.mockResolvedValue({
      ...result,
      data: { ...result.data, locked: true },
    });

    renderPage();

    expect(
      await screen.findByRole("button", { name: "Waiting for previous mark" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/instructor must mark every earlier c\+\+ weekly assignment/i),
    ).toBeInTheDocument();
  });

  it("falls back to Python when the course relation is missing", async () => {
    // Offline or cached payloads predate the language select. Defaulting to
    // Python matches the previous behaviour rather than showing no editor.
    const payload = assignmentFor("cpp");
    delete payload.data.academy_courses;
    getAcademyAssignment.mockResolvedValue(payload);
    renderPage();
    await waitFor(() => expect(screen.getByTestId("python-editor")).toBeInTheDocument());
  });

  it("accepts C++ uploads for a C++ assignment", async () => {
    getAcademyAssignment.mockResolvedValue(assignmentFor("cpp"));
    renderPage();
    await waitFor(() => expect(screen.getByTestId("cpp-editor")).toBeInTheDocument());
    const input = screen.getByLabelText(/upload a file/i);
    expect(input.getAttribute("accept")).toContain(".cpp");
  });

  it("lets students cancel a selected file upload", async () => {
    getAcademyAssignment.mockResolvedValue(assignmentFor("cpp"));
    renderPage();
    const input = await screen.findByLabelText(/upload a file/i);
    const upload = new File(["int main() {}"], "answer.cpp", {
      type: "text/plain",
    });

    fireEvent.change(input, { target: { files: [upload] } });

    expect(await screen.findByText("Selected: answer.cpp")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel upload" }));

    expect(screen.queryByText("Selected: answer.cpp")).not.toBeInTheDocument();
    expect(
      screen.getByText(/selected file removed/i),
    ).toBeInTheDocument();
    expect(input.value).toBe("");
  });

  it("does not offer C++ uploads for a Python assignment", async () => {
    getAcademyAssignment.mockResolvedValue(assignmentFor("python"));
    renderPage();
    await waitFor(() => expect(screen.getByTestId("python-editor")).toBeInTheDocument());
    const input = screen.getByLabelText(/upload a file/i);
    expect(input.getAttribute("accept")).not.toContain(".cpp");
    expect(input.getAttribute("accept")).toContain(".py");
  });

  it("shows the PDF for the assignment lesson beside the task", async () => {
    const lessonPdf = {
      id: "pdf-lesson",
      lesson_id: "lesson-1",
      title: "LEDs and resistors",
      mime_type: "application/pdf",
      storage_path: "leds.pdf",
      storage_kind: "static",
    };
    getAcademyCourseMaterials.mockResolvedValue({
      data: [
        {
          ...lessonPdf,
          id: "pdf-other",
          lesson_id: "another-lesson",
          title: "Unrelated lesson",
        },
        lessonPdf,
      ],
      error: null,
    });
    getAcademyMaterialUrl.mockResolvedValue({
      data: { url: "/course_material_assets/leds.pdf" },
      error: null,
    });
    getAcademyAssignment.mockResolvedValue(assignmentFor("cpp"));

    renderPage();

    expect(
      await screen.findByTitle("Course PDF: LEDs and resistors"),
    ).toHaveAttribute("src", "/course_material_assets/leds.pdf");
    expect(screen.getByRole("link", { name: "Open PDF" })).toHaveAttribute(
      "href",
      "/course_material_assets/leds.pdf",
    );
  });

  it("explains when no course PDF is linked without blocking the task", async () => {
    getAcademyAssignment.mockResolvedValue(assignmentFor("cpp"));
    getAcademyCourseMaterials.mockResolvedValue({ data: [], error: null });

    renderPage();

    expect(
      await screen.findByText(/no matching course pdf is linked/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("cpp-editor")).toBeInTheDocument();
  });
});