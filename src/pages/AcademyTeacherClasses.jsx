import { useEffect, useState } from "react";
import {
  getAcademyTeacherClasses,
  getAcademyTeacherCourses,
  saveAcademyClass,
} from "../lib/academy";
import { friendlyError } from "../lib/utils";

export default function AcademyTeacherClasses() {
  const [classes, setClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({
    course_id: "",
    name: "",
    description: "",
  });
  const [state, setState] = useState("loading");
  const [notice, setNotice] = useState("");

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
    const { error } = await saveAcademyClass(form);
    setNotice(error ? friendlyError(error, "Class could not be created.") : "Class created.");
    if (!error) {
      setForm({ course_id: form.course_id, name: "", description: "" });
      await load();
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Teacher workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold">Classes</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Create cohorts and see their current membership.
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
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800"
        >
          {notice}
        </p>
      )}
      <form
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        onSubmit={save}
      >
        <h2 className="font-bold">Create class</h2>
        <select
          className="field"
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
        <input
          className="field"
          required
          placeholder="Class name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <textarea
          className="field"
          placeholder="Description"
          value={form.description}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
        />
        <button className="button-primary w-fit" type="submit">
          Create class
        </button>
      </form>
      <div className="grid gap-4 md:grid-cols-2">
        {classes.map((classroom) => (
          <article
            key={classroom.id}
            className="rounded-xl border border-slate-200 p-5 dark:border-slate-800"
          >
            <h2 className="font-bold">{classroom.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {classroom.academy_courses?.title || "Course"} ·{" "}
              {classroom.academy_class_members?.filter(
                (member) => member.status === "active",
              ).length || 0}{" "}
              active learners
            </p>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {classroom.description || "No description provided."}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
