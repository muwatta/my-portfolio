import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { getAcademyAdminOverview } from "../lib/academy";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import RefreshControl from "../components/academy/RefreshControl";
import {
  Skeleton,
  SkeletonPanel,
  SkeletonStatCards,
} from "../components/ui/Skeleton";

export default function AcademyAdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [state, setState] = useState("loading");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (background = false) => {
    if (background) setBusy(true);
    const { data, error } = await getAcademyAdminOverview();
    setBusy(false);
    if (background && error) return;
    setOverview(data);
    setUpdatedAt(Date.now());
    setState(error ? "error" : "ready");
  }, []);
  // Slow poll, and no refresh when the tab regains focus. Refreshing the moment
  // someone comes back is what used to throw away their place on the page.
  useAutoRefresh(load, { interval: 120000 });
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
            Academy administration
          </p>
          <RefreshControl onRefresh={() => load(false)} busy={busy} updatedAt={updatedAt} />
        </div>
        <h1 className="mt-2 text-3xl font-bold">Admin overview</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Manage people, curriculum, and activity from one protected workspace.
        </p>
      </header>
      {state === "loading" && (
        <div className="space-y-6">
          <SkeletonStatCards count={6} />
          <div className="grid gap-4 lg:grid-cols-2">
            <SkeletonPanel />
            <SkeletonPanel />
          </div>
        </div>
      )}
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
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="space-y-8"
        >
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
        </motion.div>
      )}
    </div>
  );
}
