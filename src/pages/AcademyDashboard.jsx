import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import {
  getAcademyAssignments,
  getAcademyLessons,
  getAcademyProgress,
  getAcademyStudentOverview,
} from "../lib/academy";
import ProgressBar from "../components/academy/ProgressBar";

export default function AcademyDashboard() {
  const { profile, user } = useAcademyAuth();
  const name = profile?.display_name || user?.email?.split("@")[0] || "Student";
  const [lessons, setLessons] = useState([]);
  const [progress, setProgress] = useState(null);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [assignments, setAssignments] = useState([]);
  const [overview, setOverview] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    Promise.all([
      getAcademyLessons(user.id),
      getAcademyProgress(user.id),
      getAcademyAssignments(),
      getAcademyStudentOverview(user.id),
    ]).then(
      ([lessonResult, progressResult, assignmentResult, overviewResult]) => {
        setLessons(lessonResult.data ?? []);
        setProgress(progressResult.data);
        setAssignmentCount(assignmentResult.data?.length ?? 0);
        setAssignments(assignmentResult.data ?? []);
        setOverview(overviewResult.data);
        setState(
          lessonResult.error ||
            progressResult.error ||
            assignmentResult.error ||
            overviewResult.error
            ? "error"
            : "ready",
        );
      },
    );
  }, [user.id]);

  const nextLesson =
    lessons.find((lesson) => !lesson.progress?.completed_at) ||
    lessons[lessons.length - 1];
  const course = overview?.enrollment?.academy_courses;
  const learningMinutes = Math.floor((overview?.learningSeconds ?? 0) / 60);
  const hasCourse = Boolean(course);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-xl sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">
          {course?.title || "Academy learning path"}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Good to see you, {name}.
        </h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          {course?.title
            ? "Your learning path is ready. Pick up where you left off — one step at a time."
            : "Choose the learning path you want to explore. Once you pick a course, it becomes your current path."}
        </p>
        <Link
          to={hasCourse ? "/academy/lessons" : "/academy/courses"}
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300"
        >
          {hasCourse
            ? nextLesson
              ? "Continue learning"
              : "Explore lessons"
            : "Choose a learning path"}
        </Link>
      </section>
      {state === "loading" && (
        <p className="text-sm text-slate-500">Loading your course...</p>
      )}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
        >
          Some dashboard data could not be loaded.
        </p>
      )}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Completed lessons",
            value:
              progress == null ? "—" : (progress.completedLessons ?? 0),
            detail:
              progress == null
                ? "Progress is unavailable."
                : `${progress.lessonCount ?? 0} lessons in this course`,
          },
          {
            label: "Pending assignments",
            value: state === "error" ? "—" : assignmentCount,
            detail: state === "error"
              ? "Assignments are unavailable."
              : assignmentCount
              ? "Keep your next deadline in sight."
              : "No assignments yet.",
          },
          {
            label: "Current week",
            value:
              progress?.currentWeek == null || course?.duration_weeks == null
                ? "—"
                : `${progress.currentWeek} / ${course.duration_weeks}`,
            detail:
              progress == null
                ? "Course position is unavailable."
                : "Calculated from completed lessons.",
          },
          {
            label: "Learning time",
            value: overview == null ? "—" : `${learningMinutes} min`,
            detail:
              overview == null
                ? "Learning time is unavailable."
                : "Server-recorded active Academy time.",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {card.label}
            </p>
            <p className="mt-3 text-3xl font-bold">{card.value}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {card.detail}
            </p>
          </div>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Your learning path
              </p>
              <h2 className="mt-2 text-xl font-bold">
                {course?.title || "Path pending"}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {course?.title
                  ? course.duration_weeks
                    ? `A ${course.duration_weeks}-week hands-on path. This is your current path — switching requires your teacher.`
                    : "A hands-on path. This is your current path — switching requires your teacher."
                  : "Choose your first path to start learning with hands-on lessons and projects."}
              </p>
            </div>
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
              {course?.title ? "Selected by you" : "Not started"}
            </span>
          </div>
          <Link
            to="/academy/courses"
            className="mt-5 inline-flex font-semibold text-blue-600 hover:text-blue-700"
          >
            {course?.title ? "View courses" : "Choose a learning path"}
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Upcoming
          </p>
          {overview?.schedules?.[0] ? (
            <>
              <p className="mt-2 font-bold">{overview.schedules[0].title}</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {new Date(overview.schedules[0].starts_at).toLocaleString()}
              </p>
              {overview.schedules[0].activity_type === "live_class" &&
                overview.schedules[0].description?.startsWith(
                  "https://meet.google.com/",
                ) && (
                  <a
                    className="mt-4 inline-flex font-semibold text-blue-600"
                    href={overview.schedules[0].description}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Join live class
                  </a>
                )}
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              No scheduled activities yet.
            </p>
          )}
        </div>
      </section>
      {hasCourse && (
        <section className="rounded-xl border border-cyan-200 bg-cyan-50 p-6 dark:border-cyan-900 dark:bg-cyan-950/30">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
            Today's task
          </p>
          <h2 className="mt-2 text-xl font-bold">
            {overview?.schedules?.[0]?.title ||
              nextLesson?.title ||
              "Continue your current lesson"}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Open your current lesson or pending assignment to keep your learning
            moving.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="button-primary inline-flex"
              to={
                nextLesson
                  ? `/academy/lessons/${nextLesson.id}`
                  : "/academy/lessons"
              }
            >
              Open lesson
            </Link>
            <Link
              className="button-secondary inline-flex"
              to="/academy/assignments"
            >
              View assignments
            </Link>
          </div>
        </section>
      )}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold">Pending assignments</h2>
          <Link
            className="text-sm font-semibold text-blue-600"
            to="/academy/assignments"
          >
            View all
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {assignments.slice(0, 4).map((assignment) => (
            <Link
              key={assignment.id}
              to={`/academy/assignments/${assignment.id}`}
              className="rounded-lg border border-slate-200 p-4 hover:border-blue-400 dark:border-slate-800"
            >
              <p className="font-semibold">{assignment.title}</p>
              <p className="mt-1 text-sm text-slate-500">
                {assignment.due_at
                  ? `Due ${new Date(assignment.due_at).toLocaleDateString()}`
                  : "No due date"}
              </p>
            </Link>
          ))}
          {!assignments.length && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No pending assignments.
            </p>
          )}
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Achievements
            </p>
            <h2 className="mt-1 text-xl font-bold">Earned badges</h2>
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {overview?.badges?.length ?? 0} earned
          </span>
        </div>
        {overview?.badges?.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overview.badges.map((badge) => (
              <div
                key={`${badge.academy_badges?.name}-${badge.awarded_at}`}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <p className="font-semibold">{badge.academy_badges?.name}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {badge.academy_badges?.description}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            Complete meaningful learning activities to earn your first badge.
          </p>
        )}
      </section>
      {hasCourse ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-bold">Your learning path</h2>
          <div className="mt-5">
            <ProgressBar
              value={progress?.completionPercent ?? 0}
              label="Course progress"
            />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Continue learning
              </p>
              <p className="mt-1 font-bold">
                {nextLesson?.title || "No lessons published yet."}
              </p>
            </div>
            {nextLesson && (
              <Link
                className="button-primary inline-flex"
                to={`/academy/lessons/${nextLesson.id}`}
              >
                Open lesson
              </Link>
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-bold">Ready when you are</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Pick a learning path to unlock your lessons, practice, and
            projects.
          </p>
          <Link
            className="button-primary mt-5 inline-flex"
            to="/academy/courses"
          >
            Choose a learning path
          </Link>
        </section>
      )}
    </div>
  );
}
