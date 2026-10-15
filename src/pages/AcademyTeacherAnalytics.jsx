import { useEffect, useMemo, useState } from "react";
import { getAcademyTeacherAnalytics } from "../lib/academy";

export default function AcademyTeacherAnalytics() {
  const [data, setData] = useState({ students: [], submissions: 0 });
  const [state, setState] = useState("loading");
  const [sortBy, setSortBy] = useState("completedLessons");
  useEffect(() => {
    getAcademyTeacherAnalytics().then(({ data: result, error }) => {
      setData(result ?? { students: [], submissions: 0 });
      setState(error ? "error" : "ready");
    });
  }, []);
  const sortedStudents = useMemo(
    () =>
      [...data.students].sort((left, right) => {
        const leftName = (left.display_name || "Unnamed student").trim();
        const rightName = (right.display_name || "Unnamed student").trim();
        const byName = leftName.localeCompare(rightName, undefined, {
          sensitivity: "base",
        });
        if (sortBy === "name") return byName;
        if (sortBy === "learningTime") {
          return (
            Number(left.activity?.seconds ?? 0) -
              Number(right.activity?.seconds ?? 0) ||
            byName
          );
        }
        if (sortBy === "lastActive") {
          const leftTime = left.activity?.lastActive
            ? new Date(left.activity.lastActive).getTime()
            : Number.NEGATIVE_INFINITY;
          const rightTime = right.activity?.lastActive
            ? new Date(right.activity.lastActive).getTime()
            : Number.NEGATIVE_INFINITY;
          return leftTime - rightTime || byName;
        }
        return (
          Number(left.completedLessons ?? 0) -
            Number(right.completedLessons ?? 0) ||
          byName
        );
      }),
    [data.students, sortBy],
  );
  const activeRecently = data.students.filter((student) => {
    const lastActive = student.activity?.lastActive;
    return (
      lastActive &&
      Date.now() - new Date(lastActive).getTime() < 15 * 60 * 1000
    );
  }).length;

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Academy overview
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Student analytics</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Compare lesson progress, learning time, and recent activity. The list
          starts with students who have completed the fewest lessons so support
          needs are easy to spot.
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
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <p className="text-sm text-slate-500">Students in view</p>
              <p className="mt-2 text-2xl font-bold">{data.students.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <p className="text-sm text-slate-500">Active in last 15 minutes</p>
              <p className="mt-2 text-2xl font-bold">{activeRecently}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <p className="text-sm text-slate-500">Submissions</p>
              <p className="mt-2 text-2xl font-bold">{data.submissions}</p>
            </div>
          </div>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between sm:p-5">
              <div>
                <h2 className="text-lg font-bold">Students to review</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Lowest value first; ties are sorted by name.
                </p>
              </div>
              <label className="label w-full sm:max-w-xs">
                Order by
                <select
                  className="field mt-1"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                >
                  <option value="completedLessons">
                    Lessons completed (lowest first)
                  </option>
                  <option value="learningTime">
                    Learning time (lowest first)
                  </option>
                  <option value="lastActive">Last active (oldest first)</option>
                  <option value="name">Student name (A–Z)</option>
                </select>
              </label>
            </div>
            <div className="space-y-3 p-3 md:hidden">
              {sortedStudents.map((student) => (
                <article
                  key={student.id}
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                >
                  <h3 className="break-words font-semibold">
                    {student.display_name || "Unnamed student"}
                  </h3>
                  <p className="mt-1 text-sm text-cyan-800 dark:text-cyan-200">
                    {student.academy_courses?.title || "Unassigned course"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {student.academy_schools?.name || "School not recorded"}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Lessons complete</dt>
                      <dd className="mt-1 font-semibold">
                        {student.completedLessons ?? 0}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Learning time</dt>
                      <dd className="mt-1 font-semibold">
                        {Math.floor(Number(student.activity?.seconds ?? 0) / 3600)}h{" "}
                        {Math.floor(
                          (Number(student.activity?.seconds ?? 0) % 3600) / 60,
                        )}
                        m
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-slate-500">Last active</dt>
                      <dd className="mt-1 font-semibold">
                        {student.activity?.lastActive
                          ? new Date(student.activity.lastActive).toLocaleString()
                          : "No recorded activity"}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
              {!sortedStudents.length && (
                <p className="p-4 text-sm text-slate-500">
                  No students are available to review.
                </p>
              )}
            </div>
            <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-4">Student</th>
                  <th className="px-5 py-4">School</th>
                  <th className="px-5 py-4">Current course</th>
                  <th className="px-5 py-4">Learning time</th>
                  <th className="px-5 py-4">Lessons complete</th>
                  <th className="px-5 py-4">Last active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedStudents.map((student) => (
                  <tr key={student.id}>
                    <td className="px-5 py-4 font-semibold">
                      {student.display_name || "Unnamed student"}
                    </td>
                    <td className="px-5 py-4">
                      {student.academy_schools?.name || "Not recorded"}
                    </td>
                    <td className="px-5 py-4">
                      {student.academy_courses?.title || "Unassigned"}
                    </td>
                    <td className="px-5 py-4">
                      {Math.floor(Number(student.activity?.seconds ?? 0) / 3600)}h{" "}
                      {Math.floor(
                        (Number(student.activity?.seconds ?? 0) % 3600) / 60,
                      )}
                      m
                    </td>
                    <td className="px-5 py-4">{student.completedLessons}</td>
                    <td className="px-5 py-4">
                      {student.activity?.lastActive
                        ? new Date(student.activity.lastActive).toLocaleString()
                        : "No activity"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
