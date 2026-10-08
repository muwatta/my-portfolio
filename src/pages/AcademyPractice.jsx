import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  getAcademyExercises,
  getAcademyLesson,
  getNextAcademyLesson,
  markLessonComplete,
  submitObjectiveAnswer,
} from "../lib/academy";
import CppEditor from "../components/academy/CppEditor";
import PythonEditor from "../components/academy/PythonEditor";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { friendlyError } from "../lib/utils";
import { fetchWithOfflineFallback } from "../lib/academyOffline";
import {
  getOfflineRecord,
  OFFLINE_STORES,
  putOfflineRecord,
} from "../lib/offlineStore";
import { enqueueAcademyOperation } from "../lib/academySync";
import AcademyConnectionState from "../components/academy/AcademyConnectionState";
import ProtectedContent from "../components/academy/ProtectedContent";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

const makeOperationId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `practice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const makeSessionId = () =>
  globalThis.crypto?.randomUUID?.() ||
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });

export default function AcademyPractice() {
  const { user } = useAcademyAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedLessonId = searchParams.get("lesson");
  const practiceSessionId = searchParams.get("session");
  const [exercises, setExercises] = useState([]);
  const [state, setState] = useState("loading");
  const [loadError, setLoadError] = useState(null);
  const [offline, setOffline] = useState(false);
  const [answers, setAnswers] = useState({});
  const [codeDrafts, setCodeDrafts] = useState({});
  const [operationIds, setOperationIds] = useState({});
  const [results, setResults] = useState({});
  const [submitting, setSubmitting] = useState(null);
  const [loadedDraftKey, setLoadedDraftKey] = useState(null);
  const [draftSaveState, setDraftSaveState] = useState("idle");
  const [advanceNotice, setAdvanceNotice] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const advancedSession = useRef(null);
  const network = useNetworkStatus();
  const draftKey = selectedLessonId
    ? `practice:${selectedLessonId}:${practiceSessionId || "pending"}`
    : "practice:all";
  const visibleExercises = selectedLessonId
    ? exercises.filter((exercise) => exercise.lesson_id === selectedLessonId)
    : exercises;
  const practiceLanguage = visibleExercises[0]?.language || "python";

  useEffect(() => {
    if (!selectedLessonId) return;
    if (!practiceSessionId) {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set("session", makeSessionId());
          return next;
        },
        { replace: true },
      );
      return;
    }
  }, [practiceSessionId, selectedLessonId, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoadedDraftKey(null);
    setState("loading");
    async function loadPractice() {
      if (!selectedLessonId) {
        setExercises([]);
        setAnswers({});
        setCodeDrafts({});
        setOperationIds({});
        setResults({});
        setOffline(false);
        setLoadError(null);
        setState("ready");
        setLoadedDraftKey(draftKey);
        return;
      }
      if (selectedLessonId && !practiceSessionId) return;
      try {
        const result = await fetchWithOfflineFallback({
          userId: user.id,
          store: OFFLINE_STORES.exercises,
          id: selectedLessonId
            ? `practice:${selectedLessonId}:${practiceSessionId}`
            : undefined,
          fetcher: async () =>
            getAcademyExercises(
              user.id,
              selectedLessonId ? practiceSessionId : null,
            ),
        });
        let draft = null;
        try {
          draft = await getOfflineRecord(
            OFFLINE_STORES.drafts,
            user.id,
            draftKey,
          );
          setDraftSaveState("idle");
        } catch {
          setDraftSaveState("error");
        }
        if (cancelled) return;
        setOffline(Boolean(result.offline));
        setExercises(result.data ?? []);
        setLoadError(result.error ?? null);
        setAnswers(draft?.answers ?? {});
        setCodeDrafts(draft?.codeDrafts ?? {});
        setOperationIds(draft?.operationIds ?? {});
        setResults(draft?.results ?? {});
        setState(
          result.error ? "error" : result.configured ? "ready" : "unconfigured",
        );
        setLoadedDraftKey(draftKey);
      } catch {
        if (cancelled) return;
        setLoadError(new Error("Practice questions could not be loaded."));
        setState("error");
      }
    }
    void loadPractice();
    return () => {
      cancelled = true;
    };
  }, [
    draftKey,
    practiceSessionId,
    reloadToken,
    selectedLessonId,
    user.id,
  ]);

  useEffect(() => {
    if (!selectedLessonId || loadedDraftKey !== draftKey) return undefined;
    const timer = window.setTimeout(() => {
      setDraftSaveState("saving");
      void putOfflineRecord(OFFLINE_STORES.drafts, user.id, draftKey, {
        answers,
        codeDrafts,
        operationIds,
        results: Object.fromEntries(
          Object.entries(results).filter(([, result]) => !result?.error),
        ),
      })
        .then(() => setDraftSaveState("saved"))
        .catch(() => setDraftSaveState("error"));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    answers,
    codeDrafts,
    draftKey,
    loadedDraftKey,
    operationIds,
    results,
    selectedLessonId,
    user.id,
  ]);

  function updateAnswer(exerciseId, answer) {
    setAnswers((current) => ({ ...current, [exerciseId]: answer }));
    setOperationIds((current) => {
      const next = { ...current };
      delete next[exerciseId];
      return next;
    });
    setResults((current) => {
      const next = { ...current };
      delete next[exerciseId];
      return next;
    });
  }

  async function submitAnswer(exerciseId) {
    const answer = answers[exerciseId] || "";
    const clientOperationId = operationIds[exerciseId] || makeOperationId();
    if (!operationIds[exerciseId]) {
      setOperationIds((current) => ({
        ...current,
        [exerciseId]: clientOperationId,
      }));
    }
    setSubmitting(exerciseId);
    try {
      if (!navigator.onLine) {
        await enqueueAcademyOperation(user.id, {
          operationId: clientOperationId,
          type: "objective_answer",
          payload: {
            exerciseId,
            answer,
            clientOperationId,
          },
        });
        setResults((current) => ({
          ...current,
          [exerciseId]: { pending: true },
        }));
        return;
      }
      const { data, error } = await submitObjectiveAnswer(
        exerciseId,
        answer,
        clientOperationId,
      );
      setResults((current) => ({
        ...current,
        [exerciseId]: error
          ? { error: friendlyError(error, "Your answer could not be checked.") }
          : data,
      }));
    } catch (error) {
      setResults((current) => ({
        ...current,
        [exerciseId]: {
          error: friendlyError(error, "Your answer could not be checked."),
        },
      }));
    } finally {
      setSubmitting(null);
    }
  }

  const sessionPassed =
    Boolean(selectedLessonId && practiceSessionId) &&
    visibleExercises.length > 0 &&
    visibleExercises.every((exercise) => {
      const result = results[exercise.id];
      return (
        !result?.error &&
        !result?.pending &&
        (result?.passed > 0 ||
          (Number(result?.max_score) > 0 &&
            Number(result?.score) >= Number(result?.max_score)))
      );
    });

  useEffect(() => {
    if (state !== "ready" || !sessionPassed || !selectedLessonId || !practiceSessionId) {
      return undefined;
    }
    if (advancedSession.current === practiceSessionId) return undefined;
    advancedSession.current = practiceSessionId;
    let cancelled = false;

    async function advanceToNextPhase() {
      const lessonResult = await getAcademyLesson(selectedLessonId, user.id);
      if (cancelled) return;
      if (lessonResult.error || !lessonResult.data) {
        setAdvanceNotice(
          "Practice passed, but the next lesson phase could not be loaded. Your answers are saved; use the lesson link to continue.",
        );
        return;
      }

      const tasks = lessonResult.data.tasks ?? [];
      const allTasksDone = tasks.every((task) => Boolean(task.submission));
      if (tasks.length && !allTasksDone) {
        navigate(
          `/academy/lessons/${encodeURIComponent(selectedLessonId)}?step=task&session=${encodeURIComponent(practiceSessionId)}`,
          { replace: true },
        );
        return;
      }

      const { error } = await markLessonComplete(selectedLessonId, user.id);
      if (cancelled) return;
      if (error) {
        setAdvanceNotice(
          friendlyError(
            error,
            "Practice passed, but the lesson could not be completed yet.",
          ),
        );
        return;
      }
      const nextLesson = await getNextAcademyLesson(user.id, selectedLessonId);
      if (cancelled) return;
      if (nextLesson.error) {
        setAdvanceNotice(
          "The lesson is complete, but the next lesson could not be loaded. Your progress is saved; open the lessons list to continue.",
        );
        return;
      }
      navigate(
        nextLesson.data
          ? `/academy/lessons/${encodeURIComponent(nextLesson.data.id)}`
          : "/academy/lessons",
        { replace: true },
      );
    }

    void advanceToNextPhase();
    return () => {
      cancelled = true;
    };
  }, [
    navigate,
    practiceSessionId,
    selectedLessonId,
    sessionPassed,
    state,
    user.id,
  ]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Practice lab
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          {selectedLessonId
            ? `Lesson practice · ${practiceLanguage === "cpp" ? "C++" : "Python"}`
            : "Practice by lesson"}
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          {selectedLessonId
            ? "This lesson uses teacher-authored practice questions stored in the Academy database."
            : "Choose a lesson to start with its prepared question set from the Academy bank."}
        </p>
      </header>
      {offline && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Offline practice mode. Code runs on this device. Official practice results are checked after reconnecting.
        </p>
      )}
      {draftSaveState === "saved" && (
        <p role="status" className="text-sm text-slate-500">
          Your practice answers and code are saved on this device.
        </p>
      )}
      {draftSaveState === "error" && (
        <p role="alert" className="text-sm text-amber-700">
          Your practice answers could not be saved on this device. Keep this page open until they are submitted.
        </p>
      )}
      {state === "loading" &&
        (selectedLessonId ? (
          <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
            Loading prepared practice questions for this lesson.
          </p>
        ) : (
          <AcademyConnectionState
            loading
            title=""
            description=""
            showChallenge={false}
          />
        ))}
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
          {friendlyError(
            loadError,
            "Practice exercises could not be loaded.",
          )}
        </p>
      )}
      {advanceNotice && (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {advanceNotice}
        </p>
      )}
      {state === "ready" && visibleExercises.length === 0 && (
        selectedLessonId ? (
          <AcademyConnectionState
            online={network.online}
            slow={network.slow}
            title={
              network.online
                ? "No prepared questions are available"
                : "This practice session is not downloaded"
            }
            description={
              network.online
                ? "Ask your teacher to add practice questions for this lesson in the Academy question bank."
                : "Reconnect to load this lesson's saved practice questions. Previously saved practice sessions remain available from their session links."
            }
            onRetry={
              network.online
                ? () => setReloadToken((value) => value + 1)
                : undefined
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
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold">Choose a lesson to practice</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Practice uses prepared questions from the teacher-authored Academy question bank for this lesson.
            </p>
            <Link
              to="/academy/lessons"
              className="button-primary mt-4 inline-flex"
            >
              Open my lessons
            </Link>
          </section>
        )
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
              <CppEditor
                starterCode={exercise.starter_code}
                code={codeDrafts[exercise.id]}
                onCodeChange={(code) =>
                  setCodeDrafts((current) => ({
                    ...current,
                    [exercise.id]: code,
                  }))
                }
              />
            ) : (
              <PythonEditor
                starterCode={exercise.starter_code}
                code={codeDrafts[exercise.id]}
                onCodeChange={(code) =>
                  setCodeDrafts((current) => ({
                    ...current,
                    [exercise.id]: code,
                  }))
                }
              />
            )
          ) : (
            <div className="space-y-4">
              {exercise.question_type === "short_answer" ? (
                <input
                  className="field"
                  value={answers[exercise.id] || ""}
                  onChange={(event) =>
                    updateAnswer(exercise.id, event.target.value)
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
                            updateAnswer(exercise.id, event.target.value)
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
              {results[exercise.id] &&
                !results[exercise.id].error &&
                !results[exercise.id].pending && (
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
