import { useEffect, useState } from "react";
import { getAcademyTeacherAnalytics } from "../lib/academy";

export default function AcademyTeacherAnalytics() {
  const [data, setData] = useState({ students: [], submissions: 0 });
  const [state, setState] = useState("loading");
  useEffect(() => {
    getAcademyTeacherAnalytics().then(({ data: result, error }) => {
      setData(result ?? { students: [], submissions: 0 });
      setState(error ? "error" : "ready");
    });
  }, []);
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Admin control center
        </p>
        <h1 className="mt-2 text-3xl font-bold">Analytics</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Monitor recorded activity and progress from Academy data.
        </p>
      </header>
      {state === "loading" && <p>Loading analytics...</p>}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          Analytics could not be loaded.
        </p>
      )}
      {state === "ready" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="border-l-4 border-cyan-400 bg-white p-5 dark:bg-slate-900">
              <p className="text-sm text-slate-500">Students</p>
              <p className="mt-2 text-3xl font-bold">{data.students.length}</p>
            </div>
            <div className="border-l-4 border-cyan-400 bg-white p-5 dark:bg-slate-900">
              <p className="text-sm text-slate-500">Active recently</p>
              <p className="mt-2 text-3xl font-bold">
                {
                  data.students.filter(
                    (student) =>
                      student.activity.lastActive &&
                      Date.now() -
                        new Date(student.activity.lastActive).getTime() <
                        15 * 60 * 1000,
                  ).length
                }
              </p>
            </div>
            <div className="border-l-4 border-cyan-400 bg-white p-5 dark:bg-slate-900">
              <p className="text-sm text-slate-500">Submissions</p>
              <p className="mt-2 text-3xl font-bold">{data.submissions}</p>
            </div>
          </div>
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-4">Student</th>
                  <th className="px-5 py-4">Level</th>
                  <th className="px-5 py-4">Learning time</th>
                  <th className="px-5 py-4">Lessons complete</th>
                  <th className="px-5 py-4">Last active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.students.map((student) => (
                  <tr key={student.id}>
                    <td className="px-5 py-4 font-semibold">
                      {student.display_name || "Unnamed student"}
                    </td>
                    <td className="px-5 py-4">
                      {student.academy_levels?.name || "Unassigned"}
                    </td>
                    <td className="px-5 py-4">
                      {Math.floor(student.activity.seconds / 3600)}h{" "}
                      {Math.floor((student.activity.seconds % 3600) / 60)}m
                    </td>
                    <td className="px-5 py-4">{student.completedLessons}</td>
                    <td className="px-5 py-4">
                      {student.activity.lastActive
                        ? new Date(student.activity.lastActive).toLocaleString()
                        : "No activity"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
