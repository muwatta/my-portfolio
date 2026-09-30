import { useCallback, useEffect, useState } from "react";
import {
  getAcademyExamAttemptAnswers,
  getAcademyExamAttempts,
  getAcademyExams,
  publishAcademyExamResults,
} from "../lib/academy";
import { friendlyError } from "../lib/utils";

const STATUS_LABELS = {
  in_progress: "In progress",
  submitted: "Submitted",
  graded: "Graded",
};

const SUBMIT_REASONS = {
  student: "Handed in",
  timeout: "Time expired",
  admin: "Closed by staff",
};

function percent(value) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function submitReasonLabel(reason) {
  if (!reason) return null;
  const known = SUBMIT_REASONS[reason];
  return known ?? reason;
}

// An offline finish either arrives with no server submission time or with a
// client clock far from the server's. Either way the deadline was applied on
// replay rather than live, which is worth a teacher's eye.
function looksSyncedLate(attempt) {
  if (attempt.status === "in_progress") return false;
  if (!attempt.submitted_at) return true;
  if (!attempt.client_submitted_at) return false;
  return (
    Math.abs(
      Date.parse(attempt.client_submitted_at) - Date.parse(attempt.submitted_at),
    ) > 120000
  );
}

// A disabled button with no stated reason reads as a broken page, so the reason
// is computed in one place and shown next to the control.
function publishBlockReason(attempts, exam) {
  if (!exam) return "No examination is selected.";
  if (exam.status === "draft") {
    return "This paper is still a draft, so it cannot be sat or released.";
  }
  if (attempts.length === 0) {
    return "Nobody has sat this examination yet, so there is nothing to release.";
  }
  if (!attempts.some((attempt) => attempt.status !== "in_progress")) {
    return "Every attempt is still in progress. Nothing has been handed in yet.";
  }
  // Still open, so more attempts can land after publication. Publishing now
  // would release the marks of whoever happened to sit it first.
  if (exam.ends_at && Date.parse(exam.ends_at) > Date.now()) {
    return "The paper is still open. Releasing now would show the marks of whoever has sat it so far.";
  }
  return null;
}

