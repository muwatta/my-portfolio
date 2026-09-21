import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import {
  getAcademyAssignments,
  getAcademyLessons,
  getAcademyProgress,
} from "../lib/academy";
import ProgressBar from "../components/academy/ProgressBar";

export default function AcademyDashboard() {
  const { profile, user } = useAcademyAuth();
  const name = profile?.display_name || user?.email?.split("@")[0] || "Student";
  const [lessons, setLessons] = useState([]);
  const [progress, setProgress] = useState(null);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [state, setState] = useState("loading");

  useEffect(() => {
    Promise.all([
      getAcademyLessons(user.id),
      getAcademyProgress(user.id),
      getAcademyAssignments(),
    ]).then(([lessonResult, progressResult, assignmentResult]) => {
      setLessons(lessonResult.data ?? []);
      setProgress(progressResult.data);
      setAssignmentCount(assignmentResult.data?.length ?? 0);
      setState(
        lessonResult.error || progressResult.error || assignmentResult.error
          ? "error"
          : "ready",
      );
    });
  }, [user.id]);

  const nextLesson =
    lessons.find((lesson) => !lesson.progress?.completed_at) ||
    lessons[lessons.length - 1];

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-xl sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Python → AI/ML
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Good to see you, {name}.
        </h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          Build the programming habits that make data and machine learning
          easier to understand.
        </p>
        <Link
          to="/academy/lessons"
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300"
        >
          Start your first lesson
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
            value: `${progress?.currentWeek ?? 1} / 11`,
            detail: "Your course position is calculated from completions.",
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
