import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getAcademyExamHistory,
  getAcademyProgress,
  getAcademyStudentOverview,
} from "../lib/academy";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import ProgressBar from "../components/academy/ProgressBar";
import { fetchWithOfflineFallback } from "../lib/academyOffline";
import { OFFLINE_STORES } from "../lib/offlineStore";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

// Averaged over released results only. An unreleased attempt has no percentage
// and must not drag the figure down as though it were a zero.
function releasedAverage(exams) {
  const released = exams.filter(
    (attempt) => attempt.results_published && attempt.percentage !== null,
  );
  if (released.length === 0) return "—";
  const total = released.reduce(
    (sum, attempt) => sum + Number(attempt.percentage),
    0,
  );
  return `${(total / released.length).toFixed(1)}%`;
}

export default function AcademyProgress() {
  const { user } = useAcademyAuth();
  const [progress, setProgress] = useState(null);
  const [state, setState] = useState("loading");
  const [offline, setOffline] = useState(false);
  const [overview, setOverview] = useState(null);
  const [exams, setExams] = useState(null);

  // One load for everything on the page, so a return to the tab brings back one
  // consistent view rather than three that each refetch on their own.
  const load = useCallback(async () => {
    const [summary, history] = await Promise.all([
      getAcademyStudentOverview(user.id),
      // Exam history used not to appear on this page at all, so a student could
      // score 80% and see it in exactly one place. It is the student's own
      // record, so there is nothing to weigh here: it is part of their progress,
      // and it goes stale the moment a teacher releases a result.
      getAcademyExamHistory(),
    ]);
    if (summary.data !== undefined) setOverview(summary.data ?? null);
    setExams(history.data ?? []);
  }, [user.id]);

  useEffect(() => {
    let cancelled = false;
    fetchWithOfflineFallback({
      userId: user.id,
      store: OFFLINE_STORES.progress,
      id: "summary",
      fetcher: () => getAcademyProgress(user.id),
    }).then(({ data, error, configured, offline: isOffline }) => {
      if (cancelled) return;
      setOffline(Boolean(isOffline));
      setProgress(data);
      setState(error ? "error" : configured ? "ready" : "unconfigured");
    });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  useAutoRefresh(load, { interval: 120000, refreshOnFocus: true });



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

      {exams && exams.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">Examinations</h2>
            <Link
              to="/academy/exams"
              className="text-sm font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            >
              Open examinations
            </Link>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Papers sat
              </p>
              <p className="mt-1 text-2xl font-bold">
                {exams.filter((attempt) => attempt.status !== "in_progress")
                  .length}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Results released
              </p>
              <p className="mt-1 text-2xl font-bold">
                {exams.filter((attempt) => attempt.results_published).length}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Average score
              </p>
              <p className="mt-1 text-2xl font-bold">
                {releasedAverage(exams)}
              </p>
            </div>
          </div>

          {/*
            An attempt whose results are not out yet is shown as sat, with no
            number beside it. The history function already returns those columns
            as null, and this must not paper over that by reaching for a score the
            server declined to send.
          */}
          <ul className="mt-4 space-y-2">
            {exams.map((attempt) => (
              <li
                key={attempt.attempt_id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-sm last:border-0 dark:border-slate-800/60"
              >
                <span className="font-medium">{attempt.exam_title}</span>
                {attempt.results_published && attempt.percentage !== null ? (
                  <span className="tabular-nums text-slate-600 dark:text-slate-300">
                    {attempt.percentage}% ({attempt.score}/
                    {attempt.total_marks})
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    {attempt.status === "in_progress"
                      ? "In progress"
                      : "Marked, result not released"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
