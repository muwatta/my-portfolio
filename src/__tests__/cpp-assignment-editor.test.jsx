import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => ({ user: { id: "student-1" } }),
}));
vi.mock("../lib/supabase", () => ({ supabase: null }));
vi.mock("../lib/academy", () => ({
  getAcademyAssignment: vi.fn(),
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
  default: () => <div data-testid="python-editor" />,
}));
vi.mock("../components/academy/CppEditor", () => ({
  default: () => <div data-testid="cpp-editor" />,
}));

const {
  getAcademyAssignment,
  getSubmissionCount,
  getAcademySubmissionHistory,
} = await import("../lib/academy");
const { fetchWithOfflineFallback } = await import("../lib/academyOffline");
const { getOfflineRecord } = await import("../lib/offlineStore");
const AcademyAssignment = (await import("../pages/AcademyAssignment.jsx")).default;

function assignmentFor(language) {
  return {
    data: {
      id: "a1",
      title: "Blink an LED",
      instructions: "Write the program.",
      points: 10,
      retry_limit: 3,
      allowed_submission_types: ["code"],
      starter_code: "// starter",
      published: true,
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
  });

  it("offers the Python editor for a Python course", async () => {
    getAcademyAssignment.mockResolvedValue(assignmentFor("python"));
    renderPage();
    await waitFor(() => expect(screen.getByTestId("python-editor")).toBeInTheDocument());
    expect(screen.queryByTestId("cpp-editor")).not.toBeInTheDocument();
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

  it("does not offer C++ uploads for a Python assignment", async () => {
    getAcademyAssignment.mockResolvedValue(assignmentFor("python"));
    renderPage();
    await waitFor(() => expect(screen.getByTestId("python-editor")).toBeInTheDocument());
    const input = screen.getByLabelText(/upload a file/i);
    expect(input.getAttribute("accept")).not.toContain(".cpp");
    expect(input.getAttribute("accept")).toContain(".py");
  });
});