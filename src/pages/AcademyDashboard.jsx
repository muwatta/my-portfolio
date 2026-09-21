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
  const levelName = profile?.academy_levels?.name || "Level pending";
  const course = overview?.enrollment?.academy_courses;
  const learningMinutes = Math.floor((overview?.learningSeconds ?? 0) / 60);

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
          {profile?.academy_levels?.name
            ? `Your ${profile.academy_levels.name} pathway is ready for your next step.`
            : "Your teacher will assign a level before your pathway begins."}
        </p>
        <Link
          to="/academy/lessons"
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300"
        >
          {nextLesson ? "Continue learning" : "Explore lessons"}
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
            value: progress?.completedLessons ?? 0,
            detail: `${progress?.lessonCount ?? 0} lessons in this course`,
          },
          {
            label: "Pending assignments",
            value: assignmentCount,
            detail: assignmentCount
              ? "Keep your next deadline in sight."
              : "No assignments yet.",
          },
          {
            label: "Current week",
            value: `${progress?.currentWeek ?? 1} / ${course?.duration_weeks ?? 11}`,
            detail: "Your course position is calculated from completions.",
          },
          {
            label: "Learning time",
            value: `${learningMinutes} min`,
            detail:
              "Server-recorded time while Academy was visible and active.",
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
                Your placement
              </p>
              <h2 className="mt-2 text-xl font-bold">{levelName}</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {course?.title || "No course assigned yet"}
              </p>
            </div>
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
              Admin assigned
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Upcoming
          </p>
          {overview?.schedules?.[0] ? (
            <p className="mt-2 font-bold">{overview.schedules[0].title}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              No scheduled activities yet.
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
    </div>
  );
}
