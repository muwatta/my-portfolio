import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ current: { user: { id: "student-1" } } }));
const store = vi.hoisted(() => ({ records: {}, queue: [] }));
const api = vi.hoisted(() => ({
  startAcademyExamAttempt: vi.fn(),
  getAcademyExamPaper: vi.fn(),
  saveAcademyExamAnswer: vi.fn(),
  submitAcademyExamAttempt: vi.fn(),
  getAcademyExamResult: vi.fn(),
  getAcademyAvailableExams: vi.fn(),
  getAcademyExamLiveAttempt: vi.fn(),
}));

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => authState.current,
}));

vi.mock("../lib/academy", () => api);

vi.mock("../lib/academySync", () => ({
  enqueueAcademyOperation: vi.fn(async (userId, operation) => {
    store.queue.push(operation);
  }),
}));

vi.mock("../lib/offlineStore", () => ({
  OFFLINE_STORES: {
    syncQueue: "syncQueue",
    examPapers: "examPapers",
    examDrafts: "examDrafts",
  },
  putOfflineRecord: vi.fn(async (storeName, userId, id, data) => {
    store.records[`${storeName}:${id}`] = data;
  }),
  getOfflineRecord: vi.fn(async (storeName, userId, id) => {
    const data = store.records[`${storeName}:${id}`];
    return data ? { id, data } : null;
  }),
  getOfflineRecords: vi.fn(async (storeName) => {
    if (storeName !== "syncQueue") return [];
    return store.queue.map((operation, position) => ({
      id: operation.operationId,
      data: { ...operation, status: "pending" },
      position,
    }));
  }),
}));

import AcademyExamRunner from "../components/academy/AcademyExamRunner";

const EXAM = {
  id: "exam-1",
  title: "Object Oriented Programming",
  duration_minutes: 30,
  max_attempts: 2,
  instructions: "Answer every question.",
};

const PAPER = [
  { question_id: "q1", prompt: "Which keyword declares a class?", marks: 1, options: [
    { key: "A", label: "class" },
    { key: "B", label: "struct" },
  ] },
  { question_id: "q2", prompt: "C++ is object oriented.", marks: 1, options: [
    { key: "A", label: "True" },
    { key: "B", label: "False" },
  ] },
];

function inMinutes(minutes) {
  return new Date(Date.now() + minutes * 60000).toISOString();
}

async function startPaper() {
  render(<AcademyExamRunner exam={EXAM} />);
  fireEvent.click(await screen.findByRole("button", { name: /start examination/i }));
  await screen.findByText("Which keyword declares a class?");
}

