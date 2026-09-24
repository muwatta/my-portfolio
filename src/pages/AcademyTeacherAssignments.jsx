import { useEffect, useState } from "react";
import {
  getAcademyTeacherAssignments,
  getAcademyTeacherCourses,
  saveAcademyAssignment,
} from "../lib/academy";
import { friendlyError } from "../lib/utils";

const initialForm = {
  course_id: "",
  title: "",
  instructions: "",
  points: 10,
  retry_limit: 3,
  published: false,
  ai_feedback_enabled: true,
  automated_tests: "[]",
};

export default function AcademyTeacherAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [state, setState] = useState("loading");
  const [notice, setNotice] = useState("");

  async function load() {
    setState("loading");
    const [assignmentResult, courseResult] = await Promise.all([
      getAcademyTeacherAssignments(),
      getAcademyTeacherCourses(),
    ]);
    setAssignments(assignmentResult.data ?? []);
    setCourses(courseResult.data ?? []);
    setState(assignmentResult.error || courseResult.error ? "error" : "ready");
  }

  useEffect(() => {
    load();
  }, []);

  async function save(event) {
    event.preventDefault();
    setNotice("");
    const { error } = await saveAcademyAssignment(form);
    setNotice(
      error ? friendlyError(error, "Assignment could not be saved.") : "Assignment saved.",
    );
    if (!error) {
      setForm({ ...initialForm, course_id: form.course_id });
      await load();
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Teacher workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold">Assignments</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Author, publish, and control retry limits for course assignments.
        </p>
      </header>
      {state === "loading" && <p>Loading assignments...</p>}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          Assignments could not be loaded.
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
        <h2 className="font-bold">Create assignment</h2>
        <label className="text-sm font-semibold">
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
        <label className="text-sm font-semibold">
          Title
          <input
            className="field mt-1"
            required
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
          />
        </label>
        <label className="text-sm font-semibold">
          Instructions
          <textarea
            className="field mt-1 min-h-28"
            required
            value={form.instructions}
            onChange={(event) =>
              setForm({ ...form, instructions: event.target.value })
            }
          />
        </label>
        <label className="text-sm font-semibold">
          Deterministic tests (JSON)
          <textarea
            className="field mt-1 min-h-32 font-mono text-xs"
            value={form.automated_tests}
            onChange={(event) =>
              setForm({ ...form, automated_tests: event.target.value })
            }
            placeholder={'[{"name":"normal values","input":[10,20,30],"expected":20}]'}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Hidden expected values are used by the trusted grading executor and
            are never shown to students.
          </span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Points
            <input
              className="field mt-1"
              type="number"
              min="1"
              value={form.points}
              onChange={(event) =>
                setForm({ ...form, points: event.target.value })
              }
            />
          </label>
          <label className="text-sm font-semibold">
            Retry limit
            <input
              className="field mt-1"
              type="number"
              min="0"
              value={form.retry_limit}
              onChange={(event) =>
                setForm({ ...form, retry_limit: event.target.value })
              }
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(event) =>
              setForm({ ...form, published: event.target.checked })
            }
          />{" "}
          Publish immediately
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.ai_feedback_enabled}
            onChange={(event) =>
              setForm({ ...form, ai_feedback_enabled: event.target.checked })
            }
          />{" "}
          Allow supplemental AI feedback
        </label>
        <button className="button-primary w-fit" type="submit">
          Save assignment
        </button>
      </form>
      <div className="space-y-3">
        {assignments.map((assignment) => (
          <article
            key={assignment.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
          >
            <div>
              <h2 className="font-bold">{assignment.title}</h2>
              <p className="text-sm text-slate-500">
                {assignment.academy_courses?.title || "Course"} ·{" "}
                {assignment.points} points · {assignment.retry_limit} retries
              </p>
            </div>
            <span className="text-xs font-bold uppercase text-cyan-600">
              {assignment.published && !assignment.is_draft
                ? "Published"
                : "Draft"}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
