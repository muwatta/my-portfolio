import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FiActivity,
  FiArrowUpRight,
  FiAward,
  FiBookOpen,
  FiClock,
  FiEye,
  FiInbox,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import { getAcademyAdminOverview } from "../lib/academy";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import RefreshControl from "../components/academy/RefreshControl";
import {
  Skeleton,
  SkeletonPanel,
  SkeletonStatCards,
} from "../components/ui/Skeleton";

const COURSE_PREVIEWS = [
  {
    title: "Python for Young Innovators",
    subtitle: "Python · 11 weeks",
    slug: "python-for-ai-machine-learning",
  },
  {
    title: "C++ for Embedded Systems & Robotics",
    subtitle: "C++ · 24 weeks",
    slug: "cpp-embedded-robotics",
  },
];

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
  useAutoRefresh(load, { interval: 120000, refreshOnFocus: true });
  const learningHours = Math.round((overview?.learningSeconds ?? 0) / 3600);
  const cards = [
    { label: "Students", value: overview?.students ?? 0, Icon: FiUsers },
    { label: "Courses", value: overview?.courses ?? 0, Icon: FiBookOpen },
    { label: "Active learners", value: overview?.activeLearners ?? 0, Icon: FiActivity },
    { label: "Verified points", value: overview?.verifiedPoints ?? 0, Icon: FiAward },
    { label: "Learning time", value: `${learningHours}h`, Icon: FiClock },
    { label: "Pending submissions", value: overview?.pendingSubmissions ?? 0, Icon: FiInbox },
  ];
  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-950 p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-14 -top-24 h-72 w-72 rounded-full border-[32px] border-cyan-200/10" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">
              <FiShield aria-hidden="true" />
              Academy control room
            </p>
            <RefreshControl onRefresh={() => load(false)} busy={busy} updatedAt={updatedAt} />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Admin overview
          </h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Follow learner activity, keep submissions moving, and guide the
            Academy from one place.
          </p>
        </div>
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(({ label, value, Icon }) => (
              <div
                key={label}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-cyan-800"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {label}
                  </p>
                  <span className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">
                    <Icon aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-4 text-3xl font-extrabold tracking-tight tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <section aria-label="Admin shortcuts" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Course content", to: "/academy/admin/content", Icon: FiBookOpen },
              { label: "Manage students", to: "/academy/admin/students", Icon: FiUsers },
              { label: "Review submissions", to: "/academy/admin/submissions", Icon: FiInbox },
              { label: "Manage access", to: "/academy/admin/access", Icon: FiShield },
            ].map(({ label, to, Icon }) => (
              <Link
                key={to}
                to={to}
                className="group flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-cyan-800"
              >
                <span className="flex items-center gap-3">
                  <Icon aria-hidden="true" className="text-cyan-700 dark:text-cyan-300" />
                  {label}
                </span>
                <FiArrowUpRight
                  aria-hidden="true"
                  className="text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </Link>
            ))}
          </section>
          <section
            aria-labelledby="course-previews-heading"
            className="rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 p-5 dark:border-cyan-900 dark:from-cyan-950/30 dark:via-slate-900 dark:to-indigo-950/30 sm:p-6"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-800 dark:text-cyan-200">
                  Preview as a learner
                </p>
                <h2
                  id="course-previews-heading"
                  className="mt-1 text-xl font-extrabold tracking-tight"
                >
                  See what students see
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                  Browse the published weeks, lessons, practice and assignments
                  without creating a student account or changing anyone’s progress.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {COURSE_PREVIEWS.map(({ title, subtitle, slug }) => (
                <Link
                  key={slug}
                  to={`/academy/admin/previews/${slug}`}
                  className="group flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-white bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-cyan-700"
                >
                  <span>
                    <span className="block text-xs font-bold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">
                      {subtitle}
                    </span>
                    <span className="mt-1 block font-bold text-slate-900 dark:text-slate-100">
                      {title}
                    </span>
                  </span>
                  <FiEye
                    aria-hidden="true"
                    className="shrink-0 text-xl text-cyan-700 transition group-hover:scale-110 dark:text-cyan-300"
                  />
                </Link>
              ))}
            </div>
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 dark:border-amber-900 dark:from-amber-950/40 dark:to-orange-950/30">
              <p className="text-sm font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
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
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-cyan-50 p-5 dark:border-indigo-900 dark:from-indigo-950/40 dark:to-cyan-950/30">
              <p className="text-sm font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">
                Learning impact
              </p>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                Your students have earned {overview?.verifiedPoints ?? 0}{" "}
                verified points and recorded {learningHours} hours of learning.
                Use the learner and content controls to keep their path moving.
              </p>
            </div>
          </section>
        </motion.div>
      )}
    </div>
  );
}
