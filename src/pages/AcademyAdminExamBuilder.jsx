import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  addAcademyExamQuestion,
  createAcademyExam,
  fillAcademyExamFromMix,
  getAcademyExamQuestions,
  getAcademyExamQuestionsInExam,
  getAcademyExamSubjects,
  getAcademyExams,
  getAcademyTeacherClasses,
  publishAcademyExam,
  removeAcademyExamQuestion,
  validateAcademyExam,
} from "../lib/academy";
import { friendlyError } from "../lib/utils";
import AdminLoadError from "../components/academy/AdminLoadError";

const DIFFICULTIES = ["easy", "medium", "hard"];
const TYPES = ["mcq", "true_false"];

const emptyExam = {
  title: "",
  subject_id: "",
  class_id: "",
  instructions: "",
  duration_minutes: 20,
  starts_at: "",
  ends_at: "",
  pass_mark: "",
  results_release_mode: "manual",
  randomize_questions: false,
  randomize_options: false,
  allow_early_submit: true,
  max_attempts: 1,
};

const emptyMix = {
  easy: 0,
  medium: 0,
  hard: 0,
  types: { mcq: 0, true_false: 0 },
  useTypes: false,
  topic: "",
};

export default function AcademyAdminExamBuilder() {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(emptyExam);
  const [mix, setMix] = useState(emptyMix);
  const [inExam, setInExam] = useState([]);
  const [problems, setProblems] = useState([]);
  const [bank, setBank] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [examLoading, setExamLoading] = useState(true);
  const [examLoadError, setExamLoadError] = useState("");
  const [contentsLoading, setContentsLoading] = useState(false);
  const [contentsLoadError, setContentsLoadError] = useState("");
  const [bankLoading, setBankLoading] = useState(true);
  const [bankLoadError, setBankLoadError] = useState("");

  const selected = exams.find((exam) => exam.id === selectedId) ?? null;
  const isDraft = selected?.status === "draft";
  const examContentsReady = !contentsLoading && !contentsLoadError;

  const loadExams = useCallback(async () => {
    setExamLoading(true);
    setExamLoadError("");
    try {
      const result = await getAcademyExams();
      if (result.error) {
        setExams([]);
        setExamLoadError(
          friendlyError(result.error, "Examinations could not be loaded."),
        );
        return;
      }
      setExams(result.data ?? []);
    } catch (loadError) {
      setExams([]);
      setExamLoadError(
        friendlyError(loadError, "Examinations could not be loaded."),
      );
    } finally {
      setExamLoading(false);
    }
  }, []);

  const loadExamContents = useCallback(async (examId) => {
    if (!examId) {
      setInExam([]);
      setProblems([]);
      setContentsLoadError("");
      setContentsLoading(false);
      return;
    }
    setContentsLoading(true);
    setContentsLoadError("");
    try {
      const [paper, issues] = await Promise.all([
        getAcademyExamQuestionsInExam(examId),
        validateAcademyExam(examId),
      ]);
      const failure = paper.error || issues.error;
      if (failure) {
        setInExam([]);
        setProblems([]);
        setContentsLoadError(
          friendlyError(
            failure,
            "Questions for this examination could not be loaded.",
          ),
        );
        return;
      }
      setInExam(paper.data ?? []);
      setProblems(issues.data ?? []);
    } catch (loadError) {
      setInExam([]);
      setProblems([]);
      setContentsLoadError(
        friendlyError(
          loadError,
          "Questions for this examination could not be loaded.",
        ),
      );
    } finally {
      setContentsLoading(false);
    }
  }, []);

  useEffect(() => {
    getAcademyExamSubjects()
      .then(({ data, error: loadError }) => {
        if (loadError) {
          setError(friendlyError(loadError, "Subjects could not be loaded."));
          return;
        }
        setSubjects(data ?? []);
      })
      .catch((loadError) =>
        setError(friendlyError(loadError, "Subjects could not be loaded.")),
      );
    getAcademyTeacherClasses()
      .then(({ data, error: loadError }) => {
        if (loadError) {
          setError(friendlyError(loadError, "Classes could not be loaded."));
          return;
        }
        setClasses(data ?? []);
      })
      .catch((loadError) =>
        setError(friendlyError(loadError, "Classes could not be loaded.")),
      );
    loadExams();
  }, [loadExams]);

  useEffect(() => {
    loadExamContents(selectedId);
  }, [selectedId, loadExamContents]);

  const loadBank = useCallback(async () => {
    setBankLoading(true);
    setBankLoadError("");
    try {
      const result = await getAcademyExamQuestions({
        pageSize: 50,
        search: "",
      });
      if (result.error) {
        setBank([]);
        setBankLoadError(
          friendlyError(result.error, "Questions could not be loaded."),
        );
        return;
      }
      setBank(result.data ?? []);
    } catch (loadError) {
      setBank([]);
      setBankLoadError(
        friendlyError(loadError, "Questions could not be loaded."),
      );
    } finally {
      setBankLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBank();
  }, [loadBank]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function create(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);
    const result = await createAcademyExam(form);
    setBusy(false);
    if (result.error) {
      setError(friendlyError(result.error, "The examination could not be created."));
      return;
    }
    setMessage(`"${form.title}" created as a draft. Add questions, then publish.`);
    setForm(emptyExam);
    await loadExams();
    if (result.data?.id) setSelectedId(result.data.id);
  }

  async function addOne(questionId) {
    if (!selectedId) return;
    setMessage("");
    setError("");
    const result = await addAcademyExamQuestion(selectedId, questionId);
    if (result.error) {
      setError(friendlyError(result.error, "That question was not added."));
      return;
    }
    setMessage("Question added.");
    await loadExamContents(selectedId);
  }

  async function removeOne(questionId) {
    if (!selectedId) return;
    const result = await removeAcademyExamQuestion(selectedId, questionId);
    if (result.error) {
      setError(friendlyError(result.error, "That question was not removed."));
      return;
    }
    await loadExamContents(selectedId);
  }

  async function autoFill() {
    if (!selectedId) return;
    setMessage("");
    setError("");
    setBusy(true);
    const result = await fillAcademyExamFromMix(selectedId, {
      difficulties: {
        easy: Number(mix.easy) || 0,
        medium: Number(mix.medium) || 0,
        hard: Number(mix.hard) || 0,
      },
      types: mix.useTypes
        ? {
            mcq: Number(mix.types.mcq) || 0,
            true_false: Number(mix.types.true_false) || 0,
          }
        : null,
      subject_id: form.subject_id || selected?.subject_id || null,
      topic: mix.topic || null,
    });
    setBusy(false);
    if (result.error) {
      setError(friendlyError(result.error, "Questions could not be added automatically."));
      return;
    }
    const short = result.data.short_by;
    setMessage(
      short
        ? `${result.data.added} question(s) added, but the bank could not fill: ${short}`
        : `${result.data.added} question(s) added from the bank.`,
    );
    await loadExamContents(selectedId);
  }

  async function publish() {
    if (!selectedId) return;
    setMessage("");
    setError("");
    setBusy(true);
    const result = await publishAcademyExam(selectedId);
    setBusy(false);
    if (result.error) {
      setError(friendlyError(result.error, "This examination is not ready to publish."));
      await loadExamContents(selectedId);
      return;
    }
    setMessage("Published. Students can take it from its start time.");
    await loadExams();
    await loadExamContents(selectedId);
  }

  function optionLabel(options, key) {
    const found = (options ?? []).find((option) => option.key === key);
    return found ? found.label : key;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Exam builder</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          One engine for every subject. The difference between a Python paper and
          a Robotics paper is the configuration here, not a different page.
        </p>
        <Link
          to="/academy/admin/question-bank"
          className="button-secondary mt-4 inline-flex"
        >
          Upload a test CSV in the question bank
        </Link>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Import a spreadsheet of MCQ and True/False questions there, then return
          here to add or automatically select up to 50 questions for this paper.
        </p>
      </header>

      {message && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <p>{message}</p>
          {/* Publishing is only the first half of the job. Without this the
              teacher has finished building and then has to go and find the
              results page by name to release anything. */}
          {selectedId && (
            <p className="mt-2 font-normal">
              <Link
                to={`/academy/admin/exam-results?exam=${selectedId}`}
                className="underline"
              >
                Go to the mark sheet for this examination
              </Link>
            </p>
          )}
        </div>
      )}
      {error && (
        <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-semibold text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      )}
      {examLoadError && (
        <AdminLoadError
          title="Examinations could not be loaded"
          message={examLoadError}
          onRetry={loadExams}
          retrying={examLoading}
        />
      )}

      {/* ------------------------------------------------------------ create */}
      <form
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        onSubmit={create}
      >
        <h2 className="text-xl font-bold">New examination</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="label md:col-span-2">
            Title
            <input
              className="field"
              value={form.title}
              onChange={(event) => update("title", event.target.value)}
              required
            />
          </label>
          <label className="label">
            Subject
            <select
              className="field"
              value={form.subject_id}
              onChange={(event) => update("subject_id", event.target.value)}
            >
              <option value="">No subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Student class
            <select
              className="field"
              value={form.class_id}
              onChange={(event) => update("class_id", event.target.value)}
              required
            >
              <option value="">Choose the class that will take this test</option>
              {classes.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                  {classroom.academy_courses?.title
                    ? ` · ${classroom.academy_courses.title}`
                    : ""}
                </option>
              ))}
            </select>
            {classes.length === 0 && (
              <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                Create a class and enrol its students before publishing a test.
              </span>
            )}
          </label>
          <label className="label">
            Duration in minutes
            <input
              className="field"
              type="number"
              min="1"
              max="600"
              value={form.duration_minutes}
              onChange={(event) => update("duration_minutes", event.target.value)}
              required
            />
          </label>
          <label className="label">
            Starts at
            <input
              className="field"
              type="datetime-local"
              value={form.starts_at}
              onChange={(event) => update("starts_at", event.target.value)}
              required
            />
          </label>
          <label className="label">
            Closes at
            <input
              className="field"
              type="datetime-local"
              value={form.ends_at}
              onChange={(event) => update("ends_at", event.target.value)}
              required
            />
          </label>
          <label className="label">
            Pass mark (%)
            <input
              className="field"
              type="number"
              min="0"
              max="100"
              value={form.pass_mark}
              onChange={(event) => update("pass_mark", event.target.value)}
            />
          </label>
        </div>
        <label className="label">
          Instructions for students
          <textarea
            className="field min-h-20 resize-y"
            value={form.instructions}
            onChange={(event) => update("instructions", event.target.value)}
          />
        </label>
        <label className="label max-w-xl">
          Results release
          <select
            className="field"
            value={form.results_release_mode}
            onChange={(event) =>
              update("results_release_mode", event.target.value)
            }
          >
            <option value="manual">
              Hold scores until staff release them
            </option>
            <option value="immediate">
              Release each score immediately after submission
            </option>
          </select>
        </label>
        <div className="flex flex-wrap gap-4 text-sm">
          {[
            ["randomize_questions", "Randomise question order"],
            ["randomize_options", "Randomise answer options"],
            ["allow_early_submit", "Allow early submission"],
          ].map(([field, label]) => (
            <label key={field} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(form[field])}
                onChange={(event) => update(field, event.target.checked)}
              />
              {label}
            </label>
          ))}
          <label className="flex items-center gap-2">
            Attempts allowed
            <input
              className="field w-20"
              type="number"
              min="1"
              max="20"
              value={form.max_attempts}
              onChange={(event) => update("max_attempts", event.target.value)}
            />
          </label>
        </div>
        <button
          className="button-primary"
          type="submit"
          disabled={busy || examLoading || Boolean(examLoadError)}
        >
          Create draft
        </button>
        {examLoadError && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Load the examination list before creating a draft, so existing
            papers are not accidentally duplicated.
          </p>
        )}
      </form>

      {/* ------------------------------------------------------------- list */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Examinations</h2>
        {examLoading ? (
          <p className="text-sm text-slate-500" role="status" aria-live="polite">
            Loading examinations...
          </p>
        ) : examLoadError ? (
          <p className="text-sm text-slate-500">
            The examination list is unavailable until it can be loaded.
          </p>
        ) : exams.length === 0 ? (
          <p className="text-sm text-slate-500">No examinations yet.</p>
        ) : (
          <ul className="space-y-2">
            {exams.map((exam) => (
              <li key={exam.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(exam.id)}
                  className={`flex w-full flex-wrap items-center justify-between gap-3 border-l-4 p-4 text-left ${
                    selectedId === exam.id
                      ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30"
                      : "border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900"
                  }`}
                >
                  <span>
                    <span className="font-semibold">{exam.title}</span>
                    <span className="ml-2 text-sm text-slate-500">
                      {exam.academy_subjects?.name || "No subject"} ·{" "}
                      {exam.duration_minutes} min
                      {exam.starts_at
                        ? ` · ${new Date(exam.starts_at).toLocaleString()}`
                        : ""}
                    </span>
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {exam.status}
                    {exam.results_published ? " · results out" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <>
          {/* ------------------------------------------------- auto select */}
          {isDraft && (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-xl font-bold">Build it automatically</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Ask for a mix and the bank is drawn to match. If the bank cannot
                fill it, you are told which pool was short rather than being
                given a paper that quietly turned into something else.
              </p>
              <div className="grid gap-4 md:grid-cols-4">
                {DIFFICULTIES.map((level) => (
                  <label key={level} className="label">
                    {level} questions
                    <input
                      className="field"
                      type="number"
                      min="0"
                      max="100"
                      value={mix[level]}
                      onChange={(event) =>
                        setMix((c) => ({ ...c, [level]: event.target.value }))
                      }
                    />
                  </label>
                ))}
                <label className="label md:col-span-2">
                  Topic (optional)
                  <input
                    className="field"
                    value={mix.topic}
                    onChange={(event) =>
                      setMix((c) => ({ ...c, topic: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={mix.useTypes}
                  onChange={(event) =>
                    setMix((c) => ({ ...c, useTypes: event.target.checked }))
                  }
                />
                Split by question type
              </label>
              {mix.useTypes && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {TYPES.map((type) => (
                    <label key={type} className="label">
                      {type === "mcq" ? "Multiple choice" : "True / False"} (per
                      difficulty)
                      <input
                        className="field"
                        type="number"
                        min="0"
                        max="100"
                        value={mix.types[type]}
                        onChange={(event) =>
                          setMix((c) => ({
                            ...c,
                            types: { ...c.types, [type]: event.target.value },
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
              <button
                className="button-primary"
                type="button"
                onClick={autoFill}
                disabled={busy || bankLoading || Boolean(bankLoadError)}
              >
                {busy ? "Working..." : "Add matching questions"}
              </button>
            </section>
          )}

          {/* ------------------------------------------------------ contents */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">
                Questions in this exam
                {examContentsReady ? ` (${inExam.length})` : ""}
              </h2>
              {isDraft && (
                <button
                  className="button-primary"
                  type="button"
                  onClick={publish}
                  disabled={busy || contentsLoading || Boolean(contentsLoadError)}
                >
                  Validate and publish
                </button>
              )}
            </div>

            {contentsLoading && (
              <p
                className="text-sm text-slate-500"
                role="status"
                aria-live="polite"
              >
                Loading this examination's questions...
              </p>
            )}
            {contentsLoadError && (
              <AdminLoadError
                title="Questions for this examination could not be loaded"
                message={contentsLoadError}
                onRetry={() => loadExamContents(selectedId)}
                retrying={contentsLoading}
              />
            )}

            {examContentsReady && problems.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
                {problems.map((problem, index) => (
                  <li key={`${problem.problem}-${index}`}>
                    <strong>{problem.problem}</strong> — {problem.detail}
                  </li>
                ))}
              </ul>
            )}
            {examContentsReady &&
              problems.length === 0 &&
              inExam.length > 0 && (
              <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                Everything checks out. This exam is ready to publish.
              </p>
            )}

            {examContentsReady &&
              (inExam.length === 0 ? (
              <p className="text-sm text-slate-500">
                No questions yet. Add them from the bank below, or use the
                automatic builder.
              </p>
            ) : (
              <ol className="space-y-2">
                {inExam.map((item) => (
                  <li
                    key={item.question_id}
                    className="border-l-4 border-cyan-400 bg-white p-4 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                          {item.question_position}. {item.prompt}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.question_type === "true_false"
                            ? "True / False"
                            : "Multiple choice"}{" "}
                          · {item.difficulty} · answer{" "}
                          <strong>{item.correct_key}</strong>{" "}
                          ({optionLabel(item.options, item.correct_key)})
                        </p>
                      </div>
                      {isDraft && (
                        <button
                          className="button-ghost text-xs text-rose-600"
                          type="button"
                          onClick={() => removeOne(item.question_id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                  ))}
              </ol>
            ))}
          </section>

          {/* --------------------------------------------------------- bank */}
          {isDraft && (
            <section className="space-y-3">
              <h2 className="text-xl font-bold">Add from the question bank</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Options are always re-lettered A, B, C, D on the way in, and a
                true/false becomes A True, B False. Whichever letters a question
                was written with, the answer follows the option rather than
                staying on the old letter.
              </p>
              {bankLoading && (
                <p className="text-sm text-slate-500" role="status">
                  Loading the question bank...
                </p>
              )}
              {bankLoadError && (
                <AdminLoadError
                  title="Questions could not be loaded"
                  message={bankLoadError}
                  onRetry={loadBank}
                  retrying={bankLoading}
                />
              )}
              {!bankLoading && !bankLoadError && bank.length === 0 && (
                <p className="text-sm text-slate-500">
                  The question bank is empty. Add questions in the{" "}
                  <Link
                    to="/academy/admin/question-bank"
                    className="font-semibold text-blue-700 underline dark:text-cyan-300"
                  >
                    question bank
                  </Link>{" "}
                  or import a CSV.
                </p>
              )}
              {!bankLoading && !bankLoadError && bank.length > 0 && (
                <ul className="space-y-2">
                  {bank.map((question) => {
                    const already = inExam.some(
                      (item) => item.question_id === question.id,
                    );
                    return (
                      <li
                        key={question.id}
                        className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            {question.prompt}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {question.academy_subjects?.name || "No subject"} ·{" "}
                            {question.difficulty} ·{" "}
                            {question.question_type === "true_false"
                              ? "True/False"
                              : "MCQ"}
                          </p>
                        </div>
                        <button
                          className="button-secondary shrink-0"
                          type="button"
                          disabled={already}
                          onClick={() => addOne(question.id)}
                        >
                          {already ? "Already in" : "Add"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
