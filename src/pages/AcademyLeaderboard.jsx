import { useEffect, useState } from "react";
import { getAcademyLeaderboard } from "../lib/academy";

export default function AcademyLeaderboard() {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState("loading");
  useEffect(() => {
    getAcademyLeaderboard().then(({ data, error, configured }) => {
      setRows(data ?? []);
      setState(error ? "error" : configured ? "ready" : "unconfigured");
    });
  }, []);
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Verified activity
        </p>
        <h1 className="mt-2 text-3xl font-bold">Leaderboard</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Points come from recorded lessons and practice, not manual client
          updates.
        </p>
      </header>
      {state === "loading" && <p>Loading leaderboard...</p>}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          Leaderboard could not be loaded.
        </p>
      )}
      {state === "ready" && rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-sm dark:border-slate-700">
          No verified activity yet.
        </p>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-5 py-4">Rank</th>
                <th className="px-5 py-4">Student</th>
                <th className="px-5 py-4">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row) => (
                <tr key={row.student_id}>
                  <td className="px-5 py-4 font-bold">{row.rank}</td>
                  <td className="px-5 py-4">{row.display_name || "Student"}</td>
                  <td className="px-5 py-4 font-semibold">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
