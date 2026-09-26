import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAcademyAdminOverview } from "../lib/academy";

export default function AcademyAdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [state, setState] = useState("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    const { data, error } = await getAcademyAdminOverview();
    setOverview(data);
    setState(error ? "error" : "ready");
    setLastUpdated(new Date());
    setRefreshing(false);
  }, []);
  useEffect(() => {
    load();
    const refresh = () => load(true);
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);
  const learningHours = Math.round((overview?.learningSeconds ?? 0) / 3600);
  const cards = [
    ["Students", overview?.students ?? 0],
    ["Courses", overview?.courses ?? 0],
    ["Active learners", overview?.activeLearners ?? 0],
    ["Verified points", overview?.verifiedPoints ?? 0],
    ["Learning time", `${learningHours}h`],
    ["Pending submissions", overview?.pendingSubmissions ?? 0],
  ];
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Academy administration
        </p>
        <h1 className="mt-2 text-3xl font-bold">Admin overview</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Manage people, curriculum, and activity from one protected workspace.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading latest data..."}</span>
          <button type="button" className="button-secondary px-3 py-1.5" onClick={() => load(true)} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh now"}
          </button>
          <span>Auto-refreshes every 30 seconds</span>
        </div>
      </header>
      {state === "loading" && <p>Loading overview...</p>}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          Admin data could not be loaded. Check the Academy database migration
          status and administrator permissions.
        </p>
      )}
      {state === "ready" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(([label, value]) => (
              <div
                key={label}
                className="border-l-4 border-cyan-400 bg-white p-5 shadow-sm dark:bg-slate-900"
              >
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="button-primary" to="/academy/admin/content">
              Course content
            </Link>
            <Link className="button-secondary" to="/academy/admin/students">
              Manage students
            </Link>
            <Link className="button-secondary" to="/academy/admin/submissions">
              Review submissions
            </Link>
            <Link className="button-secondary" to="/academy/admin/access">
              Manage access
            </Link>
          </div>
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                Needs attention
              </p>
              <p className="mt-3 text-sm text-amber-900 dark:text-amber-100">
                {overview?.pendingSubmissions ?? 0} submission
                {overview?.pendingSubmissions === 1 ? "" : "s"} awaiting grading
                {" · "}
                {overview?.overdueAssignments ?? 0} published assignment
                {overview?.overdueAssignments === 1 ? "" : "s"} past due
              </p>
              <Link
                className="button-secondary mt-4 inline-flex"
                to="/academy/admin/submissions"
              >
                Review submissions
              </Link>
            </div>
            <div className="border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Teaching control center
              </p>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                Publish course content, assign learning paths, and monitor
                student activity from the admin workspace.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
