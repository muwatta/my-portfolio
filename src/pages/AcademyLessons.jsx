import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { getAcademyLessons } from "../lib/academy";
import { fetchWithOfflineFallback } from "../lib/academyOffline";
import { OFFLINE_STORES } from "../lib/offlineStore";
import DownloadedCourseManager from "../components/academy/DownloadedCourseManager";
import AcademyConnectionState from "../components/academy/AcademyConnectionState";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

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
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    fetchWithOfflineFallback({
      userId: user.id,
      store: OFFLINE_STORES.lessons,
      fetcher: () => getAcademyLessons(user.id),
    }).then(({ data, error, configured, offline: isOffline }) => {
      setOffline(Boolean(isOffline));
      if (error) setState("error");
      else if (!configured) setState("unconfigured");
      else {
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
      }
    });
  }, [user.id, reloadToken]);

  const totalLessons = weeks.reduce(
    (sum, week) => sum + week.lessons.length,
    0,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Lessons</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Work through your lessons week by week, from week 1 to the end of your
          course.
        </p>
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
              : () => setReloadToken((value) => value + 1)
          }
        />
      )}

      {state === "ready" &&
        weeks.map((week) => (
          <section
            key={week.week_number}
            className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <header className="border-b border-slate-200 p-5 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Week {week.week_number}
              </p>
              <h2 className="mt-1 text-xl font-bold">{week.week_title}</h2>
            </header>
            <div className="px-5 pt-4">
              <DownloadedCourseManager
                course={week.lessons[0]?.academy_weeks?.academy_courses}
                week={week}
              />
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
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
                    : "border-slate-200 bg-slate-50 hover:border-amber-400 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-amber-500"
                }`;
                const body = (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Lesson {lesson.lesson_number}
                    </p>
                    <h3 className="mt-2 text-lg font-bold">{lesson.title}</h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {lesson.objectives?.join(" · ")}
                    </p>
                    <p
                      className={`mt-4 text-xs font-semibold ${status.className}`}
                    >
                      {status.label}
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
        ))}
    </div>
  );
}