export default function AcademyAdminExamResults() {
  const [exams, setExams] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [openAttempt, setOpenAttempt] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadExams = useCallback(async () => {
    setLoading(true);
    const result = await getAcademyExams();
    setExams(result.data ?? []);
    setLoading(false);
    if (result.error) {
      setError(friendlyError(result.error, "Examinations could not be loaded."));
    }
  }, []);

  const loadAttempts = useCallback(async (examId) => {
    if (!examId) {
      setAttempts([]);
      return;
    }
    const result = await getAcademyExamAttempts(examId);
    if (result.error) {
      setError(friendlyError(result.error, "Attempts could not be loaded."));
      setAttempts([]);
      return;
    }
    setAttempts(result.data ?? []);
  }, []);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  // Landing on this page with nothing chosen is a dead end, so open the first
  // exam that can actually have marks rather than making the teacher click.
  useEffect(() => {
    if (selectedId || exams.length === 0) return;
    const firstWithAttempts = exams.find((exam) => exam.status !== "draft");
    setSelectedId((firstWithAttempts ?? exams[0]).id);
  }, [exams, selectedId]);

  useEffect(() => {
    setOpenAttempt(null);
    setAnswers(null);
    setMessage("");
    setError("");
    loadAttempts(selectedId);
  }, [selectedId, loadAttempts]);

  async function togglePublish() {
    if (!selectedId) return;
    setMessage("");
    setError("");
    setBusy(true);
    const exam = exams.find((row) => row.id === selectedId);
    const release = !exam?.results_published;
    const result = await publishAcademyExamResults(selectedId, release);
    setBusy(false);
    if (result.error) {
      setError(friendlyError(result.error, "The results could not be updated."));
      return;
    }
    setMessage(
      release
        ? "Results released. Students can see their score from now on."
        : "Results withheld. Students see that their paper is marked but not the score.",
    );
    await loadExams();
  }

  async function openPaper(attempt) {
    setOpenAttempt(attempt);
    setAnswers(null);
    const result = await getAcademyExamAttemptAnswers(attempt.id);
    if (result.error) {
      setError(friendlyError(result.error, "This paper could not be opened."));
      return;
    }
    setAnswers(result.data ?? []);
  }

  const exam = exams.find((row) => row.id === selectedId) ?? null;
  const graded = attempts.filter((attempt) => attempt.status !== "in_progress");
  const published = Boolean(exam?.results_published);
  const average =
    graded.length > 0
      ? graded.reduce((total, attempt) => total + (percent(attempt.percentage) ?? 0), 0) /
        graded.length
      : null;
  // Withholding works on an already-published paper even when it is now closed,
  // so the block only applies to the act of releasing.
  const blockReason = published ? null : publishBlockReason(attempts, exam);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Examination results</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Every attempt on a paper, with the score the server already worked out.
          Nothing here re-grades anything. Results stay hidden from students
          until you release them, so a paper can be sat in full before anyone
          sees a mark.
        </p>
      </header>

      {loading && <p className="text-sm text-slate-500">Loading examinations...</p>}

      {!loading && exams.length === 0 && (
        <p className="text-sm text-slate-500">
          No examinations have been created yet.
        </p>
      )}

      {exams.length > 0 && (
        <>
          <div className="max-w-md">
            <label
              htmlFor="results-exam"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              Examination
            </label>
            <select
              id="results-exam"
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-900"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {exams.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title}
                  {row.status === "draft" ? " (draft)" : ""}
                </option>
              ))}
            </select>
          </div>

          {exam && (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Attempts
                </p>
                <p className="mt-1 text-2xl font-bold">{attempts.length}</p>
                <p className="text-xs text-slate-500">{graded.length} finished</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Class average
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {average === null ? "—" : `${average.toFixed(1)}%`}
                </p>
                <p className="text-xs text-slate-500">of finished attempts</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Pass mark
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {percent(exam.pass_mark) === null ? "—" : `${percent(exam.pass_mark)}%`}
                </p>
                <p className="text-xs text-slate-500">set on the paper</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Students
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {new Set(attempts.map((attempt) => attempt.student_id)).size}
                </p>
                <p className="text-xs text-slate-500">distinct</p>
              </div>
            </section>
          )}

          {exam && (
            <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {published
                      ? "Results are released to students."
                      : "Results are hidden from students."}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {blockReason
                      ? blockReason
                      : "Students see a confirmed submitted state either way; releasing adds the score."}
                  </p>
                </div>
                <button
                  type="button"
                  className={published ? "button-secondary" : "button-primary"}
                  onClick={togglePublish}
                  disabled={busy || blockReason !== null}
                >
                  {published ? "Withhold results" : "Release results"}
                </button>
              </div>
            </section>
          )}

          {message && (
            <p
              role="status"
              className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
            >
              {message}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
            >
              {error}
            </p>
          )}

          {selectedId && attempts.length === 0 && (
            <p className="text-sm text-slate-500">
              Nobody has sat this examination yet.
            </p>
          )}

          {attempts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <caption className="sr-only">
                  Attempts on this examination, highest score first
                </caption>
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                    <th scope="col" className="py-2 pr-3">Student</th>
                    <th scope="col" className="py-2 pr-3">Attempt</th>
                    <th scope="col" className="py-2 pr-3">State</th>
                    <th scope="col" className="py-2 pr-3">Score</th>
                    <th scope="col" className="py-2 pr-3">Correct</th>
                    <th scope="col" className="py-2 pr-3">Wrong</th>
                    <th scope="col" className="py-2 pr-3">Blank</th>
                    <th scope="col" className="py-2 pr-3">Finished</th>
                    <th scope="col" className="py-2">Paper</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((attempt) => {
                    const value = percent(attempt.percentage);
                    return (
                      <tr
                        key={attempt.id}
                        className="border-b border-slate-100 dark:border-slate-800/60"
                      >
                        <td className="py-2 pr-3 font-medium">
                          {attempt.student_name}
                        </td>
                        <td className="py-2 pr-3">#{attempt.attempt_number}</td>
                        <td className="py-2 pr-3">
                          {STATUS_LABELS[attempt.status] ?? attempt.status}
                        </td>
                        <td className="py-2 pr-3 font-semibold tabular-nums">
                          {value === null
                            ? "—"
                            : `${value}% (${attempt.score}/${attempt.total_marks})`}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">
                          {attempt.correct_count ?? "—"}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">
                          {attempt.incorrect_count ?? "—"}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">
                          {attempt.unanswered_count ?? "—"}
                        </td>
                        <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">
                          {attempt.submitted_at
                            ? new Date(attempt.submitted_at).toLocaleString()
                            : "Not yet"}
                          {submitReasonLabel(attempt.submit_reason)
                            ? ` · ${submitReasonLabel(attempt.submit_reason)}`
                            : ""}
                          {looksSyncedLate(attempt) && (
                            <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                              synced late
                            </span>
                          )}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            className="text-sm font-semibold text-blue-600 underline"
                            onClick={() =>
                              openAttempt?.id === attempt.id
                                ? setOpenAttempt(null)
                                : openPaper(attempt)
                            }
                          >
                            {openAttempt?.id === attempt.id ? "Close" : "Review"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {openAttempt && (
            <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h2 className="font-semibold">
                {openAttempt.student_name}, attempt #{openAttempt.attempt_number}
              </h2>
              {!answers && (
                <p className="mt-2 text-sm text-slate-500">Loading paper...</p>
              )}
              {answers && answers.length === 0 && (
                <p className="mt-2 text-sm text-slate-500">
                  This attempt has no recorded answers.
                </p>
              )}
              {answers && answers.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {answers.map((answer, position) => (
                    <li
                      key={answer.id}
                      className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-2 text-sm dark:border-slate-800/60"
                    >
                      <span className="font-semibold">Q{position + 1}</span>
                      <span
                        className={`rounded px-2 py-0.5 font-semibold ${
                          answer.selected_key === null
                            ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            : answer.is_correct
                              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
                              : "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200"
                        }`}
                      >
                        {answer.selected_key === null
                          ? "Left blank"
                          : `Chose ${answer.selected_key}`}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {answer.marks_awarded} mark
                        {Number(answer.marks_awarded) === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-slate-500">
                Chosen answers only. The key is on the paper, not here, so this
                stays a record of what was submitted.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
