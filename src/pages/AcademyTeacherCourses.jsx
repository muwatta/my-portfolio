import { useEffect, useState } from "react";
import {
  getAcademyCourseOptions,
  getAcademyTeacherCourses,
  saveAcademyCourse,
} from "../lib/academy";

const emptyCourse = {
  id: "",
  slug: "",
  title: "",
  description: "",
  duration_weeks: 11,
  subject_id: "",
  published: false,
};

export default function AcademyTeacherCourses() {
  const [courses, setCourses] = useState([]);
  const [options, setOptions] = useState({ levels: [], subjects: [] });
  const [form, setForm] = useState(emptyCourse);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");

  async function load() {
    setState("loading");
    const [courseResult, optionResult] = await Promise.all([
      getAcademyTeacherCourses(),
      getAcademyCourseOptions(),
    ]);
    setCourses(courseResult.data ?? []);
    setOptions(optionResult.data ?? { levels: [], subjects: [] });
    setState(courseResult.error || optionResult.error ? "error" : "ready");
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
    const { error } = await saveAcademyCourse(form);
    if (error) {
      setMessage(error.message || "Course could not be saved.");
      return;
    }
    setMessage("Course saved.");
    setForm(emptyCourse);
    await load();
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Admin control center
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Courses</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Create and publish course-based learning paths. Lessons and weeks can
          be added after the course exists.
        </p>
      </header>
      {message && (
        <p
          role="status"
          className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100"
        >
          {message}
        </p>
      )}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          Course data could not be loaded. Confirm the Academy migrations are
          applied.
        </p>
      )}
      <form
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        onSubmit={submit}
      >
        <h2 className="text-xl font-bold">Create course</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="label">
            Title
            <input
              className="field"
              name="title"
              value={form.title}
              onChange={updateField}
              required
            />
          </label>
          <label className="label">
            Slug
            <input
              className="field"
              name="slug"
              value={form.slug}
              onChange={updateField}
              required
              pattern="[a-z0-9-]+"
            />
          </label>
          <label className="label">
            Subject
            <select
              className="field"
              name="subject_id"
              value={form.subject_id}
              onChange={updateField}
              required
            >
              <option value="">Select subject</option>
              {options.subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Duration in weeks
            <input
              className="field"
              name="duration_weeks"
              type="number"
              min="1"
              max="52"
              value={form.duration_weeks}
              onChange={updateField}
              required
            />
          </label>
        </div>
        <label className="label">
          Description
          <textarea
            className="field min-h-24"
            name="description"
            value={form.description}
            onChange={updateField}
            required
          />
        </label>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input
            name="published"
            type="checkbox"
            checked={form.published}
            onChange={updateField}
          />{" "}
          Publish this course
        </label>
        <button className="button-primary w-fit" type="submit">
          Save course
        </button>
      </form>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Existing courses</h2>
        {state === "ready" && courses.length === 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No courses have been created yet.
          </p>
        )}
        {courses.map((course) => (
          <div
            key={course.id}
            className="flex flex-wrap items-center justify-between gap-4 border-l-4 border-cyan-400 bg-white p-5 shadow-sm dark:bg-slate-900"
          >
            <div>
              <p className="font-bold">{course.title}</p>
              <p className="text-sm text-slate-500">
                {course.academy_subjects?.name || "No subject"} ·{" "}
                {course.course_family || "General"}
              </p>
            </div>
            <span className="text-sm font-semibold">
              {course.published ? "Published" : "Draft"}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