describe("AcademyExamRunner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.records = {};
    store.queue = [];
    authState.current = { user: { id: "student-1" } };
    api.startAcademyExamAttempt.mockResolvedValue({
      data: {
        id: "attempt-1",
        deadline_at: inMinutes(30),
        status: "in_progress",
      },
    });
    api.getAcademyExamPaper.mockResolvedValue({ data: PAPER });
    api.saveAcademyExamAnswer.mockResolvedValue({ data: true });
    api.submitAcademyExamAttempt.mockResolvedValue({ data: true });
    api.getAcademyExamResult.mockResolvedValue({ data: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the paper rules before anything is started", async () => {
    render(<AcademyExamRunner exam={EXAM} />);
    expect(await screen.findByText("Object Oriented Programming")).toBeInTheDocument();
    expect(screen.getByText("30 minutes")).toBeInTheDocument();
    expect(screen.getByText("Answer every question.")).toBeInTheDocument();
    expect(api.startAcademyExamAttempt).not.toHaveBeenCalled();
  });

  it("counts down from the deadline the server returned", async () => {
    await startPaper();
    expect(screen.getByText("Time remaining")).toBeInTheDocument();
    // A minute or so under the 30 minute deadline, not 30:00 exactly, because
    // the clock is derived from an absolute timestamp rather than a counter.
    expect(screen.getByText(/^29:5\d$/)).toBeInTheDocument();
  });

  it("saves an answer with the client timestamp it was given", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await startPaper();
    vi.useRealTimers();

    fireEvent.click(screen.getByRole("button", { name: /class/ }));
    await waitFor(() => expect(api.saveAcademyExamAnswer).toHaveBeenCalled());
    const [attemptId, questionId, key, answeredAt] =
      api.saveAcademyExamAnswer.mock.calls[0];
    expect(attemptId).toBe("attempt-1");
    expect(questionId).toBe("q1");
    expect(key).toBe("A");
    expect(Date.parse(answeredAt)).not.toBeNaN();
  });

  it("moves between questions and counts what is answered", async () => {
    await startPaper();
    expect(screen.getByText("Question 1 of 2 · 0 answered")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /class/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Next$/ }));
    expect(await screen.findByText("C++ is object oriented.")).toBeInTheDocument();
    expect(screen.getByText("Question 2 of 2 · 1 answered")).toBeInTheDocument();
  });

  it("marks an answered question in the navigation grid", async () => {
    await startPaper();
    fireEvent.click(screen.getByRole("button", { name: /class/ }));
    const jump = screen.getByRole("button", { name: /Question 2, not answered/i });
    fireEvent.click(jump);
    expect(await screen.findByText("C++ is object oriented.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Question 1, answered/i }),
    ).toBeInTheDocument();
  });

  it("reports the submitted state without leaking a score", async () => {
    await startPaper();
    fireEvent.click(screen.getByRole("button", { name: /class/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Next$/ }));
    fireEvent.click(await screen.findByRole("button", { name: /submit examination/i }));

    await waitFor(() => expect(api.submitAcademyExamAttempt).toHaveBeenCalled());
    expect(
      await screen.findByText(/submitted successfully/i),
    ).toBeInTheDocument();
    // Result is unpublished, so no percentage and no marks breakdown.
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.queryByText(/correct,.*wrong/)).toBeNull();
  });

  it("shows the score once the teacher publishes the result", async () => {
    api.getAcademyExamResult.mockResolvedValue({
      data: {
        results_published: true,
        score: 7,
        total_marks: 10,
        correct: 7,
        incorrect: 2,
        unanswered: 1,
        percentage: 70,
      },
    });
    await startPaper();
    // Submit only sits at the end of the paper, so walk there first.
    fireEvent.click(await screen.findByRole("button", { name: /^Next$/ }));
    fireEvent.click(await screen.findByRole("button", { name: /submit examination/i }));
    expect(await screen.findByText("70%")).toBeInTheDocument();
    expect(screen.getByText(/7 of 10 marks/)).toBeInTheDocument();
  });

  it("refuses to start a paper the server rejects", async () => {
    api.startAcademyExamAttempt.mockResolvedValue({
      error: { message: "Examination has ended." },
    });
    render(<AcademyExamRunner exam={EXAM} />);
    fireEvent.click(await screen.findByRole("button", { name: /start examination/i }));
    expect(
      await screen.findByText(/Examination has ended/),
    ).toBeInTheDocument();
    expect(api.getAcademyExamPaper).not.toHaveBeenCalled();
  });

  it("stores the paper on the device once it has been served", async () => {
    // Only the write is asserted here. Reading it back is covered by the
    // "offline paper" block below, which is the half that was missing.
    await startPaper();
    await waitFor(() =>
      expect(store.records["examPapers:attempt-1"]).toBeDefined(),
    );
    expect(store.records["examPapers:attempt-1"].questions).toHaveLength(2);
  });
});

