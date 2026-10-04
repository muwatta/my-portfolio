import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getAcademyCourses,
  getActiveCourseForStudent,
  selectAcademyCourse,
} from "../lib/academy";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { friendlyError } from "../lib/utils";
import { settleAll } from "../lib/settle";
import CourseReviews from "../components/academy/CourseReviews";
import DownloadedCourseManager from "../components/academy/DownloadedCourseManager";
import { fetchWithOfflineFallback } from "../lib/academyOffline";
import { OFFLINE_STORES } from "../lib/offlineStore";

export default function AcademyCourses() {
  const [courses, setCourses] = useState([]);
  const [activeCourse, setActiveCourse] = useState(null);
  const [state, setState] = useState("loading");
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState("");
  const [selecting, setSelecting] = useState("");
  const { user } = useAcademyAuth();

  useEffect(() => {
    let mounted = true;
    // Settled individually. If the active-course lookup rejected, Promise.all
    // rejected with it, setState never ran and this page sat on its loading
    // state showing nothing and saying nothing, which reads as a blank page
    // rather than as a failed request.
    settleAll([
      () =>
        fetchWithOfflineFallback({
          userId: user?.id,
          store: OFFLINE_STORES.courses,
          id: "list:courses",
          fetcher: () => getAcademyCourses(),
        }),
      () =>
        user?.id && navigator.onLine
          ? getActiveCourseForStudent(user.id)
          : Promise.resolve({ data: null }),
    ]).then(([courseResult, active]) => {
      if (!mounted) return;
      setOffline(Boolean(courseResult.offline));
      setCourses(courseResult.data ?? []);
      setActiveCourse(active?.data ?? null);
      setState(
        courseResult.error
          ? "error"
          : courseResult.configured
            ? "ready"
            : "unconfigured",
      );
    });
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  async function selectCourse(courseId) {
    if (activeCourse || selecting || offline) return;
    setSelecting(courseId);
    setNotice("");
    const { error } = await selectAcademyCourse(user.id, courseId);
    setNotice(
      error
        ? friendlyError(error, "Course could not be selected.")
        : "Course selected. Your lessons are ready.",
    );
    setSelecting("");
    if (!error) {
      const active = await getActiveCourseForStudent(user.id);
      setActiveCourse(active?.data ?? null);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Choose the learning path you want to follow. Your lessons and progress
          are organized around one course at a time.
        </p>
      </header>

      {activeCourse && (
        <section
          aria-label="Your current course"
          className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-300">
              Your current course
            </p>
            <h2 className="mt-1 text-xl font-bold text-emerald-950 dark:text-emerald-100">
              {activeCourse.title}
            </h2>
            <p className="mt-1 text-sm text-emerald-900 dark:text-emerald-200">
              Your lessons and progress are following this course. To switch,
              ask your teacher or an Academy admin.
            </p>
          </div>
          <Link
            to="/academy/lessons"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
          >
            Continue learning
          </Link>
        </section>
      )}

      {offline && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Offline learning mode. Your downloaded course choices are shown on
          this device.
        </p>
      )}

      {/* Feedback on the path the student is actually following, rather than a
          review form per course they might never open. */}
      {activeCourse?.id && <CourseReviews courseId={activeCourse.id} />}

      {state === "loading" && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Loading published courses...
        </p>
      )}
      {state === "error" && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          Courses could not be loaded. Please try again later.
        </div>
      )}
      {state === "ready" && courses.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <h2 className="font-bold">Learning paths are on the way</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Your teacher is preparing learning paths. Check back soon.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {courses.map((course) => {
          const subjectName = course.academy_subjects?.name ?? null;
          const isActive = activeCourse?.id === course.id;
          const isLocked = Boolean(activeCourse) && !isActive;
          return (
            <article
              key={course.id}
              className={`rounded-2xl border border-l-4 bg-white p-6 shadow-sm dark:bg-slate-900 ${
                isActive
                  ? "border-emerald-300 border-l-emerald-500 ring-1 ring-emerald-200 dark:border-emerald-900 dark:border-l-emerald-500 dark:ring-emerald-950"
                  : isLocked
                    ? "border-slate-200 border-l-slate-300 bg-slate-50/80 dark:border-slate-800 dark:border-l-slate-700 dark:bg-slate-950/50"
                    : "border-slate-200 border-l-teal-400 dark:border-slate-800 dark:border-l-teal-500"
              }`}
            >
              <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {/* Resolved once, so the guard and the use cannot drift apart.
                    Reading it twice meant safety depended on the line above, which
                    no linter and no reviewer can verify. */}
                {subjectName && <span>{subjectName}</span>}
                {isActive && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Current path
                  </span>
                )}
                {isLocked && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Locked
                  </span>
                )}
              </div>
              <h2 className="mt-3 text-xl font-bold">{course.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {course.description || "A structured Academy learning path."}
              </p>
              <div className="mt-5 flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  {course.duration_weeks} weeks
                </span>
                <Link
                  className="font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                  to="/academy/lessons"
                >
                  View lessons
                </Link>
              </div>
              {isLocked && (
                <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-5 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                  This course is locked while you are on{" "}
                  <strong className="font-semibold">{activeCourse.title}</strong>
                  . You cannot select another course yourself. Ask your teacher
                  or an Academy admin if you need to switch.
                </p>
              )}
              <button
                type="button"
                className={`mt-4 min-h-11 w-full rounded-lg px-4 py-2 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  isLocked
                    ? "cursor-not-allowed border border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    : isActive
                      ? "cursor-not-allowed border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                      : "bg-amber-500 text-slate-950 hover:bg-amber-400 focus-visible:outline-amber-600 disabled:cursor-wait disabled:opacity-70"
                }`}
                disabled={
                  Boolean(activeCourse) ||
                  selecting === course.id ||
                  isActive ||
                  isLocked ||
                  offline
                }
                onClick={() => selectCourse(course.id)}
              >
                {isActive
                  ? "Your current course"
                  : isLocked
                    ? `Locked while you’re on ${activeCourse.title}`
                    : selecting === course.id
                      ? "Selecting..."
                      : offline
                        ? "Connect to select this course"
                      : "Select this course"}
              </button>
              {isActive && <DownloadedCourseManager course={course} />}
            </article>
          );
        })}
      </div>

      {notice && (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
          {notice}
        </p>
      )}
    </div>
  );
}
