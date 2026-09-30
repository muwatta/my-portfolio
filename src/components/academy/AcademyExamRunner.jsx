import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAcademyExamPaper,
  getAcademyExamResult,
  saveAcademyExamAnswer,
  startAcademyExamAttempt,
  submitAcademyExamAttempt,
} from "../../lib/academy";
import {
  getOfflineRecord,
  getOfflineRecords,
  putOfflineRecord,
  OFFLINE_STORES,
} from "../../lib/offlineStore";
import { enqueueAcademyOperation } from "../../lib/academySync";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";
import { friendlyError } from "../../lib/utils";

// Save at most this long after an answer changes, so a student thinking for a
// moment does not produce a request, and one who taps through quickly still
// gets their work saved.
const SAVE_DEBOUNCE_MS = 700;

function formatRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function AcademyExamRunner({ exam }) {
  const { user } = useAcademyAuth();
  const [attempt, setAttempt] = useState(null);
  const [paper, setPaper] = useState([]);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(null);
  const [phase, setPhase] = useState("intro");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(0);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [stalePaper, setStalePaper] = useState(false);
  const [result, setResult] = useState(null);

  const timers = useRef({});
  const submitting = useRef(false);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const queueAnswer = useCallback(
    async (attemptId, questionId, key, answeredAt) => {
      if (!user?.id) return;
      await enqueueAcademyOperation(user.id, {
        type: "exam_answer",
        // The operation id carries the answer's own timestamp, so replaying the
        // same answer is a no-op rather than a second write.
        operationId: `exam-answer-${attemptId}-${questionId}-${answeredAt}`,
        payload: {
          attemptId,
          questionId,
          selectedKey: key,
          clientAnsweredAt: answeredAt,
        },
      });
    },
    [user?.id],
  );

  const countPending = useCallback(async () => {
    if (!user?.id || !attempt) return;
    const records = await getOfflineRecords(OFFLINE_STORES.syncQueue, user.id);
    setPending(
      records
        .map((record) => record.data)
        .filter(
          (operation) =>
            operation?.payload?.attemptId === attempt.id &&
            operation.status !== "done",
        ).length,
    );
  }, [user?.id, attempt]);

  // The questions are cached so a refresh, a closed tab or a dropped connection
  // can still show the paper. Without this the draft below is unreachable: a
  // student who reopens an exam with no signal would have their answers
  // restored and no questions to put them against.
  //
  // The cache is only a fallback, never the primary source, because the server
  // decides what a paper contains. A cached copy can only ever be what that same
  // attempt was already served, so it cannot show different questions, and it
  // carries no answer key, which never left the server in the first place.
  const loadPaper = useCallback(
    async (attemptId) => {
      const result = await getAcademyExamPaper(attemptId);
      if (!result.error) {
        setPaper(result.data ?? []);
        setStalePaper(false);
        if (user?.id) {
          await putOfflineRecord(
            OFFLINE_STORES.examPapers,
            user.id,
            attemptId,
            { questions: result.data ?? [], cachedAt: new Date().toISOString() },
          );
        }
        return;
      }

      // A refusal from the server is final. Falling back here would let a
      // student keep working on a paper they are no longer entitled to, for
      // example one whose window has closed.
      if (navigator.onLine) {
        setError(friendlyError(result.error, "The paper could not be loaded."));
        return;
      }

      if (!user?.id) return;
      const cached = await getOfflineRecord(
        OFFLINE_STORES.examPapers,
        user.id,
        attemptId,
      );
      const questions = cached?.data?.questions;
      if (!Array.isArray(questions) || questions.length === 0) {
        setError(
          "You are offline and this examination has not been saved to this device yet.",
        );
        return;
      }
      setPaper(questions);
      setStalePaper(true);
    },
    [user?.id],
  );

  const loadDraft = useCallback(
    async (attemptId) => {
      if (!user?.id) return;
      const record = await getOfflineRecord(
        OFFLINE_STORES.examDrafts,
        user.id,
        attemptId,
      );
      if (record?.data?.answers) setAnswers(record.data.answers);
    },
    [user?.id],
  );

  const saveDraft = useCallback(
    async (attemptId, next) => {
      if (!user?.id) return;
      await putOfflineRecord(OFFLINE_STORES.examDrafts, user.id, attemptId, {
        answers: next,
        savedAt: new Date().toISOString(),
      });
    },
    [user?.id],
  );

  // Counts down from the server's deadline. A refresh, a tab switch and a dropped
  // connection do not restart it, because the deadline is a timestamp the server
  // handed over rather than a count the browser keeps.
  useEffect(() => {
    if (!attempt?.deadline_at) return undefined;
    const tick = () => {
      const left = Date.parse(attempt.deadline_at) - Date.now();
      setRemaining(left);
      if (left <= 0 && !submitting.current) {
        submitting.current = true;
        // The server decides the reason: past its own deadline it records this
        // as an automatic submission, whatever the browser thinks.
        submitAcademyExamAttempt(
          attempt.id,
          "timeout",
          new Date().toISOString(),
        )
          .then(() => {
            setNotice("Time is up. Your examination was submitted for you.");
            setPhase("done");
          })
          .catch(() => {
            // Offline at the deadline. The queue replays it on reconnect and the
            // server still marks it as timed out, so a lost connection is not
            // treated as anything the student did.
            if (user?.id) {
              void enqueueAcademyOperation(user.id, {
                type: "exam_submit",
                operationId: `exam-submit-${attempt.id}`,
                payload: {
                  attemptId: attempt.id,
                  reason: "timeout",
                  clientSubmittedAt: new Date().toISOString(),
                },
              });
            }
            setNotice(
              "Time is up. We will submit your work as soon as you are back online.",
            );
            setPhase("done");
          });
      }
    };
    tick();
    const handle = setInterval(tick, 1000);
    return () => clearInterval(handle);
  }, [attempt, user?.id]);

  // One request per settled change, not one per tap.
  const choose = useCallback(
    (questionId, key) => {
      if (!attempt) return;
      const answeredAt = new Date().toISOString();
      const next = { ...answers, [questionId]: { key, answeredAt } };
      setAnswers(next);
      void saveDraft(attempt.id, next);

      clearTimeout(timers.current[questionId]);
      timers.current[questionId] = setTimeout(async () => {
        if (navigator.onLine) {
          const result = await saveAcademyExamAnswer(
            attempt.id,
            questionId,
            key,
            answeredAt,
          );
          if (result.error) {
            await queueAnswer(attempt.id, questionId, key, answeredAt);
          }
        } else {
          await queueAnswer(attempt.id, questionId, key, answeredAt);
        }
        void countPending();
      }, SAVE_DEBOUNCE_MS);
    },
    [answers, attempt, saveDraft, countPending, queueAnswer],
  );

  // Anything still in the debounce window when the page goes away is queued
  // rather than lost, which is the point of the draft in IndexedDB.
  useEffect(() => {
    const flush = () => {
      if (!attempt || !user?.id) return;
      Object.entries(timers.current).forEach(([questionId, handle]) => {
        clearTimeout(handle);
        const entry = answers[questionId];
        if (entry) {
          void queueAnswer(attempt.id, questionId, entry.key, entry.answeredAt);
        }
      });
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [answers, attempt, user?.id, queueAnswer]);

  async function start() {
    setError("");
    setNotice("");
    const result = await startAcademyExamAttempt(exam.id);
    if (result.error) {
      setError(friendlyError(result.error, "The examination could not be started."));
      return;
    }
    setAttempt(result.data);
    setPhase("running");
    await loadPaper(result.data.id);
    await loadDraft(result.data.id);
  }

  async function submit() {
    if (!attempt || submitting.current) return;
    submitting.current = true;
    setError("");
    const clientSubmittedAt = new Date().toISOString();

    // Whatever is still in the debounce window goes out with the paper.
    Object.entries(timers.current).forEach(([questionId, handle]) => {
      clearTimeout(handle);
      const entry = answers[questionId];
      if (entry) {
        void saveAcademyExamAnswer(
          attempt.id,
          questionId,
          entry.key,
          entry.answeredAt,
        );
      }
    });

    if (navigator.onLine) {
      const result = await submitAcademyExamAttempt(
        attempt.id,
        "student",
        clientSubmittedAt,
      );
      if (result.error) {
        submitting.current = false;
        setError(friendlyError(result.error, "Your work could not be submitted."));
        return;
      }
    } else if (user?.id) {
      await enqueueAcademyOperation(user.id, {
        type: "exam_submit",
        operationId: `exam-submit-${attempt.id}`,
        payload: {
          attemptId: attempt.id,
          reason: "student",
          clientSubmittedAt,
        },
      });
    }

    setNotice("Your examination has been submitted successfully.");
    setPhase("done");
    void countPending();
  }

  useEffect(() => {
    if (phase !== "done" || !attempt) return;
    getAcademyExamResult(attempt.id).then(({ data }) => {
      if (data) setResult(data);
    });
  }, [phase, attempt]);

  const current = paper[index];
  const answeredCount = useMemo(
    () => paper.filter((question) => answers[question.question_id]).length,
    [paper, answers],
  );

  if (phase === "done") {
    return (
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-bold">
          {notice || "Your examination has been submitted successfully."}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your teacher will review it. Results appear here once published.
        </p>
        {pending > 0 && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {pending} answer(s) are still waiting to send. They go as soon as you
            are back online, and the deadline is applied on the server, not here.
          </p>
        )}
        {result?.results_published ? (
          <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
            <p className="text-3xl font-bold text-emerald-800 dark:text-emerald-200">
              {result.percentage}%
            </p>
            <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-100">
              {result.score} of {result.total_marks} marks · {result.correct}{" "}
              correct, {result.incorrect} wrong, {result.unanswered} unanswered
            </p>
          </div>
        ) : (
          result && (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Your result is ready but your teacher has not published it yet, so
              there is nothing to show. That is deliberate, not a delay.
            </p>
          )
        )}
      </section>
    );
  }

  if (phase === "intro") {
    return (
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-bold">{exam.title}</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500">Time allowed</dt>
            <dd className="font-semibold">{exam.duration_minutes} minutes</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Attempts allowed</dt>
            <dd className="font-semibold">{exam.max_attempts}</dd>
          </div>
        </dl>
        {exam.instructions && (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {exam.instructions}
          </p>
        )}
        <p className="text-sm text-slate-600 dark:text-slate-300">
          The timer starts the moment you begin and does not stop for a lost
          connection. Answers save as you go, so you can refresh safely.
        </p>
        {notice && (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            {notice}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <button className="button-primary" type="button" onClick={start}>
          Start examination
        </button>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-4 rounded-2xl border border-rose-300 bg-rose-50 p-6 dark:border-rose-800 dark:bg-rose-950/30">
        <h2 className="text-xl font-bold">This paper will not open</h2>
        <p role="alert" className="text-sm text-rose-900 dark:text-rose-200">
          {error}
        </p>
        <button className="button-secondary" type="button" onClick={start}>
          Try again
        </button>
      </section>
    );
  }

  if (!current) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-600">
          Loading your questions...
          {offline ? " You are offline." : ""}
        </p>
      </section>
    );
  }

  const chosen = answers[current.question_id]?.key;
  const urgent = remaining !== null && remaining < 60000;

  return (
    <div className="space-y-4">
      <header
        className={`sticky top-0 z-10 rounded-2xl p-4 text-white shadow-lg ${
          urgent ? "bg-rose-600" : "bg-slate-900"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{exam.title}</p>
            <p className="text-xs text-slate-300">
              Question {index + 1} of {paper.length} · {answeredCount} answered
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-300">
              Time remaining
            </p>
            <p className="text-2xl font-bold tabular-nums">
              {remaining === null ? "--:--" : formatRemaining(remaining)}
            </p>
          </div>
        </div>
        {offline && (
          <p className="mt-2 text-xs text-amber-200">
            You are offline. Keep going, your answers are saved here and sent when
            you reconnect.
            {pending > 0 ? ` ${pending} waiting to send.` : ""}
          </p>
        )}
        {/*
          Only reachable when the paper came off this device. The deadline is
          still the server's, so the countdown is right, but the student should
          know the questions on screen are a saved copy rather than a fresh copy.
        */}
        {stalePaper && (
          <p className="mt-2 text-xs text-amber-200">
            Working from a saved copy of this paper. The time left is still set
            by the server, so it is accurate.
          </p>
        )}
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {current.prompt}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {current.marks} mark{current.marks === 1 ? "" : "s"}
        </p>

        <div className="mt-4 space-y-2">
          {(current.options ?? []).map((option) => {
            const active = chosen === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => choose(current.question_id, option.key)}
                aria-pressed={active}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-base ${
                  active
                    ? "border-cyan-500 bg-cyan-50 font-semibold dark:bg-cyan-950/40"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-sm font-bold">
                  {active ? (
                    <span aria-hidden="true">&#10003;</span>
                  ) : (
                    option.key
                  )}
                </span>
                <span className="min-w-0">{option.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            className="button-secondary"
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
          >
            Previous
          </button>
          {index < paper.length - 1 ? (
            <button
              className="button-primary"
              type="button"
              onClick={() =>
                setIndex((value) => Math.min(paper.length - 1, value + 1))
              }
            >
              Next
            </button>
          ) : (
            <button
              className="button-primary"
              type="button"
              onClick={submit}
              disabled={submitting.current}
            >
              Submit examination
            </button>
          )}
        </div>
      </section>

      <nav aria-label="Question navigation" className="flex flex-wrap gap-2">
        {paper.map((question, position) => {
          const isAnswered = Boolean(answers[question.question_id]);
          const isCurrent = position === index;
          return (
            <button
              key={question.question_id}
              type="button"
              onClick={() => setIndex(position)}
              aria-current={isCurrent ? "true" : undefined}
              aria-label={`Question ${position + 1}${isAnswered ? ", answered" : ", not answered"}`}
              className={`grid h-11 w-11 place-items-center rounded-lg border-2 text-sm font-semibold ${
                isCurrent
                  ? "border-cyan-600 bg-cyan-600 text-white"
                  : isAnswered
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-slate-200 text-slate-500 dark:border-slate-700"
              }`}
            >
              {position + 1}
            </button>
          );
        })}
      </nav>

      <p className="text-center text-sm text-slate-600 dark:text-slate-300">
        You have answered {answeredCount} of {paper.length} questions.
        {answeredCount < paper.length &&
          ` ${paper.length - answeredCount} question(s) are unanswered.`}
      </p>
    </div>
  );
}
