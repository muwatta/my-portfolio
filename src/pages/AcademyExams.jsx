import { useCallback, useEffect, useState } from "react";
import AcademyExamRunner from "../components/academy/AcademyExamRunner";
import {
  getAcademyAvailableExams,
  getAcademyExamHistory,
  getAcademyExamLiveAttempt,
} from "../lib/academy";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { friendlyError } from "../lib/utils";

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
  const [exams, setExams] = useState([]);
  const [active, setActive] = useState(null);
  const [live, setLive] = useState({});
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const { online } = useNetworkStatus();

  const load = useCallback(async () => {
    const [result, past] = await Promise.all([
      getAcademyAvailableExams(),
      getAcademyExamHistory(),
    ]);
    setExams(result.data ?? []);
    setHistory(past.data ?? []);
    setError(friendlyError(result.error, "Examinations could not be loaded."));
    setState(result.error ? "error" : "ready");

    // A refresh mid exam should come back to the same paper, not a new attempt.
    const entries = await Promise.all(
      (result.data ?? []).map(async (exam) => {
        const attempt = await getAcademyExamLiveAttempt(exam.id);
        return [exam.id, attempt.data ?? null];
      }),
    );
    setLive(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (active) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <button
          className="text-sm font-semibold text-blue-600"
          type="button"
          onClick={() => setActive(null)}
        >
          &larr; All examinations
        </button>
        <AcademyExamRunner exam={active} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Examinations</h1>
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
        <p className="text-sm text-slate-500">Loading examinations...</p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {state === "ready" && exams.length === 0 && (
        <p className="text-sm text-slate-500">No examinations have been set yet.</p>
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
