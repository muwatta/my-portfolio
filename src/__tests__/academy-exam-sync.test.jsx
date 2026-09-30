import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ current: { user: { id: "student-1" } } }));
const api = vi.hoisted(() => ({
  saveAcademyExamAnswer: vi.fn(),
  submitAcademyExamAttempt: vi.fn(),
  getAcademySubmissionHistory: vi.fn(),
  markAcademyNotificationRead: vi.fn(),
  markLessonComplete: vi.fn(),
  markProjectMilestoneComplete: vi.fn(),
  requestAcademyDeterministicGrading: vi.fn(),
  submitAssignment: vi.fn(),
  submitObjectiveAnswer: vi.fn(),
}));
const sync = vi.hoisted(() => ({ handlers: null }));

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => authState.current,
}));

vi.mock("../lib/academy", () => api);

vi.mock("../lib/supabase", () => ({ supabase: null }));

vi.mock("../lib/academySync", () => ({
  startAcademySync: vi.fn(),
  subscribeToAcademySync: vi.fn(() => () => {}),
  syncAcademyOperations: vi.fn((userId, handlers) => {
    // Capture the handler table the component builds on mount.
    sync.handlers = handlers;
  }),
}));

import OfflineStatus from "../components/academy/OfflineStatus";

async function mountDriver() {
  render(<OfflineStatus />);
  await waitFor(() => expect(sync.handlers).not.toBeNull());
  return sync.handlers;
}

describe("queued examination operations", () => {
  beforeEach(() => {
    sync.handlers = null;
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
    authState.current = { user: { id: "student-1" } };
    api.saveAcademyExamAnswer.mockResolvedValue({ data: true });
    api.submitAcademyExamAttempt.mockResolvedValue({ data: true });
  });

  it("has a handler for a queued answer", async () => {
    const handlers = await mountDriver();
    expect(handlers.exam_answer).toBeTypeOf("function");
  });

  it("replays a queued answer through the same server function as a live save", async () => {
    const handlers = await mountDriver();
    await handlers.exam_answer({
      attemptId: "attempt-1",
      questionId: "q1",
      selectedKey: "A",
      clientAnsweredAt: "2026-01-01T10:00:00.000Z",
    });
    expect(api.saveAcademyExamAnswer).toHaveBeenCalledWith(
      "attempt-1",
      "q1",
      "A",
      "2026-01-01T10:00:00.000Z",
    );
  });

  it("replays a queued submission with the reason it was queued under", async () => {
    const handlers = await mountDriver();
    await handlers.exam_submit({
      attemptId: "attempt-1",
      reason: "timeout",
      clientSubmittedAt: "2026-01-01T10:30:00.000Z",
    });
    // A replayed timeout stays a timeout, so the server is not told a student
    // handed it in on time when the connection dropped at the buzzer.
    expect(api.submitAcademyExamAttempt).toHaveBeenCalledWith(
      "attempt-1",
      "timeout",
      "2026-01-01T10:30:00.000Z",
    );
  });

  it("rethrows so a failed replay is retried instead of marked done", async () => {
    api.saveAcademyExamAnswer.mockResolvedValue({
      error: { message: "Attempt closed." },
    });
    const handlers = await mountDriver();
    await expect(
      handlers.exam_answer({
        attemptId: "attempt-1",
        questionId: "q1",
        selectedKey: "A",
        clientAnsweredAt: "2026-01-01T10:00:00.000Z",
      }),
    ).rejects.toBeTruthy();
  });

  it("rethrows a failed submission replay as well", async () => {
    api.submitAcademyExamAttempt.mockResolvedValue({
      error: { message: "Attempt not found." },
    });
    const handlers = await mountDriver();
    await expect(
      handlers.exam_submit({
        attemptId: "attempt-1",
        reason: "student",
        clientSubmittedAt: "2026-01-01T10:30:00.000Z",
      }),
    ).rejects.toBeTruthy();
  });
});
