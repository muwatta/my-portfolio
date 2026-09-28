import { useCallback, useEffect, useState } from "react";
import {
  downloadCsv,
  getCourseOptions,
  getGradebook,
  gradebookFilename,
  gradebookToCsv,
} from "../../lib/academyTeacher";
import { friendlyError } from "../../lib/utils";

export default function Gradebook() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCourseOptions().then((result) => {
      setCourses(result.data ?? []);
      if (result.data?.length && !courseId) setCourseId(result.data[0].id);
    });
  }, [courseId]);

  const load = useCallback(async () => {
    if (!courseId) return;
    setBusy(true);
    setError("");
    const { data, error: failure } = await getGradebook(courseId);
    setBusy(false);
    setRows(data ?? []);
    if (failure) setError(friendlyError(failure, "Could not load the gradebook."));
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const course = courses.find((entry) => entry.id === courseId);
  const tasks = collectTasks(rows);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="label max-w-md flex-1">
          Course
          <select
            className="field"
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
          >
            {courses.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="button-primary"
          disabled={!rows.length}
          onClick={() => {
            downloadCsv(
              gradebookToCsv(rows),
              gradebookFilename(course?.title),
            );
            setStatus("Gradebook downloaded.");
          }}
        >
          Export CSV
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {status}
        </p>
      ) : null}

      {busy ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">Loading the gradebook</p>
      ) : !rows.length ? (
        <p className="rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
          No students are enrolled in this course yet.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {rows.length} student{rows.length === 1 ? "" : "s"} · {tasks.length}{" "}
            published task{tasks.length === 1 ? "" : "s"}. A blank cell means the
            mark has not been published yet.
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">
                Gradebook for {course?.title}
              </caption>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-3 py-2">Student</th>
                  {tasks.map((task) => (
                    <th key={task.assignment_id} scope="col" className="px-3 py-2">
                      <span className="block max-w-40 truncate" title={task.title}>
                        {task.title}
                      </span>
                      <span className="font-normal normal-case">
                        out of {task.max_points}
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => {
                  const byId = new Map(
                    (row.results ?? []).map((result) => [
                      result.assignment_id,
                      result,
                    ]),
                  );
                  const percent = Number(row.total_possible)
                    ? (Number(row.total_earned) / Number(row.total_possible)) * 100
                    : 0;
                  return (
                    <tr key={row.student_id}>
                      <th
                        scope="row"
                        className="whitespace-nowrap px-3 py-2 font-semibold"
                      >
                        {row.student_name}
                        <span className="block text-xs font-normal text-slate-500">
                          {row.student_email}
                        </span>
                      </th>
                      {tasks.map((task) => {
                        const result = byId.get(task.assignment_id);
                        const published = result?.state === "published";
                        return (
                          <td key={task.assignment_id} className="px-3 py-2">
                            {published ? (
                              result.score
                            ) : (
                              <span
                                className="text-slate-400"
                                title={result?.state === "reviewed" ? "Reviewed, not published" : "Not submitted"}
                              >
                                {result?.state === "reviewed" ? "held" : "–"}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap px-3 py-2 font-semibold">
                        {Number(row.total_earned)} / {Number(row.total_possible)}
                        <span className="block text-xs font-normal text-slate-500">
                          {percent.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function collectTasks(rows) {
  const seen = new Map();
  for (const row of rows ?? []) {
    for (const result of row.results ?? []) {
      if (!seen.has(result.assignment_id)) seen.set(result.assignment_id, result);
    }
  }
  return [...seen.values()].sort((left, right) =>
    (left.title ?? "").localeCompare(right.title ?? ""),
  );
}
