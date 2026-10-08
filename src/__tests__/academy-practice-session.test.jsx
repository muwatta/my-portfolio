import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const api = vi.hoisted(() => ({
  getAcademyExercises: vi.fn(),
  submitObjectiveAnswer: vi.fn(),
}));
const offlineState = vi.hoisted(() => ({ records: {} }));

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => ({ user: { id: "student-1" } }),
}));

vi.mock("../hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => ({ online: true, slow: false }),
}));

vi.mock("../lib/academy", () => api);

vi.mock("../lib/academyOffline", () => ({
  fetchWithOfflineFallback: async ({ fetcher }) => ({
    ...(await fetcher()),
    offline: false,
  }),
}));

vi.mock("../lib/offlineStore", () => ({
  OFFLINE_STORES: { exercises: "exercises", drafts: "drafts" },
  getOfflineRecord: vi.fn(async (store, userId, id) => {
    return offlineState.records[`${userId}:${id}`]?.data ?? null;
  }),
  putOfflineRecord: vi.fn(async (store, userId, id, data) => {
    offlineState.records[`${userId}:${id}`] = { id, data };
  }),
}));

vi.mock("../lib/academySync", () => ({
  enqueueAcademyOperation: vi.fn(),
}));

vi.mock("../lib/utils", () => ({
  friendlyError: (error, fallback) => error?.message || fallback,
}));

vi.mock("../components/academy/AcademyConnectionState", () => ({
  default: ({ loading, children }) =>
    loading ? <p>Loading</p> : <div>{children}</div>,
}));

vi.mock("../components/academy/ProtectedContent", () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock("../components/academy/PythonEditor", () => ({
  default: ({ code, onCodeChange }) => (
    <textarea
      aria-label="Python code editor"
      value={code ?? ""}
      onChange={(event) => onCodeChange(event.target.value)}
    />
  ),
}));

vi.mock("../components/academy/CppEditor", () => ({
  default: ({ code, onCodeChange }) => (
    <textarea
      aria-label="C++ code editor"
      value={code ?? ""}
      onChange={(event) => onCodeChange(event.target.value)}
    />
  ),
}));

import AcademyPractice from "../pages/AcademyPractice";

const EXERCISES = [
  {
    id: "quiz-1",
    lesson_id: "lesson-1",
    title: "Is Python interpreted?",
    instructions: "Choose true or false.",
    question_type: "true_false",
    choices: [],
    language: "python",
    difficulty: "beginner",
    academy_lessons: { title: "Python basics" },
  },
  {
    id: "code-1",
    lesson_id: "lesson-1",
    title: "Print a greeting",
    instructions: "Change the greeting.",
    question_type: "programming",
    starter_code: "print('Hello')",
    language: "python",
    difficulty: "beginner",
    academy_lessons: { title: "Python basics" },
  },
];

function renderPractice() {
  return render(
    <MemoryRouter initialEntries={["/academy/practice?lesson=lesson-1"]}>
      <Routes>
        <Route path="/academy/practice" element={<AcademyPractice />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AcademyPractice saved session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    offlineState.records = {};
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    api.getAcademyExercises.mockResolvedValue({
      data: EXERCISES,
      error: null,
      configured: true,
    });
    api.submitObjectiveAnswer.mockResolvedValue({
      data: { score: 1, max_score: 1 },
      error: null,
    });
  });

  it("restores objective answers and code after reopening practice", async () => {
    const firstVisit = renderPractice();
    const trueChoice = await screen.findByRole("radio", { name: "true" });
    fireEvent.click(trueChoice);
    fireEvent.change(screen.getByRole("textbox", { name: "Python code editor" }), {
      target: { value: "print('Saved work')" },
    });

    await waitFor(() => {
      const saved = offlineState.records["student-1:practice:lesson-1"]?.data;
      expect(saved?.answers["quiz-1"]).toBe("true");
      expect(saved?.codeDrafts["code-1"]).toBe("print('Saved work')");
    });
    firstVisit.unmount();

    renderPractice();
    expect(await screen.findByRole("radio", { name: "true" })).toBeChecked();
    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: "Python code editor" }),
      ).toHaveValue("print('Saved work')");
    });
  });

  it("uses an idempotency key and clears the busy state on grading errors", async () => {
    api.submitObjectiveAnswer.mockResolvedValueOnce({
      data: null,
      error: new Error("Grading service is temporarily unavailable."),
    });
    renderPractice();
    fireEvent.click(await screen.findByRole("radio", { name: "true" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Submit answer" })[0]);

    expect(
      await screen.findByText("Grading service is temporarily unavailable."),
    ).toBeInTheDocument();
    expect(api.submitObjectiveAnswer).toHaveBeenCalledWith(
      "quiz-1",
      "true",
      expect.any(String),
    );
    expect(screen.getAllByRole("button", { name: "Submit answer" })[0]).toBeEnabled();
  });
});
