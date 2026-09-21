import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { getAcademyLessons } from "../lib/academy";

export default function AcademyLessons() {
  const [lessons, setLessons] = useState([]);
  const [state, setState] = useState("loading");
  const { user } = useAcademyAuth();

  useEffect(() => {
    getAcademyLessons(user.id).then(({ data, error, configured }) => {
      if (error) setState("error");
      else if (!configured) setState("unconfigured");
      else {
        setLessons(data);
        setState("ready");
      }
    });
  }, [user.id]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Course map
        </p>
        <h1 className="mt-2 text-3xl font-bold">Lessons</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Move from Python foundations to your first machine learning project.
        </p>
      </header>
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
      {state === "ready" && lessons.length === 0 && (
        <p className="rounded-xl border border-slate-200 p-5 text-sm dark:border-slate-800">
          No published lessons yet.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {lessons.map((lesson) => (
          <Link
            key={lesson.id}
            to={`/academy/lessons/${lesson.id}`}
            className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Week {lesson.academy_weeks.week_number}
            </p>
            <h2 className="mt-2 text-lg font-bold">{lesson.title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {lesson.objectives?.join(" · ")}
            </p>
            <p className="mt-4 text-xs font-semibold text-blue-600">
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
    </div>
  );
}
