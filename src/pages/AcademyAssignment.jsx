import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getAcademyAssignment,
  getAcademyCourseMaterials,
  getAcademyMaterialUrl,
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
import CppEditor from "../components/academy/CppEditor";
import ProtectedContent from "../components/academy/ProtectedContent";

function CodeEditorForAssignment({ assignment, onCaptureSource }) {
  const isCpp = assignment?.academy_courses?.language === "cpp";
  if (isCpp) {
    return (
      <CppEditor
        starterCode={assignment.starter_code || ""}
        onSubmit={onCaptureSource}
      />
    );
  }
  return (
    <PythonEditor
      starterCode={assignment.starter_code}
      onSubmit={onCaptureSource}
    />
  );
}

export default function AcademyAssignment() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAcademyAuth();
  const [assignment, setAssignment] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [state, setState] = useState("loading");
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState(null);
  const [sourceCode, setSourceCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [learningMaterial, setLearningMaterial] = useState(null);
  const [materialState, setMaterialState] = useState("loading");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [assignmentResult, draft] = await Promise.all([
        fetchWithOfflineFallback({
          userId: user.id,
          store: OFFLINE_STORES.assignments,
          id,
          fetcher: () => getAcademyAssignment(id, user.id),
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
        if (assignmentResult.error) {
          setNotice(
            navigator.onLine
              ? friendlyError(
                  assignmentResult.error,
                  "The assignment could not be loaded.",
                )
              : "This assignment is not available offline. Reconnect to load it.",
          );
        }
        return;
      }
      const [countResult, historyResult] = await Promise.all([
        getSubmissionCount(id, user.id),
        getAcademySubmissionHistory(id, user.id),
      ]);
      if (!mounted) return;
      setAttempts(countResult.count);
      setHistory(historyResult.data ?? []);
      if (assignmentResult.error) {
        setState("error");
        setNotice(
          friendlyError(
            assignmentResult.error,
            "The assignment could not be loaded.",
          ),
        );
        return;
      }
      setState(assignmentResult.configured ? "ready" : "unconfigured");
      const secondaryError = countResult.error || historyResult.error;
      if (secondaryError) {
        setNotice(
          friendlyError(
            secondaryError,
            "Submission history could not be loaded. You can still review the assignment.",
          ),
        );
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [id, user.id, reloadToken]);

  useEffect(() => {
    let mounted = true;
    const courseId =
      assignment?.course_id ?? assignment?.academy_courses?.id ?? null;
    if (!courseId) {
      setLearningMaterial(null);
      setMaterialState(assignment ? "missing" : "loading");
      return undefined;
    }

    setLearningMaterial(null);
    setMaterialState("loading");
    async function loadLearningMaterial() {
      try {
        const result = await getAcademyCourseMaterials(courseId);
        if (!mounted) return;
        if (result.error) {
          setMaterialState("unavailable");
          return;
        }
        const pdfs = (result.data ?? []).filter(
          (material) =>
            material.mime_type?.toLowerCase() === "application/pdf" ||
            /\.pdf$/i.test(
              material.original_filename || material.storage_path || "",
            ),
        );
        const material =
          pdfs.find(
            (item) =>
              assignment.lesson_id && item.lesson_id === assignment.lesson_id,
          ) ?? pdfs.find((item) => item.lesson_id === null);
        if (!material) {
          setMaterialState("missing");
          return;
        }

        const urlResult = await getAcademyMaterialUrl(material);
        if (!mounted) return;
        if (urlResult.error || !urlResult.data?.url) {
          setMaterialState("unavailable");
          return;
        }
        setLearningMaterial({ ...material, url: urlResult.data.url });
        setMaterialState("ready");
      } catch {
        if (mounted) setMaterialState("unavailable");
      }
    }
    void loadLearningMaterial();
    return () => {
      mounted = false;
    };
  }, [assignment]);

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
    const isSource =
      /\.(py|cpp|cc|cxx|h|hpp|ino)$/i.test(selected?.name || "");
    if (result.valid && selected && isSource) {
      setSourceCode(await selected.text());
    }
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
      const returnTo = searchParams.get("returnTo");
      if (
        returnTo?.startsWith("/academy/lessons/") &&
        !returnTo.startsWith("//")
      ) {
        navigate(returnTo, { replace: true });
      }
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
  if (state === "error")
    return (
      <div
        role="alert"
        className="space-y-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
      >
        <p>{notice || "The assignment could not be loaded. Please try again."}</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              setNotice("");
              setState("loading");
              setReloadToken((value) => value + 1);
            }}
          >
            Try again
          </button>
          <Link to="/academy/assignments" className="button-secondary inline-flex">
            Back to assignments
          </Link>
        </div>
      </div>
    );
  if (!assignment)
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          This assignment is not available for your active course. It may still
          be a draft, may belong to another course, or your course enrolment may
          need attention. Ask your teacher to check the assignment and your
          enrolment.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="button-primary"
            onClick={() => {
              setState("loading");
              setReloadToken((value) => value + 1);
            }}
          >
            Try again
          </button>
          <Link to="/academy/assignments" className="button-secondary inline-flex">
            Back to assignments
          </Link>
        </div>
      </div>
    );
  const attemptsRemaining = Math.max(0, assignment.retry_limit - attempts);

  const acceptAttribute = [
    ".py",
    ".ipynb",
    ".txt",
    ".md",
    ".csv",
    ".pdf",
    ".docx",
    ".zip",
    ".log",
    ".mp4",
    ".mov",
    ".webm",
    ".ogg",
    ".mp3",
    ".m4a",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".heic",
    ".heif",
    ...(assignment?.academy_courses?.language === "cpp"
      ? [".cpp", ".cc", ".cxx", ".h", ".hpp", ".ino"]
      : []),
  ].join(",");
  return (
    <div
      className={`mx-auto grid w-full items-start gap-6 ${
        learningMaterial
          ? "max-w-6xl xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]"
          : "max-w-3xl"
      }`}
    >
      <article className="min-w-0 space-y-6">
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
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Use the matching topic in your course PDF and the starter code below.
          Work with ideas already covered in your lessons; you do not need extra
          tools or advanced techniques.
        </p>
        <ProtectedContent className="mt-3 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
          {assignment.instructions}
        </ProtectedContent>
      </header>
      {materialState === "missing" && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          No matching course PDF is linked to this assignment yet. You can
          still work from the lesson and starter code.
        </p>
      )}
      {materialState === "unavailable" && (
        <p
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
        >
          The assignment is ready, but its course PDF could not be opened. Try
          again from the Materials page.
        </p>
      )}
      <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
        <p className="text-sm font-semibold">
          Attempts remaining: {attemptsRemaining}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Allowed:           {(assignment.allowed_submission_types || []).join(", ") || "Code or file"}
        </p>
      </div>
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
        >
          {notice}
        </p>
      )}
      <CodeEditorForAssignment
        assignment={assignment}
        onCaptureSource={setSourceCode}
      />
      <label className="label">
        Upload a file
        <input
          className="field"
          type="file"
          accept={acceptAttribute}
          onChange={handleFile}
        />
      </label>
      <p className="-mt-4 text-sm text-slate-500 dark:text-slate-400">
        Python, C++ (for C++ courses), documents, and images are supported.
        Files must be 5 MB or smaller and are removed 30 days after submission.
      </p>
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
      {learningMaterial && (
        <aside className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:sticky xl:top-6">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-300">
                Learning source
              </p>
              <h2 className="mt-1 font-bold">{learningMaterial.title}</h2>
            </div>
            <a
              href={learningMaterial.url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:border-cyan-500 dark:border-slate-700"
            >
              Open PDF
            </a>
          </div>
          <iframe
            title={`Course PDF: ${learningMaterial.title}`}
            src={learningMaterial.url}
            loading="lazy"
            className="h-[65vh] min-h-96 w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700"
          />
        </aside>
      )}
    </div>
  );
}
