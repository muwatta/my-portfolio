import { useEffect, useState } from "react";
import { getAcademyExercises } from "../lib/academy";
import PythonEditor from "../components/academy/PythonEditor";
import { useAcademyAuth } from "../hooks/useAcademyAuth";

export default function AcademyPractice() {
  const { user } = useAcademyAuth();
  const [exercises, setExercises] = useState([]);
  const [state, setState] = useState("loading");

  useEffect(() => {
    getAcademyExercises(user.id).then(({ data, error, configured }) => {
      setExercises(data ?? []);
      setState(error ? "error" : configured ? "ready" : "unconfigured");
    });
  }, [user.id]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Practice lab
        </p>
        <h1 className="mt-2 text-3xl font-bold">Practice Python</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Run beginner Python in your browser. The runtime loads only when you
          run code.
        </p>
      </header>
      {state === "loading" && <p>Loading exercises...</p>}
      {state === "unconfigured" && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Connect Supabase to load practice exercises.
        </p>
      )}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
        >
          Practice exercises could not be loaded.
        </p>
      )}
      {state === "ready" && exercises.length === 0 && (
        <p className="rounded-xl border border-slate-200 p-5 text-sm dark:border-slate-800">
          No practice exercises yet.
        </p>
      )}
      {exercises.map((exercise) => (
        <article
          key={exercise.id}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              {exercise.academy_lessons?.title} · {exercise.difficulty}
            </p>
            <h2 className="mt-2 text-xl font-bold">{exercise.title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {exercise.instructions}
            </p>
          </div>
          <PythonEditor starterCode={exercise.starter_code} />
        </article>
      ))}
    </div>
  );
}
