import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AcademyExamRunner from "../components/academy/AcademyExamRunner";
import {
  getAcademyAvailableExams,
  getAcademyExamHistory,
  getAcademyExamLiveAttempt,
} from "../lib/academy";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { friendlyError } from "../lib/utils";
import { settle, settleAll } from "../lib/settle";

const SUBMIT_REASONS = {
  student: "Handed in",
  timeout: "Time expired",
  admin: "Closed by staff",
};

// Section 5 wording, kept identical on every state so a student sees the same
// three messages the specification asks for.
function windowState(exam) {
  const now = Date.now();
  const start = exam.starts_at ? Date.parse(exam.starts_at) : null;
  const end = exam.ends_at ? Date.parse(exam.ends_at) : null;
  if (start && now < start) return "not_started";
  if (end && now > end) return "ended";
  return "open";
}

export default function AcademyExams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [exams, setExams] = useState([]);
  const [active, setActive] = useState(null);
  const [live, setLive] = useState({});
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const { online } = useNetworkStatus();

  const load = useCallback(async () => {
    // Never rejects, and always reaches a terminal state. This used to be a
    // Promise.all, so one failing call meant setState never ran, the page sat on
    // "Loading examinations..." for ever and showed no error at all, and the
    // auto refresh swallowed the rejection so nothing ever said otherwise. That
    // is the whole of the "loads and shows nothing until I refresh" report.
    const [result, past] = await settleAll([
      () => getAcademyAvailableExams(),
      () => getAcademyExamHistory(),
    ], []);

    setExams(result.data ?? []);
    setHistory(past.data ?? []);
    // The list decides the state, not the history. History failing is worth
    // saying, but it is not the page, and turning it into an error state would
    // blank a perfectly good list of papers over a secondary panel.
    const failed = result.error || past.error;
    setError(failed ? friendlyError(failed, "Tests could not be loaded.") : "");
    setState(result.error ? "error" : "ready");

    // A refresh mid exam should come back to the same paper, not a new attempt.
    // A failure here must not take the list down with it, so each one settles on
    // its own and a failed lookup just means that paper shows as not started.
    const exams = result.data ?? [];
    const entries = await Promise.all(
      exams.map((exam) =>
        settle(() => getAcademyExamLiveAttempt(exam.id), null).then((attempt) => [
          exam.id,
          attempt?.data ?? null,
        ]),
      ),
    );
    setLive(Object.fromEntries(entries));
    const requestedExamId = searchParams.get("exam");
    if (requestedExamId) {
      const requestedExam = exams.find((exam) => exam.id === requestedExamId);
      if (requestedExam) {
        setActive(requestedExam);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("exam");
        setSearchParams(nextParams, { replace: true });
      }
    }
  }, [searchParams, setSearchParams]);

  // Poll while visible; a brief app switch should not reset the student's view.
  useAutoRefresh(load, { interval: 120000 });

  if (active) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <button
          className="text-sm font-semibold text-blue-600"
          type="button"
          onClick={() => setActive(null)}
        >
          &larr; All tests
        </button>
        <AcademyExamRunner exam={active} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Tests</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Papers open at their scheduled time. The timer starts when you begin
          and is checked on the server, so refreshing or losing signal will not
          give you more time.
        </p>
      </header>

      {!online && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          You are offline. An examination you have already opened will keep
          working, and your answers will be sent when you reconnect.
        </p>
      )}

      {state === "loading" && (
        <p className="text-sm text-slate-500">Loading tests...</p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {state === "ready" && exams.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 sm:p-8">
          <h2 className="text-lg font-bold">No tests are available yet</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Published tests assigned to your class will appear here at their
            scheduled times. If you expected a test, ask your teacher to check
            the class assignment and your active class enrollment.
          </p>
        </div>
      )}

      {/*
        Paper you have already sat. Without this a released score was visible
        only in the moment after handing in, and unreachable from here on.
      */}
      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your attempts</h2>
          <ul className="space-y-3">
            {history.map((attempt) => (
              <li
                key={attempt.attempt_id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{attempt.exam_title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Attempt {attempt.attempt_number} ·{" "}
                      {attempt.submitted_at
                        ? new Date(attempt.submitted_at).toLocaleString()
                        : "Not yet submitted"}
                      {attempt.submit_reason
                        ? ` · ${SUBMIT_REASONS[attempt.submit_reason] ?? attempt.submit_reason}`
                        : ""}
                    </p>
                  </div>
                  {attempt.results_published && attempt.percentage !== null ? (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                        {attempt.percentage}%
                      </p>
                      <p className="text-xs text-slate-500">
                        {attempt.score} of {attempt.total_marks} marks
                      </p>
                    </div>
                  ) : (
                    <p className="max-w-xs text-sm text-slate-500">
                      {attempt.status === "in_progress"
                        ? "Still in progress."
                        : "Marked. Your teacher has not released this result yet."}
                    </p>
                  )}
                </div>
                {attempt.results_published && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {attempt.correct_count} correct, {attempt.incorrect_count}{" "}
                    wrong, {attempt.unanswered_count} left blank
                    {attempt.pass_mark !== null && attempt.pass_mark !== undefined
                      ? ` · pass mark ${attempt.pass_mark}%`
                      : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="space-y-3">
        {exams.map((exam) => {
          const status = windowState(exam);
          const inProgress = live[exam.id];
          return (
            <li
              key={exam.id}
              className="border-l-4 border-cyan-400 bg-white p-5 shadow-sm dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-slate-50">
                    {exam.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {exam.academy_subjects?.name || "No subject"}
                    {exam.academy_classes?.name
                      ? ` · ${exam.academy_classes.name}`
                      : ""}{" "}
                    · {exam.duration_minutes} minutes
                    {exam.starts_at
                      ? ` · opens ${new Date(exam.starts_at).toLocaleString()}`
                      : ""}
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {inProgress ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        Examination in progress
                      </span>
                    ) : status === "not_started" ? (
                      <span className="text-amber-700 dark:text-amber-400">
                        Examination has not started.
                      </span>
                    ) : status === "ended" ? (
                      <span className="text-slate-600 dark:text-slate-400">
                        Examination has ended.
                      </span>
                    ) : (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        Examination is now available.
                      </span>
                    )}
                  </p>
                </div>
                {(inProgress || status === "open") && (
                  <button
                    className="button-primary shrink-0"
                    type="button"
                    onClick={() => setActive(exam)}
                  >
                    {inProgress ? "Resume" : "Start examination"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
