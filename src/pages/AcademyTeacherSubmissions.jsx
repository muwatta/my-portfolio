import { useEffect, useState } from "react";
import {
  getAcademyTeacherSubmissions,
  gradeAcademySubmission,
  requestAcademyAiFeedback,
} from "../lib/academy";

export default function AcademyTeacherSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [state, setState] = useState("loading");
  const [notice, setNotice] = useState("");
  const [gradingId, setGradingId] = useState("");
  const [scores, setScores] = useState({});

  async function load() {
    setState("loading");
    const result = await getAcademyTeacherSubmissions();
    setSubmissions(result.data ?? []);
    setState(
      result.error ? "error" : result.configured ? "ready" : "unconfigured",
    );
  }

  useEffect(() => {
    load();
  }, []);

  async function grade(submission) {
    const form = scores[submission.id] ?? {};
    const objectiveScore = Number(form.objectiveScore);
    if (
      !Number.isFinite(objectiveScore) ||
      objectiveScore < 0 ||
      objectiveScore > 100
    ) {
      setNotice("Enter an objective score from 0 to 100.");
      return;
    }
    setGradingId(submission.id);
    setNotice("");
    const { error } = await gradeAcademySubmission({
      submissionId: submission.id,
      objectiveScore,
      finalScore: Number(form.finalScore || objectiveScore),
      teacherFeedback: form.teacherFeedback,
      aiFeedback: form.aiFeedback,
      aiFeedbackStatus: form.aiFeedback ? "available" : "disabled",
    });
    if (!error && !form.aiFeedback) {
      const aiResult = await requestAcademyAiFeedback(submission.id);
      setNotice(
        aiResult.error
          ? `Grade saved. AI feedback is unavailable: ${aiResult.error.message}`
          : `Grade saved. AI feedback status: ${aiResult.data?.ai_feedback_status ?? "unavailable"}.`,
      );
    } else {
      setNotice(
        error
          ? error.message
          : "Grade saved and the learner can now see the result.",
      );
    }
    setGradingId("");
    if (!error) await load();
  }

  function updateScore(id, field, value) {
    setScores((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  }

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Teacher workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold">Submission inbox</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Review learner attempts, record the deterministic score, and attach
          optional feedback.
        </p>
      </header>
      {state === "loading" && <p>Loading submissions...</p>}
      {state === "unconfigured" && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Connect Supabase to load submissions.
        </p>
      )}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          Submissions could not be loaded.
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800"
        >
          {notice}
        </p>
      )}
      {state === "ready" && submissions.length === 0 && (
        <p className="rounded-xl border border-dashed p-8 text-sm">
          No submissions are waiting for review.
        </p>
      )}
      <div className="space-y-4">
        {submissions.map((submission) => {
          const result = Array.isArray(submission.academy_submission_results)
            ? submission.academy_submission_results[0]
            : submission.academy_submission_results;
          const form = scores[submission.id] ?? {};
          return (
            <article
              key={submission.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">
                    {submission.academy_assignments?.title || "Assignment"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {submission.academy_profiles?.display_name || "Learner"} ·
                    attempt {submission.attempt_number} · {submission.status}
                  </p>
                </div>
                <span className="text-sm font-semibold">
                  {result?.final_score ?? "Ungraded"}
                  {result?.final_score != null ? "/100" : ""}
                </span>
              </div>
              {submission.source_code && (
                <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                  {submission.source_code}
                </pre>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-sm font-semibold">
                  Objective score
                  <input
                    className="field mt-1"
                    type="number"
                    min="0"
                    max="100"
                    value={form.objectiveScore ?? result?.objective_score ?? ""}
                    onChange={(event) =>
                      updateScore(
                        submission.id,
                        "objectiveScore",
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label className="text-sm font-semibold">
                  Final score
                  <input
                    className="field mt-1"
                    type="number"
                    min="0"
                    max="100"
                    value={form.finalScore ?? result?.final_score ?? ""}
                    onChange={(event) =>
                      updateScore(
                        submission.id,
                        "finalScore",
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label className="text-sm font-semibold">
                  Teacher feedback
                  <textarea
                    className="field mt-1 min-h-24"
                    value={
                      form.teacherFeedback ?? result?.teacher_feedback ?? ""
                    }
                    onChange={(event) =>
                      updateScore(
                        submission.id,
                        "teacherFeedback",
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label className="text-sm font-semibold">
                  Optional AI feedback
                  <textarea
                    className="field mt-1 min-h-24"
                    value={form.aiFeedback ?? result?.ai_feedback ?? ""}
                    onChange={(event) =>
                      updateScore(
                        submission.id,
                        "aiFeedback",
                        event.target.value,
                      )
                    }
                  />
                </label>
              </div>
              <button
                className="button-primary mt-4"
                type="button"
                disabled={gradingId === submission.id}
                onClick={() => grade(submission)}
              >
                {gradingId === submission.id ? "Saving..." : "Save grade"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
