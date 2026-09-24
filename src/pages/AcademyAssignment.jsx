import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getAcademyAssignment,
  getSubmissionCount,
  getAcademySubmissionHistory,
  requestAcademyDeterministicGrading,
  submitAssignment,
} from "../lib/academy";
import { validateAcademyFile } from "../lib/academyFiles";
import { fetchWithOfflineFallback } from "../lib/academyOffline";
import { enqueueAcademyOperation } from "../lib/academySync";
import {
  deleteOfflineRecord,
  getOfflineRecord,
  OFFLINE_STORES,
  putOfflineRecord,
} from "../lib/offlineStore";
import { friendlyError } from "../lib/utils";
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
    let mounted = true;
    async function load() {
      const [assignmentResult, draft] = await Promise.all([
        fetchWithOfflineFallback({
          userId: user.id,
          store: OFFLINE_STORES.assignments,
          id,
          fetcher: () => getAcademyAssignment(id),
        }),
        getOfflineRecord(
          OFFLINE_STORES.drafts,
          user.id,
          `assignment:${id}:source`,
        ).catch(() => null),
      ]);
      if (!mounted) return;
      setAssignment(assignmentResult.data);
      setSourceCode(draft?.sourceCode || assignmentResult.data?.starter_code || "");
      if (assignmentResult.offline || !navigator.onLine) {
        setAttempts(0);
        setHistory([]);
        setState(assignmentResult.error ? "error" : "ready");
        return;
      }
      const [countResult, historyResult] = await Promise.all([
        getSubmissionCount(id, user.id),
        getAcademySubmissionHistory(id, user.id),
      ]);
      if (!mounted) return;
      setAttempts(countResult.count);
      setHistory(historyResult.data ?? []);
      setState(
        assignmentResult.error || countResult.error
          ? "error"
          : assignmentResult.configured
            ? "ready"
            : "unconfigured",
      );
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [id, user.id]);

  useEffect(() => {
    if (!assignment || !sourceCode) return undefined;
    const timer = window.setTimeout(() => {
      void putOfflineRecord(OFFLINE_STORES.drafts, user.id, `assignment:${id}:source`, {
        assignmentId: id,
        sourceCode,
        savedAt: new Date().toISOString(),
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [assignment, id, sourceCode, user.id]);

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
      if (!navigator.onLine) {
        const operationId =
          crypto.randomUUID?.() ||
          `assignment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await enqueueAcademyOperation(user.id, {
          operationId,
          type: "assignment_submission",
          payload: {
            assignmentId: assignment.id,
            studentId: user.id,
            attemptNumber: attempts + 1,
            sourceCode: source || null,
            file: file || null,
            originalFilename: file?.name || null,
            mimeType: file?.type || null,
            fileSizeBytes: file?.size || null,
            clientOperationId: operationId,
          },
        });
        await deleteOfflineRecord(
          OFFLINE_STORES.drafts,
          user.id,
          `assignment:${assignment.id}:source`,
        );
        setAttempts((value) => value + 1);
        setFile(null);
        setNotice(
          "Submission saved on this device. It will be submitted automatically when you reconnect.",
        );
        return;
      }
      let filePath = null;
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        filePath = `${user.id}/${assignment.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("assignment-submissions")
          .upload(filePath, file, { upsert: false });
        if (uploadError) throw uploadError;
      }
      const clientOperationId =
        crypto.randomUUID?.() ||
        `assignment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { error } = await submitAssignment({
        assignmentId: assignment.id,
        studentId: user.id,
        attemptNumber: attempts + 1,
        sourceCode: source || null,
        filePath,
        originalFilename: file?.name || null,
        mimeType: file?.type || null,
        fileSizeBytes: file?.size || null,
        clientOperationId,
      });
      if (error) throw error;
      const submitted = await getAcademySubmissionHistory(id, user.id);
      const submission = submitted.data?.[0];
      if (submission?.id) await requestAcademyDeterministicGrading(submission.id);
      setAttempts((value) => value + 1);
      const refreshed = await getAcademySubmissionHistory(id, user.id);
      setHistory(refreshed.data ?? []);
      setFile(null);
      await deleteOfflineRecord(
        OFFLINE_STORES.drafts,
        user.id,
        `assignment:${assignment.id}:source`,
      );
      setNotice("Submitted. Deterministic grading has started.");
    } catch (error) {
      if ((error?.message || "").toLowerCase().includes("network")) {
        const operationId =
          crypto.randomUUID?.() ||
          `assignment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await enqueueAcademyOperation(user.id, {
          operationId,
          type: "assignment_submission",
          payload: {
            assignmentId: assignment.id,
            studentId: user.id,
            attemptNumber: attempts + 1,
            sourceCode: source || null,
            file: file || null,
            originalFilename: file?.name || null,
            mimeType: file?.type || null,
            fileSizeBytes: file?.size || null,
            clientOperationId: operationId,
          },
        });
        setNotice(
          "Submission saved on this device. It will be submitted automatically when you reconnect.",
        );
      } else {
        setNotice(friendlyError(error, "Submission failed."));
      }
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
          Allowed:           {(assignment.allowed_submission_types || []).join(", ") || "Code or file"}
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
                  {submission.grading_error
                    ? ` · ${submission.grading_error}`
                    : ""}
                </span>
                <span>
                  {result?.final_score ?? "Awaiting grade"}
                  {result?.final_score != null ? "/100" : ""}
                </span>
              </div>
              {result && (
                <p className="mt-2 text-sm text-slate-500">
                  Tests: {result.passed_tests ?? 0}/{result.tests_total ?? 0}
                </p>
              )}
              {result?.teacher_feedback && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {result.teacher_feedback}
                </p>
              )}
              {result?.ai_feedback && (
                <p className="mt-2 text-sm text-cyan-700 dark:text-cyan-300">
                  AI feedback:{" "}
                  {typeof result.ai_feedback === "string"
                    ? result.ai_feedback
                    : result.ai_feedback.text ||
                      JSON.stringify(result.ai_feedback)}
                </p>
              )}
              {!result?.ai_feedback &&
                result?.ai_feedback_status &&
                result.ai_feedback_status !== "available" && (
                  <p className="mt-2 text-sm text-slate-500">
                    Supplemental AI feedback unavailable (
                    {result.ai_feedback_status}); the deterministic result
                    remains authoritative.
                  </p>
                )}
            </div>
          );
        })}
      </section>
    </article>
  );
}
