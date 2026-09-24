import { useEffect, useState } from "react";
import { getAcademyExercises, submitObjectiveAnswer } from "../lib/academy";
import PythonEditor from "../components/academy/PythonEditor";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { friendlyError } from "../lib/utils";

export default function AcademyPractice() {
  const { user } = useAcademyAuth();
  const [exercises, setExercises] = useState([]);
  const [state, setState] = useState("loading");
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});
  const [submitting, setSubmitting] = useState(null);

  useEffect(() => {
    getAcademyExercises(user.id).then(({ data, error, configured }) => {
      setExercises(data ?? []);
      setState(error ? "error" : configured ? "ready" : "unconfigured");
    });
  }, [user.id]);

  async function submitAnswer(exerciseId) {
    setSubmitting(exerciseId);
    const { data, error } = await submitObjectiveAnswer(
      exerciseId,
      answers[exerciseId] || "",
    );
    setResults((current) => ({
      ...current,
      [exerciseId]: error
        ? { error: friendlyError(error, "Your answer could not be checked.") }
        : data,
    }));
    setSubmitting(null);
  }

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
          {exercise.question_type === "programming" ? (
            <PythonEditor starterCode={exercise.starter_code} />
          ) : (
            <div className="space-y-4">
              {exercise.question_type === "short_answer" ? (
                <input
                  className="field"
                  value={answers[exercise.id] || ""}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [exercise.id]: event.target.value,
                    }))
                  }
                  placeholder="Type your answer"
                  aria-label={`Answer for ${exercise.title}`}
                />
              ) : (
                <div className="grid gap-2">
                  {(exercise.question_type === "true_false"
                    ? ["true", "false"]
                    : exercise.choices || []
                  ).map((choice) => {
                    const value =
                      typeof choice === "string" ? choice : choice.value;
                    const label =
                      typeof choice === "string" ? choice : choice.label;
                    return (
                      <label
                        key={value}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                      >
                        <input
                          type="radio"
                          name={`exercise-${exercise.id}`}
                          value={value}
                          checked={answers[exercise.id] === value}
                          onChange={(event) =>
                            setAnswers((current) => ({
                              ...current,
                              [exercise.id]: event.target.value,
                            }))
                          }
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <button
                className="button-primary"
                type="button"
                onClick={() => submitAnswer(exercise.id)}
                disabled={submitting === exercise.id || !answers[exercise.id]}
              >
                {submitting === exercise.id ? "Scoring..." : "Submit answer"}
              </button>
              {results[exercise.id]?.error && (
                <p role="alert" className="text-sm text-red-600">
                  {results[exercise.id].error}
                </p>
              )}
              {results[exercise.id] && !results[exercise.id].error && (
                <p
                  role="status"
                  className="text-sm font-semibold text-emerald-600"
                >
                  Score: {results[exercise.id].score} /{" "}
                  {results[exercise.id].max_score}
                </p>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