describe("AcademyExamRunner offline and timeout behaviour", () => {
  const online = { value: true };

  beforeEach(() => {
    vi.clearAllMocks();
    store.records = {};
    store.queue = [];
    online.value = true;
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => online.value,
    });
    authState.current = { user: { id: "student-1" } };
    api.startAcademyExamAttempt.mockResolvedValue({
      data: { id: "attempt-1", deadline_at: inMinutes(30), status: "in_progress" },
    });
    api.getAcademyExamPaper.mockResolvedValue({ data: PAPER });
    api.saveAcademyExamAnswer.mockResolvedValue({ data: true });
    api.submitAcademyExamAttempt.mockResolvedValue({ data: true });
    api.getAcademyExamResult.mockResolvedValue({ data: null });
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
  });

  it("queues an answer instead of calling the server while offline", async () => {
    online.value = false;
    await startPaper();
    fireEvent.click(screen.getByRole("button", { name: /class/ }));

    await waitFor(() => expect(store.queue).toHaveLength(1));
    const [operation] = store.queue;
    expect(operation.type).toBe("exam_answer");
    expect(operation.payload).toMatchObject({
      attemptId: "attempt-1",
      questionId: "q1",
      selectedKey: "A",
    });
    expect(api.saveAcademyExamAnswer).not.toHaveBeenCalled();
  });

  it("gives a queued answer an id built from its own timestamp", async () => {
    online.value = false;
    await startPaper();
    fireEvent.click(screen.getByRole("button", { name: /class/ }));
    await waitFor(() => expect(store.queue).toHaveLength(1));

    // Replaying the same answer must be a no-op rather than a second write.
    const { operationId } = store.queue[0];
    expect(operationId).toBe(
      `exam-answer-attempt-1-q1-${store.queue[0].payload.clientAnsweredAt}`,
    );
  });

  it("keeps the answer in the local draft so a refresh does not lose it", async () => {
    online.value = false;
    await startPaper();
    fireEvent.click(screen.getByRole("button", { name: /class/ }));

    await waitFor(() =>
      expect(store.records["examDrafts:attempt-1"]).toBeDefined(),
    );
    expect(store.records["examDrafts:attempt-1"].answers.q1).toMatchObject({
      key: "A",
    });
  });

  it("queues the submission when the student finishes offline", async () => {
    online.value = false;
    await startPaper();
    fireEvent.click(screen.getByRole("button", { name: /^Next$/ }));
    fireEvent.click(await screen.findByRole("button", { name: /submit examination/i }));

    await waitFor(() =>
      expect(store.queue.some((o) => o.type === "exam_submit")).toBe(true),
    );
    const submit = store.queue.find((o) => o.type === "exam_submit");
    expect(submit.payload.reason).toBe("student");
    expect(api.submitAcademyExamAttempt).not.toHaveBeenCalled();
    expect(await screen.findByText(/submitted successfully/i)).toBeInTheDocument();
  });

  it("says the work will be sent when a submission is waiting", async () => {
    online.value = false;
    await startPaper();
    fireEvent.click(screen.getByRole("button", { name: /^Next$/ }));
    fireEvent.click(await screen.findByRole("button", { name: /submit examination/i }));

    expect(
      await screen.findByText(/still waiting to send/i),
    ).toBeInTheDocument();
  });

  it("submits by itself as soon as the server deadline passes", async () => {
    api.startAcademyExamAttempt.mockResolvedValue({
      data: {
        id: "attempt-1",
        deadline_at: new Date(Date.now() - 1000).toISOString(),
        status: "in_progress",
      },
    });
    render(<AcademyExamRunner exam={EXAM} />);
    fireEvent.click(await screen.findByRole("button", { name: /start examination/i }));

    // The deadline is already behind us, so this happens without any waiting on
    // a countdown, which is the point: the browser never decides when time is up.
    expect(
      await screen.findByText(/submitted for you/i),
    ).toBeInTheDocument();
    expect(api.submitAcademyExamAttempt).toHaveBeenCalled();
    // The reason is recorded as a timeout, so the server can tell this apart
    // from a student handing in early.
    const [, reason] = api.submitAcademyExamAttempt.mock.calls[0];
    expect(reason).toBe("timeout");
  });

  it("queues a timeout submission when the deadline passes offline", async () => {
    online.value = false;
    api.startAcademyExamAttempt.mockResolvedValue({
      data: {
        id: "attempt-1",
        deadline_at: new Date(Date.now() - 1000).toISOString(),
        status: "in_progress",
      },
    });
    api.submitAcademyExamAttempt.mockRejectedValue(new Error("offline"));
    render(<AcademyExamRunner exam={EXAM} />);
    fireEvent.click(await screen.findByRole("button", { name: /start examination/i }));

    await waitFor(() =>
      expect(store.queue.some((o) => o.type === "exam_submit")).toBe(true),
    );
    const submit = store.queue.find((o) => o.type === "exam_submit");
    expect(submit.payload.reason).toBe("timeout");
    expect(
      await screen.findByText(/back online/i),
    ).toBeInTheDocument();
  });

  it("takes the attempt id from the server rather than one of its own", async () => {
    // The old version of this test asserted startAcademyExamAttempt was called
    // once, which was true only because the mock was written to return the same
    // object every time. The real server refused a second call outright, so a
    // student who refreshed lost their paper entirely. What the runner owes the
    // server is that it works with whatever attempt it is handed, so give it an
    // id it could never have guessed.
    api.startAcademyExamAttempt.mockResolvedValue({
      data: {
        id: "attempt-from-server-9f2",
        deadline_at: inMinutes(30),
        status: "in_progress",
      },
    });
    render(<AcademyExamRunner exam={EXAM} />);
    fireEvent.click(await screen.findByRole("button", { name: /start examination/i }));
    await screen.findByText("Which keyword declares a class?");

    expect(api.getAcademyExamPaper).toHaveBeenCalledWith("attempt-from-server-9f2");
  });
});

