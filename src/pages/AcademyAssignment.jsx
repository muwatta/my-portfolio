import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getAcademyAssignment,
  getSubmissionCount,
  getAcademySubmissionHistory,
  submitAssignment,
} from "../lib/academy";
import { validateAcademyFile } from "../lib/academyFiles";
import { supabase } from "../lib/supabase";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import PythonEditor from "../components/academy/PythonEditor";

export default function AcademyAssignment() {
  const { id } = useParams();
  const { user } = useAcademyAuth();
  const [assignment, setAssignment] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [state, setState] = useState("loading");
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState(null);
  const [sourceCode, setSourceCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    Promise.all([
      getAcademyAssignment(id),
      getSubmissionCount(id, user.id),
      getAcademySubmissionHistory(id, user.id),
    ]).then(([assignmentResult, countResult, historyResult]) => {
      setAssignment(assignmentResult.data);
      setSourceCode(assignmentResult.data?.starter_code || "");
      setAttempts(countResult.count);
      setHistory(historyResult.data ?? []);
      setState(
        assignmentResult.error || countResult.error
          ? "error"
          : assignmentResult.configured
            ? "ready"
            : "unconfigured",
      );
    });
  }, [id, user.id]);

  async function handleFile(event) {
    const selected = event.target.files?.[0] || null;
    const result = validateAcademyFile(selected);
    setNotice(result.valid ? "" : result.error);
    setFile(result.valid ? selected : null);
    if (result.valid && selected.name.toLowerCase().endsWith(".py"))
      setSourceCode(await selected.text());
  }

  async function submit(source = sourceCode) {
    if (!assignment || attempts >= assignment.retry_limit)
      return setNotice("No attempts remaining.");
    setSubmitting(true);
    setNotice("");
    try {
      let filePath = null;
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        filePath = `${user.id}/${assignment.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("assignment-submissions")
          .upload(filePath, file, { upsert: false });
        if (uploadError) throw uploadError;
      }
      const { error } = await submitAssignment({
        assignmentId: assignment.id,
        studentId: user.id,
        attemptNumber: attempts + 1,
        sourceCode: source || null,
        filePath,
        originalFilename: file?.name || null,
        mimeType: file?.type || null,
        fileSizeBytes: file?.size || null,
      });
      if (error) throw error;
      setAttempts((value) => value + 1);
      const refreshed = await getAcademySubmissionHistory(id, user.id);
      setHistory(refreshed.data ?? []);
      setFile(null);
      setNotice("Submitted. Your work is recorded for review.");
    } catch (error) {
      setNotice(error.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "loading") return <p>Loading assignment...</p>;
  if (state === "unconfigured")
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Connect Supabase to load this assignment.
      </p>
    );
  if (state === "error" || !assignment)
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
      >
        This assignment is unavailable.
      </p>
    );
  const attemptsRemaining = Math.max(0, assignment.retry_limit - attempts);
  return (
    <article className="max-w-3xl space-y-6">
      <Link
        to="/academy/assignments"
        className="text-sm font-semibold text-blue-600"
      >
        ← All assignments
      </Link>
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          {assignment.points} points
        </p>
        <h1 className="mt-2 text-3xl font-bold">{assignment.title}</h1>
        <p className="mt-3 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
          {assignment.instructions}
        </p>
      </header>
      <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
        <p className="text-sm font-semibold">
          Attempts remaining: {attemptsRemaining}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Allowed: {assignment.allowed_submission_types.join(", ")}
        </p>
      </div>
      <PythonEditor
        starterCode={assignment.starter_code}
        onSubmit={setSourceCode}
      />
      <label className="label">
        Upload a file
        <input
          className="field"
          type="file"
          accept=".py,.ipynb,.txt,.md,.csv,.pdf,.docx"
          onChange={handleFile}
        />
      </label>
      {file && <p className="text-sm text-slate-500">Selected: {file.name}</p>}
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800"
        >
          {notice}
        </p>
      )}
      <button
        className="button-primary"
        type="button"
        disabled={submitting || attemptsRemaining === 0}
        onClick={() => submit()}
      >
        {submitting ? "Submitting..." : "Submit assignment"}
      </button>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Submission results</h2>
        {history.length === 0 && (
          <p className="text-sm text-slate-500">No submissions yet.</p>
        )}
        {history.map((submission) => {
          const result = Array.isArray(submission.academy_submission_results)
            ? submission.academy_submission_results[0]
            : submission.academy_submission_results;
          return (
            <div
              key={submission.id}
              className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
            >
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span>
                  Attempt {submission.attempt_number} · {submission.status}
                </span>
                <span>
                  {result?.final_score ?? "Awaiting grade"}
                  {result?.final_score != null ? "/100" : ""}
                </span>
              </div>
              {result?.teacher_feedback && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {result.teacher_feedback}
                </p>
              )}
              {result?.ai_feedback && (
                <p className="mt-2 text-sm text-cyan-700 dark:text-cyan-300">
                  AI feedback: {result.ai_feedback}
                </p>
              )}
            </div>
          );
        })}
      </section>
    </article>
  );
}
