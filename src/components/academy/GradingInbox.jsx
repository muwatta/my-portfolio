import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getGradingFilters,
  getGradingQueue,
  getSubmissionFileUrl,
  normaliseRubric,
  publishResult,
  requestAiGradeSuggestion,
  reviewStateLabel,
  reviewSubmission,
} from "../../lib/academyGrading";
import { friendlyError } from "../../lib/utils";

const STATE_FILTERS = [
  { value: "", label: "Everything" },
  { value: "unreviewed", label: "Waiting to be graded" },
  { value: "reviewed", label: "Reviewed, not published" },
  { value: "published", label: "Published" },
];

// Grade fast: j and k move through the queue, Enter saves, and the next
// submission is already loaded so a teacher can work through a class in one
// sitting without touching the mouse.
export default function GradingInbox() {
  const [queue, setQueue] = useState([]);
  const [filters, setFilters] = useState({ courses: [], topics: [], students: [] });
  const [active, setActive] = useState({ courseId: "", topicId: "", studentId: "", reviewState: "" });
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [rubricMarks, setRubricMarks] = useState({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [loading, setLoading] = useState(true);

  const current = queue[index] ?? null;
  const rubric = useMemo(() => normaliseRubric(current?.rubric), [current]);

  const load = useCallback(async () => {
    const [inbox, options] = await Promise.all([
      getGradingQueue({
        courseId: active.courseId,
        topicId: active.topicId,
        studentId: active.studentId,
        reviewState: active.reviewState,
      }),
      getGradingFilters(),
    ]);
    setQueue(inbox.data ?? []);
    setFilters(options.data ?? { courses: [], topics: [], students: [] });
    setLoading(false);
    if (!inbox.error) setStatus("");
    else setStatus(friendlyError(inbox.error, "Could not load the queue."));
  }, [active]);

  useEffect(() => {
    load();
  }, [load]);

  // Load whatever the selected submission already has, so a teacher can carry
  // on rather than retyping a review.
  useEffect(() => {
    if (!current) return;
    setScore(current.teacher_score ?? "");
    setFeedback(current.teacher_feedback ?? "");
    const marks = {};
    const saved = current.rubric_feedback?.criteria;
    if (Array.isArray(saved)) {
      saved.forEach((entry, position) => {
        if (entry?.criterion) marks[entry.criterion] = entry.score ?? "";
        else if (position != null) marks[position] = entry?.score ?? "";
      });
    }
    setRubricMarks(marks);
  }, [current]);

  useEffect(() => {
    let cancelled = false;
    setFileUrl("");
    if (!current?.file_path) return undefined;
    getSubmissionFileUrl(current.file_path)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setStatus(friendlyError(error, "Could not open the submitted file."));
          return;
        }
        setFileUrl(data ?? "");
      })
      .catch((error) => {
        if (!cancelled)
          setStatus(friendlyError(error, "Could not open the submitted file."));
      });
    return () => {
      cancelled = true;
    };
  }, [current?.file_path]);

  const suggestGrade = useCallback(async () => {
    if (!current) return;
    setAiBusy(true);
    setStatus("");
    try {
      const { data, error } = await requestAiGradeSuggestion(
        current.submission_id,
      );
      if (error) {
        setStatus(
          friendlyError(error, "Could not generate an AI grade suggestion."),
        );
        return;
      }
      setScore(String(data.score));
      setFeedback(data.feedback);
      setStatus(
        `AI suggested ${data.score}/${current.max_score ?? 100}. Review the suggestion, then save and publish it when ready.`,
      );
    } catch (error) {
      setStatus(
        friendlyError(error, "Could not generate an AI grade suggestion."),
      );
    } finally {
      setAiBusy(false);
    }
  }, [current]);

  const move = useCallback(
    (delta) => {
      if (!queue.length) return;
      setIndex((value) => Math.min(Math.max(value + delta, 0), queue.length - 1));
    },
    [queue.length],
  );

  const save = useCallback(async () => {
    if (!current) return;
    const maximum = Number(current.max_score ?? 100);
    const numericScore = String(score).trim() ? Number(score) : Number.NaN;
    if (
      !Number.isFinite(numericScore) ||
      numericScore < 0 ||
      numericScore > maximum
    ) {
      setStatus(`Enter a mark from 0 to ${maximum}.`);
      return;
    }
    setBusy(true);
    const { error } = await reviewSubmission({
      submissionId: current.submission_id,
      score,
      feedback,
      rubricFeedback: rubric.length
        ? {
            criteria: rubric.map((criterion) => ({
              criterion: criterion.criterion,
              max: criterion.max,
              score: rubricMarks[criterion.criterion] ?? "",
            })),
          }
        : null,
    });
    setBusy(false);
    if (error) {
      setStatus(friendlyError(error, "Could not save this review."));
      return;
    }
    setStatus("Reviewed. Publish it when you are ready for the student to see it.");
    await load();
  }, [current, score, feedback, rubric, rubricMarks, load]);

  const publish = useCallback(async () => {
    if (!current) return;
    setBusy(true);
    const { error } = await publishResult(current.submission_id);
    setBusy(false);
    if (error) {
      setStatus(friendlyError(error, "Could not publish this mark."));
      return;
    }
    setStatus("Published. The student has been notified.");
    await load();
  }, [current, load]);

  // Keyboard grading. Ignored while typing so a teacher can write feedback
  // without the queue jumping underneath them.
  useEffect(() => {
    function onKeyDown(event) {
      const tag = event.target?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (typing) return;
      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      }
      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      }
      if (event.key === "Enter" && !busy) {
        event.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move, save, busy]);

  const topicOptions = filters.topics.filter(
    (topic) => !active.courseId || topic.academy_weeks?.academy_courses?.id === active.courseId,
  );

  if (loading) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">Loading the queue</p>;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="label">
          Course
          <select
            className="field"
            value={active.courseId}
            onChange={(event) => {
              setActive((value) => ({ ...value, courseId: event.target.value, topicId: "" }));
              setIndex(0);
            }}
          >
            <option value="">All courses</option>
            {filters.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>

        <label className="label">
          Topic
          <select
            className="field"
            value={active.topicId}
            onChange={(event) => {
              setActive((value) => ({ ...value, topicId: event.target.value }));
              setIndex(0);
            }}
          >
            <option value="">All topics</option>
            {topicOptions.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </select>
        </label>

        <label className="label">
          Student
          <select
            className="field"
            value={active.studentId}
            onChange={(event) => {
              setActive((value) => ({ ...value, studentId: event.target.value }));
              setIndex(0);
            }}
          >
            <option value="">All students</option>
            {filters.students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.display_name || student.id}
              </option>
            ))}
          </select>
        </label>

        <label className="label">
          State
          <select
            className="field"
            value={active.reviewState}
            onChange={(event) => {
              setActive((value) => ({ ...value, reviewState: event.target.value }));
              setIndex(0);
            }}
          >
            {STATE_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">
          {queue.length} submission{queue.length === 1 ? "" : "s"}
          {current ? ` · showing ${index + 1}` : ""}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          j / k to move, Enter to save
        </p>
      </div>

      {status ? (
        <p role="status" className="rounded-lg border border-cyan-300 bg-cyan-50 p-3 text-sm text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100">
          {status}
        </p>
      ) : null}

      {!current ? (
        <p className="rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
          Nothing here with these filters.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{current.assignment_title}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {current.student_name} · attempt {current.attempt_number} ·{" "}
                  {current.submitted_at
                    ? new Date(current.submitted_at).toLocaleString()
                    : "no timestamp"}
                </p>
                {current.lesson_title ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {current.course_title} · {current.lesson_title}
                  </p>
                ) : null}
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {reviewStateLabel(current.review_state)}
              </span>
            </div>

            {current.client_ran_tests ? (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                Their browser reported {current.client_passed} of{" "}
                {current.client_total} tests passing. The server did not run
                this, so treat it as a hint, not a mark.
              </p>
            ) : null}

            {current.grading_error ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                Automated grading reported: {current.grading_error}
              </p>
            ) : null}

            {current.source_code ? (
              <details className="mt-3">
                <summary className="min-h-11 cursor-pointer text-sm font-semibold text-blue-600 dark:text-blue-400">
                  Show the code they submitted
                </summary>
                <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                  {current.source_code}
                </pre>
              </details>
            ) : null}
            {current.original_filename ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <span>
                  Uploaded {current.original_filename}
                  {current.file_size_bytes
                    ? ` (${Math.round(current.file_size_bytes / 1024)} KB)`
                    : ""}
                  .
                </span>
                {fileUrl ? (
                  <a
                    className="font-semibold text-blue-600 underline dark:text-blue-400"
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open submitted file
                  </a>
                ) : current.file_path ? (
                  <span aria-live="polite">Preparing secure file link…</span>
                ) : null}
              </div>
            ) : null}
          </div>

          {rubric.length > 0 ? (
            <fieldset className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
              <legend className="px-1 text-sm font-semibold">Rubric</legend>
              <ul className="space-y-3">
                {rubric.map((criterion) => (
                  <li key={criterion.criterion} className="grid gap-2 sm:grid-cols-[1fr_8rem]">
                    <label className="text-sm">
                      {criterion.criterion}
                      {criterion.max ? (
                        <span className="block text-xs text-slate-500">
                          out of {criterion.max}
                        </span>
                      ) : null}
                    </label>
                    <input
                      className="field"
                      type="number"
                      min={0}
                      step="0.5"
                      value={rubricMarks[criterion.criterion] ?? ""}
                      onChange={(event) =>
                        setRubricMarks((value) => ({
                          ...value,
                          [criterion.criterion]: event.target.value,
                        }))
                      }
                    />
                  </li>
                ))}
              </ul>
            </fieldset>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <label className="label">
              Mark
              <input
                className="field"
                type="number"
                min={0}
                max={current.max_score ?? 100}
                step="0.5"
                value={score}
                onChange={(event) => setScore(event.target.value)}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                out of {current.max_score ?? 100}
              </span>
            </label>

            <label className="label">
              Feedback for the student
              <textarea
                className="field min-h-28"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="Say what went well and what to try next."
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="button-secondary"
              onClick={suggestGrade}
              disabled={busy || aiBusy}
            >
              {aiBusy ? "Generating AI suggestion…" : "Get AI grade suggestion"}
            </button>
            <button
              type="button"
              className="button-primary"
              onClick={save}
              disabled={busy}
            >
              {busy ? "Working" : "Save review"}
            </button>
            <button
              type="button"
              className="button-primary"
              onClick={publish}
              disabled={busy || !["reviewed", "published"].includes(current.review_state)}
              title={
                current.review_state === "reviewed" || current.review_state === "published"
                  ? undefined
                  : "Review it before publishing"
              }
            >
              Publish to student
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => move(-1)}
              disabled={index === 0}
            >
              Previous
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => move(1)}
              disabled={index >= queue.length - 1}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
