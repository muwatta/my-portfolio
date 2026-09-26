import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAcademyProgress, getAcademyStudentOverview } from "../lib/academy";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import ProgressBar from "../components/academy/ProgressBar";
import { fetchWithOfflineFallback } from "../lib/academyOffline";
import { OFFLINE_STORES } from "../lib/offlineStore";

export default function AcademyProgress() {
  const { user } = useAcademyAuth();
  const [progress, setProgress] = useState(null);
  const [state, setState] = useState("loading");
  const [offline, setOffline] = useState(false);
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    getAcademyStudentOverview(user.id).then(({ data }) => setOverview(data));
  }, [user.id]);

  useEffect(() => {
    fetchWithOfflineFallback({
      userId: user.id,
      store: OFFLINE_STORES.progress,
      id: "summary",
      fetcher: () => getAcademyProgress(user.id),
    }).then(({ data, error, configured, offline: isOffline }) => {
      setOffline(Boolean(isOffline));
      setProgress(data);
      setState(error ? "error" : configured ? "ready" : "unconfigured");
    });
  }, [user.id]);

  if (state === "loading")
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Loading your progress...
      </p>
    );
  if (state === "unconfigured")
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        Connect Supabase to load progress.
      </p>
    );
  if (state === "error")
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
      >
        Progress could not be loaded.
      </p>
    );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Progress</h1>
      </header>

      {offline && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          This is the last progress snapshot saved on this device. Pending work
          will sync when you reconnect.
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <ProgressBar
          value={progress?.completionPercent}
          label="Course completion"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Lessons completed",
            value: `${progress?.completedLessons} / ${progress?.lessonCount}`,
          },
          { label: "Assignments submitted", value: progress?.submissions ?? 0 },
          { label: "Current week", value: `${progress?.currentWeek} / 11` },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {item.label}
            </p>
            <p className="mt-2 text-2xl font-bold">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">Project milestones</h2>
          <Link
            to="/academy/projects"
            className="text-sm font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          >
            Open projects
          </Link>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Track the milestones you have finished in your current project.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 p-6 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">Achievements</h2>
          <Link
            to="/academy/leaderboard"
            className="text-sm font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          >
            See leaderboard
          </Link>
        </div>
        {overview?.badges?.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overview.badges.map((badge, index) => (
              <li
                key={`${badge.awarded_at}-${index}`}
                className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"
              >
                <p className="font-semibold">{badge.academy_badges?.name}</p>
                {badge.academy_badges?.description && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {badge.academy_badges.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            No achievements yet. Complete lessons and practice to earn your
            first badge.
          </p>
        )}
      </section>
    </div>
  );
}
