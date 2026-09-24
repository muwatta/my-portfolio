import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { getAcademyLessons } from "../lib/academy";
import { fetchWithOfflineFallback } from "../lib/academyOffline";
import { OFFLINE_STORES } from "../lib/offlineStore";
import DownloadedCourseManager from "../components/academy/DownloadedCourseManager";

export default function AcademyLessons() {
  const [weeks, setWeeks] = useState([]);
  const [state, setState] = useState("loading");
  const [offline, setOffline] = useState(false);
  const { user } = useAcademyAuth();

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
  }, [user.id]);

  const totalLessons = weeks.reduce((sum, week) => sum + week.lessons.length, 0);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Course map
        </p>
        <h1 className="mt-2 text-3xl font-bold">Lessons</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
           Work through your lessons week by week, from week 1 to the end of your
          course.
        </p>
      </header>
      {offline && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Offline learning mode. You are viewing lessons saved on this device.
        </p>
      )}
      {state === "loading" && (
        <p className="text-sm text-slate-500">Loading lessons...</p>
      )}
      {state === "unconfigured" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Connect Supabase to load the seeded Academy lessons.
        </div>
      )}
      {state === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
        >
          Lessons could not be loaded. Please try again.
        </div>
      )}
      {state === "ready" && totalLessons === 0 && (
        <p className="rounded-xl border border-slate-200 p-5 text-sm dark:border-slate-800">
          No published lessons yet.
        </p>
      )}
      {state === "ready" &&
        weeks.map((week) => (
          <section
            key={week.week_number}
            className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <header className="border-b border-slate-200 p-5 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
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
              {week.lessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  to={`/academy/lessons/${lesson.id}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-5 hover:border-blue-400 dark:border-slate-800 dark:bg-slate-950"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Lesson {lesson.lesson_number}
                  </p>
                  <h3 className="mt-2 text-lg font-bold">{lesson.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {lesson.objectives?.join(" · ")}
                  </p>
                  <p
                    className={`mt-4 text-xs font-semibold ${
                      lesson.status === "completed"
                        ? "text-emerald-600"
                        : lesson.status === "locked"
                          ? "text-slate-400"
                          : "text-blue-600"
                    }`}
                  >
                    {lesson.status === "completed"
                      ? "Completed"
                      : lesson.status === "in-progress"
                        ? "In progress"
                        : lesson.status === "locked"
                          ? "Locked"
                          : "Available now"}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}