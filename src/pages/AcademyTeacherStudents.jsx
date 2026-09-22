import { useEffect, useState } from "react";
import {
  assignAcademyStudentLevel,
  getAcademyTeacherStudents,
} from "../lib/academy";

export default function AcademyTeacherStudents() {
  const [data, setData] = useState({ students: [], levels: [] });
  const [state, setState] = useState("loading");
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState("");

  async function loadStudents() {
    setState("loading");
    const result = await getAcademyTeacherStudents();
    setData(result.data ?? { students: [], levels: [] });
    setState(result.error ? "error" : "ready");
  }

  useEffect(() => {
    loadStudents();
  }, []);

  async function handleLevelChange(studentId, levelId) {
    setMessage("");
    setSavingId(studentId);
    const { error } = await assignAcademyStudentLevel(studentId, levelId);
    if (error) {
      setMessage(error.message || "The student level could not be updated.");
    } else {
      setMessage("Student level updated.");
      await loadStudents();
    }
    setSavingId(null);
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Admin control center
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Students</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Assign learning levels from the Academy database. Students cannot
          change their own level.
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
      {state === "loading" && (
        <p className="text-sm text-slate-500">Loading students...</p>
      )}
      {state === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
        >
          Students could not be loaded. Confirm that the Academy control
          migrations are applied.
        </div>
      )}
      {state === "ready" && data.students.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <h2 className="font-bold">No student accounts yet</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            New student signups will appear here.
          </p>
        </div>
      )}
      {state === "ready" && data.students.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-5 py-4">Student</th>
                <th className="px-5 py-4">Current course</th>
                <th className="px-5 py-4">Profile updated</th>
                <th className="px-5 py-4">Assign course</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.students.map((student) => (
                <tr key={student.id}>
                  <td className="px-5 py-4 font-semibold">
                    {student.display_name || "Unnamed student"}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {student.academy_courses?.title || "Unassigned"}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {new Date(student.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4">
                    <label className="sr-only" htmlFor={`course-${student.id}`}>
                      Assign course to {student.display_name || "student"}
                    </label>
                    <select
                      id={`course-${student.id}`}
                      className="field min-w-44"
                      value={student.current_course_id || ""}
                      disabled={savingId === student.id}
                      onChange={(event) =>
                        handleLevelChange(student.id, event.target.value)
                      }
                    >
                      <option value="">Unassigned</option>
                      {data.levels.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
