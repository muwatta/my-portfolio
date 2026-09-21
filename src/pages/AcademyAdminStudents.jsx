import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  assignAcademyStudentLevel,
  getAcademyTeacherStudents,
} from "../lib/academy";

export default function AcademyAdminStudents() {
  const [data, setData] = useState({ students: [], levels: [] });
  const [state, setState] = useState("loading");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    const result = await getAcademyTeacherStudents();
    setData(result.data ?? { students: [], levels: [] });
    setState(result.error ? "error" : "ready");
  }
  useEffect(() => {
    load();
  }, []);
  async function changeLevel(studentId, levelId) {
    const { error } = await assignAcademyStudentLevel(studentId, levelId);
    setMessage(error?.message || "Student level updated.");
    if (!error) await load();
  }
  const students = data.students.filter((student) =>
    (student.display_name || "").toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Admin control center
        </p>
        <h1 className="mt-2 text-3xl font-bold">Students</h1>
      </header>
      {message && (
        <p
          role="status"
          className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-900"
        >
          {message}
        </p>
      )}
      <input
        className="field max-w-md"
        aria-label="Search students"
        placeholder="Search students..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {state === "loading" && <p>Loading students...</p>}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          Students could not be loaded.
        </p>
      )}
      {state === "ready" && (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Level</th>
                <th className="px-5 py-4">Academy time</th>
                <th className="px-5 py-4">Updated</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {students.map((student) => (
                <tr key={student.id}>
                  <td className="px-5 py-4 font-semibold">
                    {student.display_name || "Unnamed student"}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      className="field"
                      value={student.level_id || ""}
                      onChange={(event) =>
                        changeLevel(student.id, event.target.value)
                      }
                    >
                      <option value="">Unassigned</option>
                      {data.levels.map((level) => (
                        <option key={level.id} value={level.id}>
                          {level.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    {Math.floor((student.activity?.seconds ?? 0) / 60)} min
                  </td>
                  <td className="px-5 py-4">
                    {new Date(student.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      className="font-semibold text-blue-600"
                      to={`/academy/admin/students/${student.id}`}
                    >
                      View profile
                    </Link>
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