describe("AcademyExamRunner offline paper", () => {
  const online = { value: true };

  beforeEach(() => {
    vi.clearAllMocks();
    store.records = {};
    store.queue = [];
    online.value = true;
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => online.value,
    });
    authState.current = { user: { id: "student-1" } };
    api.startAcademyExamAttempt.mockResolvedValue({
      data: { id: "attempt-1", deadline_at: inMinutes(30), status: "in_progress" },
    });
    api.getAcademyExamPaper.mockResolvedValue({ data: PAPER });
    api.saveAcademyExamAnswer.mockResolvedValue({ data: true });
    api.submitAcademyExamAttempt.mockResolvedValue({ data: true });
    api.getAcademyExamResult.mockResolvedValue({ data: null });
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
  });

  // Sit the paper once so it is cached, then reopen it with no signal.
  async function cacheThenReopen() {
    const first = render(<AcademyExamRunner exam={EXAM} />);
    fireEvent.click(
      await screen.findByRole("button", { name: /start examination/i }),
    );
    await screen.findByText("Which keyword declares a class?");
    await waitFor(() =>
      expect(store.records["examPapers:attempt-1"]).toBeDefined(),
    );
    first.unmount();

    online.value = false;
    api.getAcademyExamPaper.mockResolvedValue({
      data: null,
      error: { message: "Failed to fetch" },
    });
    render(<AcademyExamRunner exam={EXAM} />);
    fireEvent.click(
      await screen.findByRole("button", { name: /start examination/i }),
    );
  }

  it("falls back to the saved paper when the network is gone", async () => {
    await cacheThenReopen();
    // Without this the draft is restored and there is nothing to put it against.
    expect(
      await screen.findByText("Which keyword declares a class?"),
    ).toBeInTheDocument();
  });

  it("says when the paper on screen is a saved copy", async () => {
    await cacheThenReopen();
    expect(
      await screen.findByText(/saved copy of this paper/i),
    ).toBeInTheDocument();
  });

  it("says so plainly that the deadline is still the server's", async () => {
    await cacheThenReopen();
    expect(
      await screen.findByText(/time left is still set by the server/i),
    ).toBeInTheDocument();
  });

  it("still lets a student answer from the saved copy", async () => {
    await cacheThenReopen();
    const question = await screen.findByText("Which keyword declares a class?");
    expect(question).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /class/ }));
    await waitFor(() => expect(store.queue).toHaveLength(1));
  });

  it("does not fall back to the cache when the server refuses online", async () => {
    // This is the important one. A refusal can mean the window has closed, and
    // answering a saved copy of a paper the server just refused would be working
    // on an exam the student is no longer entitled to take.
    render(<AcademyExamRunner exam={EXAM} />);
    fireEvent.click(
      await screen.findByRole("button", { name: /start examination/i }),
    );
    await screen.findByText("Which keyword declares a class?");
    store.records["examPapers:attempt-1"] = { questions: PAPER };

    api.getAcademyExamPaper.mockResolvedValue({
      data: null,
      error: { message: "Examination has ended." },
    });
    const again = render(<AcademyExamRunner exam={EXAM} />);
    fireEvent.click(
      await screen.findByRole("button", { name: /start examination/i }),
    );

    expect(await screen.findByText(/examination has ended/i)).toBeInTheDocument();
    expect(again.container.textContent).not.toContain("Which keyword declares a class?");
  });

  it("says so when there is no saved copy to fall back on", async () => {
    online.value = false;
    api.getAcademyExamPaper.mockResolvedValue({
      data: null,
      error: { message: "Failed to fetch" },
    });
    render(<AcademyExamRunner exam={EXAM} />);
    fireEvent.click(
      await screen.findByRole("button", { name: /start examination/i }),
    );
    expect(
      await screen.findByText(/not been saved to this device/i),
    ).toBeInTheDocument();
  });
});
