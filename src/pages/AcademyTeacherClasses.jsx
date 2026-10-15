import { useEffect, useState } from "react";
import {
  getAcademyTeacherClasses,
  getAcademyTeacherCourses,
  saveAcademyClass,
} from "../lib/academy";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { friendlyError } from "../lib/utils";

export default function AcademyTeacherClasses() {
  const { isAdmin } = useAcademyAuth();
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({
    course_id: "",
    name: "",
    description: "",
  });
  const [state, setState] = useState("loading");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [classResult, courseResult] = await Promise.all([
      getAcademyTeacherClasses(),
      getAcademyTeacherCourses(),
    ]);
    setClasses(classResult.data ?? []);
    setCourses(courseResult.data ?? []);
    setState(classResult.error || courseResult.error ? "error" : "ready");
  }

  useEffect(() => {
    load();
  }, []);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    const { error } = await saveAcademyClass(form);
    setNotice(error ? friendlyError(error, "Class could not be created.") : "Class created.");
    if (!error) {
      setForm({ course_id: form.course_id, name: "", description: "" });
      await load();
    }
    setSaving(false);
  }

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          {isAdmin ? "Superadmin workspace" : "Teacher workspace"}
        </p>
        <h1 className="mt-2 text-3xl font-bold">Classes</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          {isAdmin
            ? "Review every class, its course, creator, and current student roster."
            : "Create classes and review their course, active learners, and roster."}
        </p>
      </header>
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          Classes could not be loaded.
        </p>
      )}
      {state === "loading" && (
        <p className="text-sm text-slate-500" role="status">
          Loading classes and courses...
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800"
        >
          {notice}
        </p>
      )}
      <form
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5"
        onSubmit={save}
      >
        <h2 className="font-bold">Create class</h2>
        <label className="label">
          Course
          <select
            className="field mt-1"
            required
            value={form.course_id}
            onChange={(event) =>
              setForm({ ...form, course_id: event.target.value })
            }
          >
            <option value="">Select a course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Class name
          <input
            className="field mt-1"
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label className="label">
          Description
          <textarea
            className="field mt-1"
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </label>
        <button
          className="button-primary w-full sm:w-fit"
          type="submit"
          disabled={saving || courses.length === 0}
        >
          {saving ? "Creating class..." : "Create class"}
        </button>
      </form>
      {state === "ready" && classes.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          No classes have been created yet.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {classes.map((classroom) => (
          <article
            key={classroom.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-lg font-bold">{classroom.name}</h2>
                <p className="mt-1 text-sm font-medium text-cyan-800 dark:text-cyan-200">
                  {classroom.academy_courses?.title || "Course not assigned"}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-cyan-50 px-3 py-1 text-sm font-semibold text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-100">
                {classroom.academy_class_members?.filter(
                (member) => member.status === "active",
                ).length || 0}{" "}
                active
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
              {classroom.description || "No description provided."}
            </p>
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">Class roster</h3>
                <span className="text-xs text-slate-500">
                  {classroom.academy_class_members?.filter(
                    (member) => member.status !== "active",
                  ).length || 0}{" "}
                  inactive
                </span>
              </div>
              {classroom.academy_class_members?.some(
                (member) => member.status === "active",
              ) ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {classroom.academy_class_members
                    .filter((member) => member.status === "active")
                    .map((member) => (
                      <li
                        key={member.student_id}
                        className="max-w-full break-words rounded-lg bg-slate-100 px-3 py-1.5 text-sm dark:bg-slate-800"
                      >
                        {member.academy_profiles?.display_name || "Unnamed learner"}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  No active learners are assigned to this class.
                </p>
              )}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Created{" "}
              {classroom.created_at
                ? new Date(classroom.created_at).toLocaleDateString()
                : "date unavailable"}
              {classroom.creator_name ? ` by ${classroom.creator_name}` : ""}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
