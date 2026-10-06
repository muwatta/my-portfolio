import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiAward,
  FiBookOpen,
  FiCheckCircle,
  FiLock,
  FiPlay,
  FiTarget,
} from "react-icons/fi";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { getAcademyLessons } from "../lib/academy";
import { fetchWithOfflineFallback } from "../lib/academyOffline";
import { OFFLINE_STORES } from "../lib/offlineStore";
import DownloadedCourseManager from "../components/academy/DownloadedCourseManager";
import AcademyConnectionState from "../components/academy/AcademyConnectionState";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import ProgressBar from "../components/academy/ProgressBar";

const LESSON_STATUS = {
  completed: {
    label: "Completed",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  "in-progress": {
    label: "In progress",
    className: "text-amber-600 dark:text-amber-400",
  },
  locked: { label: "Locked", className: "text-slate-400 dark:text-slate-500" },
  default: {
    label: "Available now",
    className: "text-teal-600 dark:text-teal-400",
  },
};

export default function AcademyLessons() {
  const [weeks, setWeeks] = useState([]);
  const [state, setState] = useState("loading");
  const [offline, setOffline] = useState(false);
  const { user } = useAcademyAuth();
  const network = useNetworkStatus();


  // Extracted so the page can refetch on its own. The prerequisite chain is
  // what makes this matter: a student finishes a lesson, comes back to this list
  // and the next one is still marked locked, because nothing asked again. That
  // reads as a bug in the unlock, and it is not.
  const load = useCallback(async () => {
    const { data, error, configured, offline: isOffline } =
      await fetchWithOfflineFallback({
        userId: user.id,
        store: OFFLINE_STORES.lessons,
        fetcher: () => getAcademyLessons(user.id),
      });
    setOffline(Boolean(isOffline));
    if (error) {
      setState("error");
      return;
    }
    if (!configured) {
      setState("unconfigured");
      return;
    }
    const grouped = new Map();
    (data ?? []).forEach((lesson) => {
      const weekNumber = lesson.academy_weeks?.week_number ?? 0;
      const weekTitle = lesson.academy_weeks?.title ?? `Week ${weekNumber}`;
      const entry = grouped.get(weekNumber) ?? {
        week_number: weekNumber,
        week_title: weekTitle,
        lessons: [],
      };
      entry.lessons.push(lesson);
      grouped.set(weekNumber, entry);
    });
    setWeeks(
      [...grouped.values()]
        .sort((a, b) => a.week_number - b.week_number)
        .map((week) => ({
          ...week,
          lessons: week.lessons.sort(
            (a, b) =>
              (a.sort_order ?? a.lesson_number ?? 0) -
                (b.sort_order ?? b.lesson_number ?? 0) ||
              (a.lesson_number ?? 0) - (b.lesson_number ?? 0),
          ),
        })),
    );
    setState("ready");
  }, [user.id]);

  // Poll while visible without disrupting students who briefly switch apps.
  useAutoRefresh(load, { interval: 120000 });

  const totalLessons = weeks.reduce(
    (sum, week) => sum + week.lessons.length,
    0,
  );
  const lessons = weeks.flatMap((week) => week.lessons);
  const completedLessons = lessons.filter(
    (lesson) => lesson.status === "completed",
  ).length;
  const availableLessons = lessons.filter(
    (lesson) => lesson.status !== "locked" && lesson.status !== "completed",
  );
  const nextLesson =
    availableLessons.find((lesson) => lesson.status === "in-progress") ??
    availableLessons[0];
  const completionPercent = totalLessons
    ? Math.round((completedLessons / totalLessons) * 100)
    : 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="always-dark relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-lg sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full border-[22px] border-cyan-300/10" />
        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-cyan-200">
            <FiAward aria-hidden="true" />
            Your learning zone
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Learn, one win at a time
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
            Follow your course week by week. Finish a lesson to unlock the next
            step in your journey.
          </p>
          {state === "ready" && totalLessons > 0 && (
            <>
              <div className="mt-5 max-w-xl rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">
                    Course progress
                  </span>
                  <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-bold text-cyan-100">
                    {completedLessons} / {totalLessons} lessons
                  </span>
                </div>
                <ProgressBar value={completionPercent} label="Course progress" />
              </div>
              {nextLesson && (
                <Link
                  to={`/academy/lessons/${nextLesson.id}`}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-2 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:bg-cyan-200 sm:w-auto"
                >
                  <FiPlay aria-hidden="true" />
                  {nextLesson.status === "in-progress"
                    ? "Continue lesson"
                    : "Start next lesson"}
                </Link>
              )}
              {!nextLesson && completedLessons === totalLessons && (
                <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-300/15 px-4 py-3 text-sm font-semibold text-emerald-100">
                  <FiCheckCircle aria-hidden="true" />
                  Every available lesson is complete. New lessons will appear
                  here when released.
                </p>
              )}
            </>
          )}
        </div>
      </header>

      {offline && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Offline learning mode. You are viewing lessons saved on this device.
        </p>
      )}

      {state === "loading" && (
        <AcademyConnectionState
          loading
          title=""
          description=""
          showChallenge={false}
        />
      )}
      {state === "unconfigured" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Connect Supabase to load the seeded Academy lessons.
        </div>
      )}
      {state === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
        >
          Lessons could not be loaded. Please try again.
        </div>
      )}
      {state === "ready" && totalLessons === 0 && (
        <AcademyConnectionState
          online={network.online}
          slow={network.slow}
          title={
            network.online
              ? "No lessons published yet"
              : "This course is not downloaded"
          }
          description={
            network.online
              ? "Your teacher is still preparing this course. Check back soon, or open a lesson you already downloaded."
              : "Reconnect once to download these lessons, then they will stay available on this device without a connection."
          }
          onRetry={
            network.online
              ? undefined
              : () => load()
          }
        />
      )}

      {state === "ready" &&
        weeks.map((week) => {
          const weekCompleted = week.lessons.filter(
            (lesson) => lesson.status === "completed",
          ).length;
          const weekPercent = Math.round(
            (weekCompleted / week.lessons.length) * 100,
          );
          return (
            <section
              key={week.week_number}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <header className="border-b border-slate-200 bg-slate-50/80 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                      Week {week.week_number}
                    </p>
                    <h2 className="mt-1 text-lg font-bold sm:text-xl">
                      {week.week_title}
                    </h2>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {weekCompleted} / {week.lessons.length} complete
                  </span>
                </div>
                <div className="mt-3">
                  <ProgressBar
                    value={weekPercent}
                    label={`Week ${week.week_number} progress`}
                  />
                </div>
              </header>
              <div className="px-4 pt-4 sm:px-5">
                <DownloadedCourseManager
                  course={week.lessons[0]?.academy_weeks?.academy_courses}
                  week={week}
                />
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:gap-4 sm:p-5">
                {week.lessons.map((lesson) => {
                  const status =
                    LESSON_STATUS[lesson.status] ?? LESSON_STATUS.default;
                  const locked = lesson.status === "locked";
                  // A locked lesson is not a link. The database already refuses to
                  // start it, but a link that goes nowhere is worse than no link:
                  // it looks like the content is missing rather than earned.
                  const className = `rounded-xl border p-5 transition-colors ${
                    locked
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950/60"
                      : lesson.status === "completed"
                        ? "border-emerald-200 bg-emerald-50/60 hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/20 dark:hover:border-emerald-700"
                        : "border-cyan-200 bg-cyan-50/50 hover:border-cyan-400 dark:border-cyan-900 dark:bg-cyan-950/20 dark:hover:border-cyan-700"
                  }`;
                  const body = (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-cyan-800 shadow-sm dark:bg-slate-900 dark:text-cyan-200">
                          {locked ? (
                            <FiLock aria-hidden="true" />
                          ) : lesson.status === "completed" ? (
                            <FiCheckCircle aria-hidden="true" />
                          ) : lesson.status === "in-progress" ? (
                            <FiPlay aria-hidden="true" />
                          ) : (
                            <FiBookOpen aria-hidden="true" />
                          )}
                        </span>
                        <span
                          className={`rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold ${status.className} dark:bg-slate-900/80`}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Lesson {lesson.lesson_number}
                      </p>
                      <h3 className="mt-1 text-lg font-bold">{lesson.title}</h3>
                      {!!lesson.objectives?.length && (
                        <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                          {lesson.objectives.join(" · ")}
                        </p>
                      )}
                      <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {locked ? (
                          <>
                            <FiLock aria-hidden="true" />
                            Finish the previous lesson to unlock
                          </>
                        ) : lesson.status === "completed" ? (
                          <>
                            <FiCheckCircle aria-hidden="true" />
                            Review this lesson
                          </>
                        ) : (
                          <>
                            <FiTarget aria-hidden="true" />
                            Open lesson
                          </>
                        )}
                      </p>
                    </>
                  );

                  if (locked) {
                    return (
                      <div
                        key={lesson.id}
                        className={className}
                        aria-disabled="true"
                        title="Finish the previous lesson to unlock this one"
                      >
                        {body}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={lesson.id}
                      to={`/academy/lessons/${lesson.id}`}
                      className={className}
                    >
                      {body}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
    </div>
  );
}
