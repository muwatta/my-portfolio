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
  const [stateFilter, setStateFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
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
  const students = data.students.filter((student) => {
    const searchText = `${student.display_name || ""} ${student.academy_schools?.name || ""} ${student.academy_schools?.code || ""}`;
    return (
      searchText.toLowerCase().includes(search.toLowerCase()) &&
      (!stateFilter || student.state === stateFilter) &&
      (!schoolFilter || student.school_id === schoolFilter) &&
      (!levelFilter || student.level_id === levelFilter)
    );
  });
  const states = ["Plateau", "Kwara", "Lagos", "Abuja", "Other"];
  const schools = data.students
    .map((student) => student.academy_schools)
    .filter(
      (school, index, all) =>
        school && all.findIndex((item) => item.id === school.id) === index,
    );
  const levels = data.levels;
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          className="field"
          aria-label="Search students"
          placeholder="Search by name or school..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="field"
          aria-label="Filter by state"
          value={stateFilter}
          onChange={(event) => setStateFilter(event.target.value)}
        >
          <option value="">All states</option>
          {states.map((state) => (
            <option key={state}>{state}</option>
          ))}
        </select>
        <select
          className="field"
          aria-label="Filter by school"
          value={schoolFilter}
          onChange={(event) => setSchoolFilter(event.target.value)}
        >
          <option value="">All schools</option>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
            </option>
          ))}
        </select>
        <select
          className="field"
          aria-label="Filter by level"
          value={levelFilter}
          onChange={(event) => setLevelFilter(event.target.value)}
        >
          <option value="">All levels</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
            </option>
          ))}
        </select>
      </div>
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
        <div>
          {!students.length && (
            <p className="mb-4 rounded-xl border border-dashed border-slate-300 p-5 text-sm dark:border-slate-700">
              No students match these filters.
            </p>
          )}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-4">Name</th>
                  <th className="px-5 py-4">Level</th>
                  <th className="px-5 py-4">School</th>
                  <th className="px-5 py-4">State</th>
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
                      {student.academy_schools?.name || "Other"}
                    </td>
                    <td className="px-5 py-4">{student.state || "Not set"}</td>
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
        </div>
      )}
    </div>
  );
}
