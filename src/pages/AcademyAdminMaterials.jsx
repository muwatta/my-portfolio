import { useEffect, useState } from "react";
import { getAcademyAdminMaterials, saveAcademyMaterial } from "../lib/academy";
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

export default function AcademyAdminMaterials() {
  const [data, setData] = useState({ courses: [], lessons: [], materials: [] });
  const [form, setForm] = useState(emptyMaterial);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");

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

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    const { error } = await saveAcademyMaterial(form);
    if (error) {
      setMessage(friendlyError(error, "Material could not be saved."));
      return;
    }
    setMessage("Material saved.");
    setForm(emptyMaterial);
    await load();
  }

  function editMaterial(material) {
    setForm({
      id: material.id,
      course_id: material.course_id || "",
      lesson_id: material.lesson_id || "",
      title: material.title,
      storage_path: material.storage_path,
      mime_type: material.mime_type,
      file_size_bytes: material.file_size_bytes ?? 0,
      published: material.published,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Academy administration
        </p>
        <h1 className="mt-2 text-3xl font-bold">Materials</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Keep course and lesson resources organized and ready for publication.
        </p>
      </header>
      {message && (
        <p
          role="status"
          className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-900"
        >
          {message}
        </p>
      )}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          Material data could not be loaded. Confirm the Academy migrations are
          applied.
        </p>
      )}
      <form
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        onSubmit={submit}
      >
        <h2 className="text-xl font-bold">
          {form.id ? "Edit material" : "Create material"}
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
            Storage path
            <input
              className="field"
              name="storage_path"
              value={form.storage_path}
              onChange={updateField}
              required
            />
          </label>
          <label className="label">
            MIME type
            <input
              className="field"
              name="mime_type"
              value={form.mime_type}
              onChange={updateField}
            />
          </label>
          <label className="label">
            File size (bytes)
            <input
              className="field"
              name="file_size_bytes"
              type="number"
              min="0"
              value={form.file_size_bytes}
              onChange={updateField}
            />
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
          <button className="button-primary" type="submit">
            Save material
          </button>
          {form.id && (
            <button
              className="button-secondary"
              type="button"
              onClick={() => setForm(emptyMaterial)}
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
            <div>
              <p className="font-bold">{material.title}</p>
              <p className="text-sm text-slate-500">
                {(material.academy_courses?.title || "No course")} � {(material.academy_lessons?.title || "No lesson")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold">
              {material.published ? "Published" : "Draft"}
            </span>
            <button
              className="button-ghost text-xs"
              type="button"
              onClick={() => editMaterial(material)}
            >
              Edit
            </button>
          </div>
          </div>
        ))}
      </section>
    </div>
  );
}
