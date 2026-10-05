import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  academyExamCsvTemplate,
  archiveAcademyExamQuestion,
  getAcademyExamQuestions,
  getAcademyExamSubjects,
  importAcademyExamCsv,
  previewAcademyExamCsvImport,
  saveAcademyExamQuestion,
} from "../lib/academy";
import { friendlyError } from "../lib/utils";

const PAGE_SIZE = 25;
const DIFFICULTIES = ["easy", "medium", "hard"];

const emptyQuestion = {
  id: "",
  subject_id: "",
  topic: "",
  difficulty: "easy",
  question_type: "mcq",
  prompt: "",
  options: [
    { key: "A", label: "" },
    { key: "B", label: "" },
    { key: "C", label: "" },
    { key: "D", label: "" },
  ],
  correct_key: "A",
  marks: 1,
  status: "active",
};

export default function AcademyAdminQuestionBank() {
  const [subjects, setSubjects] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({
    subjectId: "",
    difficulty: "",
    questionType: "",
    search: "",
  });
  const [form, setForm] = useState(emptyQuestion);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // import
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState(null);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [importReport, setImportReport] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getAcademyExamQuestions({
      ...filters,
      page,
      pageSize: PAGE_SIZE,
    });
    setRows(result.data ?? []);
    setTotal(result.total ?? 0);
    setError(
      friendlyError(result.error, "Questions could not be loaded."),
    );
    setLoading(false);
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getAcademyExamSubjects().then(({ data }) => setSubjects(data ?? []));
  }, []);

  const optionCount =
    form.question_type === "true_false" ? 2 : form.options.length;

  const visibleOptions = useMemo(
    () => form.options.slice(0, optionCount),
    [form.options, optionCount],
  );

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!form.subject_id) return setError("Choose a subject.");
    if (!form.prompt.trim()) return setError("Enter the question.");

    const options = visibleOptions
      .map((option) => ({ key: option.key, label: option.label.trim() }))
      .filter((option) => option.label);
    if (options.length < 2) return setError("A question needs at least two options.");
    if (!options.some((option) => option.key === form.correct_key))
      return setError("Choose which option is correct.");

    setSaving(true);
    const result = await saveAcademyExamQuestion({ ...form, options });
    setSaving(false);
    if (result.error) {
      setError(friendlyError(result.error, "The question could not be saved."));
      return;
    }
    setMessage(form.id ? "Question updated." : "Question added to the bank.");
    setForm(emptyQuestion);
    await load();
  }

  async function edit(row) {
    setMessage("");
    setError("");
    const keys = (row.options ?? []).map((option) => option.key);
    const blanks = [0, 1, 2, 3].map((index) => ({
      key: String.fromCharCode(65 + index),
      label: "",
    }));
    setForm({
      ...emptyQuestion,
      ...row,
      options:
        row.question_type === "true_false"
          ? [
              { key: "A", label: "True" },
              { key: "B", label: "False" },
            ]
          : (row.options ?? []).length
            ? (row.options ?? []).map((option, index) => ({
                key: option.key ?? blanks[index].key,
                label: option.label ?? "",
              }))
            : keys.length
              ? keys.map((key, index) => ({ key, label: blanks[index].label }))
              : blanks,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function archive(row) {
    setMessage("");
    setError("");
    const result = await archiveAcademyExamQuestion(row.id);
    if (result.error) {
      setError(friendlyError(result.error, "The question could not be archived."));
      return;
    }
    setMessage("Question archived. It stays on any exam that already used it.");
    await load();
  }

  function readFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(null);
    setImportReport(null);
    setError("");
    setMessage("");
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result ?? "");
      setCsv(text);
      setMessage("");
      setPreview({ checking: true, rows: [] });
      const result = await previewAcademyExamCsvImport(text, {
        subjectId: filters.subjectId || null,
        allowDuplicates,
      });
      if (result.error) {
        setPreview(null);
        setError(
          friendlyError(result.error, "The file could not be read. Check the header row."),
        );
        return;
      }
      setPreview({
        rows: result.data ?? [],
        valid: (result.data ?? []).filter((row) => row.is_valid).length,
        invalid: (result.data ?? []).filter((row) => !row.is_valid).length,
      });
    };
    reader.readAsText(file);
  }

  async function runImport() {
    setImporting(true);
    setError("");
    const result = await importAcademyExamCsv(csv, {
      subjectId: filters.subjectId || null,
      allowDuplicates,
    });
    setImporting(false);
    if (result.error) {
      setError(friendlyError(result.error, "The questions could not be imported."));
      return;
    }
    setImportReport(result.data);
    setMessage(`${result.data.imported} question(s) imported.`);
    await load();
  }

  function downloadTemplate() {
    const blob = new Blob([academyExamCsvTemplate()], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "question_bank_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Question bank</h1>
          <Link
            to="/academy/admin/exams"
            className="button-secondary inline-flex"
          >
            Back to exam builder
          </Link>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Every examination is built from these questions, so they are kept
          separate from lesson practice. Editing a question here never changes a
          paper a student has already sat, because an exam keeps its own copy.
        </p>
      </header>

      {message && (
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-semibold text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      )}

      {/* ------------------------------------------------------------- editor */}
      <form
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        onSubmit={submit}
      >
        <h2 className="text-xl font-bold">
          {form.id ? "Edit question" : "Add a question"}
        </h2>

        <div className="grid gap-4 md:grid-cols-4">
          <label className="label">
            Subject
            <select
              className="field"
              value={form.subject_id}
              onChange={(event) =>
                setForm((c) => ({ ...c, subject_id: event.target.value }))
              }
              required
            >
              <option value="">Choose a subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Topic
            <input
              className="field"
              value={form.topic}
              onChange={(event) =>
                setForm((c) => ({ ...c, topic: event.target.value }))
              }
            />
          </label>
          <label className="label">
            Type
            <select
              className="field"
              value={form.question_type}
              onChange={(event) =>
                setForm((c) => ({
                  ...c,
                  question_type: event.target.value,
                  correct_key: "A",
                }))
              }
            >
              <option value="mcq">Multiple choice</option>
              <option value="true_false">True / False</option>
            </select>
          </label>
          <label className="label">
            Difficulty
            <select
              className="field"
              value={form.difficulty}
              onChange={(event) =>
                setForm((c) => ({ ...c, difficulty: event.target.value }))
              }
            >
              {DIFFICULTIES.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="label">
          Question
          <textarea
            className="field min-h-20 resize-y"
            value={form.prompt}
            onChange={(event) =>
              setForm((c) => ({ ...c, prompt: event.target.value }))
            }
            required
          />
        </label>

        <fieldset>
          <legend className="text-sm font-semibold">Options</legend>
          <p className="text-xs text-slate-500">
            {form.question_type === "true_false"
              ? "True or False. The correct answer is the one you pick below."
              : "Leave any unused option blank. Pick the correct answer below."}
          </p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {visibleOptions.map((option, index) => (
              <label key={option.key} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-sm font-bold text-slate-500">
                  {option.key}
                </span>
                <input
                  className="field"
                  value={option.label}
                  disabled={form.question_type === "true_false"}
                  onChange={(event) => {
                    const next = [...form.options];
                    next[index] = { ...option, label: event.target.value };
                    setForm((c) => ({ ...c, options: next }));
                  }}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="label">
            Correct answer
            <select
              className="field"
              value={form.correct_key}
              onChange={(event) =>
                setForm((c) => ({ ...c, correct_key: event.target.value }))
              }
            >
              {visibleOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.key}
                  {form.question_type === "true_false"
                    ? ` (${option.label})`
                    : option.label
                      ? ` (${option.label})`
                      : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Marks
            <input
              className="field"
              type="number"
              min="0.5"
              step="0.5"
              value={form.marks}
              onChange={(event) =>
                setForm((c) => ({ ...c, marks: event.target.value }))
              }
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="button-primary" type="submit" disabled={saving}>
            {saving ? "Saving..." : form.id ? "Save question" : "Add question"}
          </button>
          {form.id && (
            <button
              className="button-secondary"
              type="button"
              onClick={() => setForm(emptyQuestion)}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* ------------------------------------------------------------- import */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-bold">Import questions from a CSV</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Upload the file and every row is checked before anything is saved. You
          will see which rows are good and what is wrong with the rest, so you
          can fix the file and try again. Nothing is written until you press
          import.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="label flex-1 min-w-64">
            CSV file
            <input
              ref={fileRef}
              className="field"
              type="file"
              accept=".csv,text/csv"
              onChange={readFile}
            />
          </label>
          <button
            className="button-secondary"
            type="button"
            onClick={downloadTemplate}
          >
            Download CSV template
          </button>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowDuplicates}
            onChange={(event) => setAllowDuplicates(event.target.checked)}
          />
          Allow questions that already exist (normally they are skipped)
        </label>

        {preview && (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl bg-slate-50 p-3 text-sm font-semibold dark:bg-slate-800">
              {preview.checking
                ? "Checking the file..."
                : `${preview.rows.length} question(s) detected. ${preview.valid} ready, ${preview.invalid} with problems.`}
            </p>

            {!preview.checking && preview.invalid > 0 && (
              <ul className="space-y-1 text-sm text-rose-700 dark:text-rose-300">
                {preview.rows
                  .filter((row) => !row.is_valid)
                  .map((row) => (
                    <li key={row.row_number}>
                      Row {row.row_number}: {row.problems.join("; ")}
                    </li>
                  ))}
              </ul>
            )}

            {!preview.checking && (
              <button
                className="button-primary"
                type="button"
                disabled={importing || preview.valid === 0}
                onClick={runImport}
              >
                {importing
                  ? "Importing..."
                  : `Import ${preview.valid} question(s)`}
              </button>
            )}

            {importReport && importReport.problems?.length > 0 && (
              <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {importReport.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* --------------------------------------------------------------- list */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Questions in the bank</h2>

        <div className="grid gap-3 md:grid-cols-4">
          <label className="label">
            Search
            <input
              className="field"
              value={filters.search}
              onChange={(event) => {
                setPage(0);
                setFilters((c) => ({ ...c, search: event.target.value }));
              }}
            />
          </label>
          <label className="label">
            Subject
            <select
              className="field"
              value={filters.subjectId}
              onChange={(event) => {
                setPage(0);
                setFilters((c) => ({ ...c, subjectId: event.target.value }));
              }}
            >
              <option value="">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Difficulty
            <select
              className="field"
              value={filters.difficulty}
              onChange={(event) => {
                setPage(0);
                setFilters((c) => ({ ...c, difficulty: event.target.value }));
              }}
            >
              <option value="">Any</option>
              {DIFFICULTIES.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Type
            <select
              className="field"
              value={filters.questionType}
              onChange={(event) => {
                setPage(0);
                setFilters((c) => ({ ...c, questionType: event.target.value }));
              }}
            >
              <option value="">Any</option>
              <option value="mcq">Multiple choice</option>
              <option value="true_false">True / False</option>
            </select>
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading questions...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            No questions match these filters yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 border-l-4 border-cyan-400 bg-white p-4 dark:bg-slate-900"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {row.prompt}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.academy_subjects?.name || "No subject"} ·{" "}
                    {row.difficulty} · {row.question_type === "true_false" ? "True/False" : "MCQ"} ·{" "}
                    {row.marks} mark{row.marks === 1 ? "" : "s"}
                    {row.topic ? ` · ${row.topic}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3">
                  <button
                    className="button-ghost text-xs"
                    type="button"
                    onClick={() => edit(row)}
                  >
                    Edit
                  </button>
                  <button
                    className="button-ghost text-xs text-rose-600"
                    type="button"
                    onClick={() => archive(row)}
                  >
                    Archive
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <div className="flex items-center gap-3">
            <button
              className="button-secondary"
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <span className="text-sm text-slate-500">
              Page {page + 1} of {pages} ({total} questions)
            </span>
            <button
              className="button-secondary"
              type="button"
              disabled={page + 1 >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
