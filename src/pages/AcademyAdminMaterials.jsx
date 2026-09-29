import { useEffect, useRef, useState } from "react";
import {
  deleteAcademyMaterial,
  getAcademyAdminMaterials,
  getAcademyMaterialUrl,
  replaceAcademyMaterialFile,
  saveAcademyMaterial,
  uploadAcademyMaterial,
  validateAcademyMaterialFile,
} from "../lib/academy";
import { friendlyError } from "../lib/utils";

const emptyMaterial = {
  id: "",
  course_id: "",
  lesson_id: "",
  title: "",
  storage_path: "",
  mime_type: "application/pdf",
  file_size_bytes: 0,
  published: false,
};

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export default function AcademyAdminMaterials() {
  const [data, setData] = useState({ courses: [], lessons: [], materials: [] });
  const [form, setForm] = useState(emptyMaterial);
  const [file, setFile] = useState(null);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const uploadRef = useRef(null);
  const replaceRef = useRef(null);

  async function load() {
    const result = await getAcademyAdminMaterials();
    setData(result.data ?? { courses: [], lessons: [], materials: [] });
    setState(result.error ? "error" : "ready");
  }

  useEffect(() => {
    load();
  }, []);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function resetForm() {
    setForm(emptyMaterial);
    setFile(null);
    if (uploadRef.current) uploadRef.current.value = "";
  }

  // Save metadata only. Used when editing an existing material without touching
  // its file, so the file is never needlessly re-uploaded.
  async function submit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!file) {
      const { error: saveError } = await saveAcademyMaterial(form);
      if (saveError) {
        setError(friendlyError(saveError, "Material could not be saved."));
        return;
      }
      setMessage("Material details saved.");
      resetForm();
      await load();
      return;
    }

    setBusy(true);
    const result = await uploadAcademyMaterial({
      file,
      course_id: form.course_id,
      lesson_id: form.lesson_id,
      title: form.title,
      published: form.published,
    });
    setBusy(false);
    if (result.error) {
      setError(friendlyError(result.error, "The file could not be uploaded."));
      return;
    }
    setMessage("Material uploaded.");
    resetForm();
    await load();
  }

  function editMaterial(material) {
    setMessage("");
    setError("");
    setForm({
      id: material.id,
      course_id: material.course_id || "",
      lesson_id: material.lesson_id || "",
      title: material.title,
      storage_path: material.storage_path,
      mime_type: material.mime_type,
      file_size_bytes: material.file_size_bytes,
      published: material.published,
    });
    setFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitReplacement(event) {
    event.preventDefault();
    if (!replaceTarget || !file) return;
    setMessage("");
    setError("");
    setBusy(true);
    const result = await replaceAcademyMaterialFile(replaceTarget.id, file);
    setBusy(false);
    setReplaceTarget(null);
    setFile(null);
    if (replaceRef.current) replaceRef.current.value = "";
    if (result.error) {
      setError(friendlyError(result.error, "The file could not be replaced."));
      return;
    }
    setMessage("File replaced. The material kept its original link.");
    await load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setMessage("");
    setError("");
    setBusy(true);
    const result = await deleteAcademyMaterial(deleteTarget.id);
    setBusy(false);
    setDeleteTarget(null);
    if (result.error) {
      setError(friendlyError(result.error, "The material could not be deleted."));
      return;
    }
    setMessage("Material deleted.");
    await load();
  }

  function chooseFile(event) {
    const chosen = event.target.files?.[0] ?? null;
    setError("");
    if (!chosen) {
      setFile(null);
      return;
    }
    const check = validateAcademyMaterialFile(chosen);
    if (!check.valid) {
      setError(check.error);
      event.target.value = "";
      setFile(null);
      return;
    }
    setFile(chosen);
    if (!form.title) {
      setForm((current) => ({
        ...current,
        title: chosen.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
        mime_type: chosen.type || "application/pdf",
        file_size_bytes: chosen.size,
      }));
    }
  }

  const replacementCheck = file ? validateAcademyMaterialFile(file) : null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Course materials</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Upload a file, replace the file on an existing material, or delete one.
          Replacing a file keeps the material link, so students who already opened
          it are not sent to a missing file.
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

      <form
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        onSubmit={submit}
      >
        <h2 className="text-xl font-bold">
          {form.id ? `Editing: ${form.title}` : "Upload a new material"}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="label">
            Course
            <select
              className="field"
              name="course_id"
              value={form.course_id}
              onChange={updateField}
            >
              <option value="">No course</option>
              {data.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Lesson
            <select
              className="field"
              name="lesson_id"
              value={form.lesson_id}
              onChange={updateField}
            >
              <option value="">No lesson</option>
              {data.lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title}
                </option>
              ))}
            </select>
          </label>
          <label className="label md:col-span-2">
            Title
            <input
              className="field"
              name="title"
              value={form.title}
              onChange={updateField}
              required
            />
          </label>
          <label className="label md:col-span-2">
            File
            <input
              ref={uploadRef}
              className="field"
              type="file"
              accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.zip"
              onChange={chooseFile}
            />
            <span className="text-xs text-slate-500">
              PDF, Word, text, image or zip, up to 25 MB.
              {form.id &&
                " Leave empty to save the details without changing the file."}
            </span>
          </label>
        </div>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input
            name="published"
            type="checkbox"
            checked={form.published}
            onChange={updateField}
          />
          Publish this material
        </label>
        <div className="flex w-fit items-center gap-3">
          <button className="button-primary" type="submit" disabled={busy}>
            {busy ? "Working..." : form.id ? "Save material" : "Upload material"}
          </button>
          {form.id && (
            <button
              className="button-secondary"
              type="button"
              onClick={resetForm}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Existing materials</h2>
        {state === "ready" && data.materials.length === 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No materials have been added yet.
          </p>
        )}
        {data.materials.map((material) => (
          <div
            key={material.id}
            className="flex flex-wrap items-center justify-between gap-4 border-l-4 border-cyan-400 bg-white p-5 shadow-sm dark:bg-slate-900"
          >
            <div className="min-w-0">
              <p className="font-bold">{material.title}</p>
              <p className="text-sm text-slate-500">
                {material.academy_courses?.title || "No course"} ·{" "}
                {material.academy_lessons?.title || "No lesson"}
              </p>
              <p className="mt-1 truncate text-xs text-slate-400">
                {material.original_filename || material.storage_path} ·{" "}
                {formatBytes(material.file_size_bytes)}
                {material.replaced_at ? " · replaced" : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold">
                {material.published ? "Published" : "Draft"}
              </span>
              <a
                className="button-ghost text-xs"
                href="#"
                onClick={async (event) => {
                  event.preventDefault();
                  const { data: signed, error: urlError } =
                    await getAcademyMaterialUrl(material);
                  if (urlError) {
                    setError(
                      friendlyError(urlError, "The file could not be opened."),
                    );
                    return;
                  }
                  window.open(signed.url, "_blank", "noopener");
                }}
              >
                Open
              </a>
              <button
                className="button-ghost text-xs"
                type="button"
                onClick={() => editMaterial(material)}
              >
                Edit
              </button>
              <button
                className="button-ghost text-xs"
                type="button"
                onClick={() => {
                  setError("");
                  setReplaceTarget(material);
                  setFile(null);
                  if (replaceRef.current) replaceRef.current.value = "";
                }}
              >
                Replace file
              </button>
              <button
                className="button-ghost text-xs text-rose-600"
                type="button"
                onClick={() => {
                  setError("");
                  setDeleteTarget(material);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>

      {replaceTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4">
          <form
            className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
            onSubmit={submitReplacement}
          >
            <h2 className="text-xl font-bold">Replace the file</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This swaps the file on <strong>{replaceTarget.title}</strong>. The
              material keeps its link, so students are not sent to a missing
              file, and the previous file is removed only once the new one is
              saved.
            </p>
            <label className="label">
              New file
              <input
                ref={replaceRef}
                className="field"
                type="file"
                accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.zip"
                onChange={chooseFile}
                required
              />
              {file && replacementCheck?.valid && (
                <span className="text-xs text-slate-500">
                  {file.name} · {formatBytes(file.size)}
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                className="button-primary"
                type="submit"
                disabled={!file || !replacementCheck?.valid || busy}
              >
                {busy ? "Replacing..." : "Replace file"}
              </button>
              <button
                className="button-secondary"
                type="button"
                onClick={() => {
                  setReplaceTarget(null);
                  setFile(null);
                  if (replaceRef.current) replaceRef.current.value = "";
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 className="text-xl font-bold">Delete this material?</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <strong>{deleteTarget.title}</strong> will be removed, and its file
              deleted from storage. Students will no longer see it. This cannot be
              undone.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                className="button-primary"
                type="button"
                disabled={busy}
                onClick={confirmDelete}
              >
                {busy ? "Deleting..." : "Yes, delete it"}
              </button>
              <button
                className="button-secondary"
                type="button"
                onClick={() => setDeleteTarget(null)}
              >
                Keep it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
