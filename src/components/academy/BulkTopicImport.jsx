import { useMemo, useState } from "react";
import {
  TOPIC_IMPORT_TEMPLATE,
  importLessons,
  parseTopicRows,
  validateLessonImport,
} from "../../lib/academyContent";

const SAMPLE = `title,objectives,lesson_number,points
"Loops and iteration","for loops|while loops",1,10
"Functions and scope","def|return|scope",2,15`;

export default function BulkTopicImport({ week, onImported, onCancel }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState({ rows: [], error: null });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const weekLessons = useMemo(
    () =>
      (preview?.rows ?? []).map((row) => (
        <li
          key={row.row_index}
          className="flex flex-col gap-1 rounded-lg border border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
        >
          <span className="text-sm font-medium">
            <span className="text-slate-400">#{row.row_index}</span>{" "}
            {row.title || (
              <em className="text-slate-500">No title</em>
            )}
          </span>
          {row.valid ? (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Ready, position {row.lesson_number}
            </span>
          ) : (
            <ul className="text-xs text-red-600 dark:text-red-400">
              {row.errors.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </li>
      )),
    [preview],
  );

  function handleParse() {
    setError("");
    setResult(null);
    const outcome = parseTopicRows(text);
    setParsed(outcome);
    setPreview(null);
  }

  async function handlePreview() {
    setBusy(true);
    setError("");
    setResult(null);
    const { data, error: failure } = await validateLessonImport(
      week.id,
      parsed.rows,
    );
    setBusy(false);
    if (failure) {
      setError(failure.message);
      return;
    }
    setPreview({ rows: data });
  }

  async function handleImport() {
    setBusy(true);
    setError("");
    const { data, error: failure } = await importLessons(week.id, parsed.rows);
    setBusy(false);
    if (failure) {
      setError(failure.message);
      return;
    }
    setResult(data);
    onImported?.(data);
  }

  const readyCount =
    preview?.rows.filter((row) => row.valid).length ?? 0;
  const blockedCount = (preview?.rows.length ?? 0) - readyCount;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
        Imported topics always land as <strong>drafts</strong>, so nothing reaches
        a student until you review it and publish.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="button-secondary"
          onClick={() => setText(SAMPLE)}
        >
          Use the example
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={downloadTemplate}
        >
          Download CSV template
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Accepts CSV, a JSON array, or Markdown headings with bullet lists.
        </p>
      </div>

      <label className="label">
        Paste your topics into {week.title}
        <textarea
          className="field min-h-48 font-mono text-xs"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setPreview(null);
            setResult(null);
          }}
          placeholder={TOPIC_IMPORT_TEMPLATE}
        />
      </label>

      {parsed.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {parsed.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="button-secondary"
          onClick={handleParse}
          disabled={!text.trim()}
        >
          Read topics
        </button>
        <button
          type="button"
          className="button-primary"
          onClick={handlePreview}
          disabled={busy || !parsed.rows.length}
        >
          {busy ? "Checking" : "Check before saving"}
        </button>
        <button
          type="button"
          className="button-primary"
          onClick={handleImport}
          disabled={busy || !readyCount}
        >
          {busy ? "Importing" : `Import ${readyCount || ""} as drafts`}
        </button>
        <button type="button" className="button-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {preview ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold">
            {readyCount} ready, {blockedCount} need attention. Nothing has been
            saved yet.
          </p>
          <ul className="space-y-2">{weekLessons}</ul>
        </div>
      ) : null}

      {result ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          Imported {result.inserted} topic{result.inserted === 1 ? "" : "s"} as
          drafts. {result.skipped} skipped.
        </p>
      ) : null}
    </div>
  );
}

function downloadTemplate() {
  const blob = new Blob([TOPIC_IMPORT_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ate-topics-template.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
