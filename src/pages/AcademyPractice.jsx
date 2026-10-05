import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getAcademyExercises, submitObjectiveAnswer } from "../lib/academy";
import CppEditor from "../components/academy/CppEditor";
import PythonEditor from "../components/academy/PythonEditor";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { friendlyError } from "../lib/utils";
import { fetchWithOfflineFallback } from "../lib/academyOffline";
import { OFFLINE_STORES } from "../lib/offlineStore";
import { enqueueAcademyOperation } from "../lib/academySync";
import AcademyConnectionState from "../components/academy/AcademyConnectionState";
import ProtectedContent from "../components/academy/ProtectedContent";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

export default function AcademyPractice() {
  const { user } = useAcademyAuth();
  const [searchParams] = useSearchParams();
  const selectedLessonId = searchParams.get("lesson");
  const [exercises, setExercises] = useState([]);
  const [state, setState] = useState("loading");
  const [offline, setOffline] = useState(false);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});
  const [submitting, setSubmitting] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const network = useNetworkStatus();
  const visibleExercises = selectedLessonId
    ? exercises.filter((exercise) => exercise.lesson_id === selectedLessonId)
    : exercises;
  const practiceLanguage = visibleExercises[0]?.language || "python";

  useEffect(() => {
    fetchWithOfflineFallback({
      userId: user.id,
      store: OFFLINE_STORES.exercises,
      fetcher: () => getAcademyExercises(user.id),
    }).then(({ data, error, configured, offline: isOffline }) => {
      setOffline(Boolean(isOffline));
      setExercises(data ?? []);
      setState(error ? "error" : configured ? "ready" : "unconfigured");
    });
  }, [user.id, reloadToken]);

  async function submitAnswer(exerciseId) {
    setSubmitting(exerciseId);
    if (!navigator.onLine) {
      const clientOperationId =
        globalThis.crypto?.randomUUID?.() ||
        `practice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await enqueueAcademyOperation(user.id, {
        operationId: clientOperationId,
        type: "objective_answer",
        payload: {
          exerciseId,
          answer: answers[exerciseId] || "",
          clientOperationId,
        },
      });
      setResults((current) => ({
        ...current,
        [exerciseId]: { pending: true },
      }));
      setSubmitting(null);
      return;
    }
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
        <h1 className="mt-2 text-3xl font-bold">
          {selectedLessonId
            ? `Lesson practice · ${practiceLanguage === "cpp" ? "C++" : "Python"}`
            : practiceLanguage === "cpp"
              ? "Practice C++"
              : "Practice Python"}
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          {practiceLanguage === "cpp"
            ? "Read each step, change the starter program, and run it in the beginner console lab."
            : "Run beginner Python in your browser. The runtime loads only when you run code."}
        </p>
      </header>
      {offline && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Offline practice mode. Code runs on this device. Official practice results are checked after reconnecting.
        </p>
      )}
      {state === "loading" && (
        <AcademyConnectionState loading title="" description="" showChallenge={false} />
      )}
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
      {state === "ready" && visibleExercises.length === 0 && (
        <AcademyConnectionState
          online={network.online}
          slow={network.slow}
          title={
            network.online
              ? "No practice exercises yet"
              : "Practice is not downloaded"
          }
          description={
            network.online
              ? "Your teacher has not added practice for this course yet. Keep moving through your lessons while new exercises are prepared."
              : "Reconnect once to download practice exercises. Your saved lessons remain available offline."
          }
          onRetry={
            network.online
              ? undefined
              : () => setReloadToken((value) => value + 1)
          }
        >
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/academy/lessons"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300"
            >
              Continue lessons
            </Link>
            <Link
              to="/academy/materials"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-900/40"
            >
              Browse materials
            </Link>
          </div>
        </AcademyConnectionState>
      )}
      {visibleExercises.map((exercise) => (
        <article
          key={exercise.id}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <ProtectedContent>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              {exercise.academy_lessons?.title} · {exercise.difficulty}
            </p>
            <h2 className="mt-2 text-xl font-bold">{exercise.title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {exercise.instructions}
            </p>
          </ProtectedContent>
           {exercise.question_type === "programming" ? (
             exercise.language === "cpp" ? (
               <CppEditor starterCode={exercise.starter_code} />
             ) : (
               <PythonEditor starterCode={exercise.starter_code} />
             )
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
               {results[exercise.id]?.pending && (
                 <p role="status" className="text-sm text-amber-700">
                   Answer saved on this device. Official checking is waiting for a connection.
                 </p>
               )}
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
