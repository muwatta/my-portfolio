import { useEffect, useState } from "react";
import { getAcademyWeeklyLeaderboard } from "../lib/academy";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { supabase } from "../lib/supabase";

export default function AcademyLeaderboard() {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState("loading");
  const { user } = useAcademyAuth();

  useEffect(() => {
    let mounted = true;
    getAcademyWeeklyLeaderboard().then(({ data, error, configured }) => {
      if (!mounted) return;
      const resolved = data ?? [];
      setRows(resolved);
      setState(error ? "error" : configured ? "ready" : "unconfigured");
    });
    if (!supabase) return undefined;
    const channel = supabase
      .channel("academy-weekly-leaderboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "academy_leaderboard_standings" },
        () => {
          getAcademyWeeklyLeaderboard().then(({ data }) => {
            if (mounted) setRows(data ?? []);
          });
        },
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);
  const currentUserRow = rows.find((row) => row.student_id === user?.id);
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
        {currentUserRow && (
          <p className="mt-4 inline-flex gap-3 rounded-lg bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200">
            <span>Your rank: #{currentUserRow.rank}</span>
            <span>·</span>
            <span>{currentUserRow.points} pts this week</span>
          </p>
        )}
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
          No verified activity yet. Complete lessons and practice to earn
          points.
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
                <tr
                  key={row.student_id}
                  className={
                    row.student_id === user?.id
                      ? "bg-cyan-50 dark:bg-cyan-950/40"
                      : undefined
                  }
                >
                  <td className="px-5 py-4 font-bold">
                    #{row.rank ?? rows.indexOf(row) + 1}
                    {row.student_id === user?.id && " · you"}
                  </td>
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
