import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getAcademyLesson,
  isAcademyLessonUnlocked,
  markLessonComplete,
  markLessonStarted,
} from "../lib/academy";
import { fetchWithOfflineFallback } from "../lib/academyOffline";
import { OFFLINE_STORES } from "../lib/offlineStore";
import { enqueueAcademyOperation } from "../lib/academySync";
import AcademyConnectionState from "../components/academy/AcademyConnectionState";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { friendlyError } from "../lib/utils";
import LessonContent from "../components/academy/LessonContent";
import TopicStepper from "../components/academy/TopicStepper";
import CppEditor from "../components/academy/CppEditor";
import PythonEditor from "../components/academy/PythonEditor";
import TerminalEditor from "../components/academy/TerminalEditor";

export default function AcademyLesson() {
  const { id } = useParams();
  const { user } = useAcademyAuth();
  const [lesson, setLesson] = useState(null);
  const [state, setState] = useState("loading");
  const [locked, setLocked] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [step, setStep] = useState("learn");
  const [notice, setNotice] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const network = useNetworkStatus();

  useEffect(() => {
    let cancelled = false;
    // Ask the server whether this lesson is available before marking it started
    // or rendering it. Marking first and swallowing the failure, which is what
    // this used to do, meant a locked lesson still displayed its content and the
    // refusal was invisible.
    (async () => {
      const { data: available, error: checkError } = await isAcademyLessonUnlocked(
        id,
        user.id,
      );
      if (cancelled) return;
      // Only an explicit "no" locks the lesson. If the question could not be
      // asked, showing a locked screen would strand a student on a network blip,
      // and it would be a lie about their progress. The server still refuses a
      // locked lesson when it is actually started, so the worst case here is a
      // page whose actions then fail, which is the lesser of the two.
      if (!checkError && available === false) {
        setLocked(true);
        setState("ready");
        return;
      }
      setLocked(false);
      if (navigator.onLine) {
        void markLessonStarted(id, user.id).catch(() => undefined);
      }
      const result = await fetchWithOfflineFallback({
        userId: user.id,
        store: OFFLINE_STORES.lessons,
        id,
        fetcher: () => getAcademyLesson(id, user.id),
      });
      if (cancelled) return;
      const { data, error, configured, offline } = result;
      setLesson(data);
      setCompleted(Boolean(data?.progress?.completed_at));
      setState(error ? "error" : configured ? "ready" : "unconfigured");
      if (offline) setCompleted(Boolean(data?.progress?.completed_at));
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user.id, reloadToken]);

  async function completeLesson() {
    if (!navigator.onLine) {
      await enqueueAcademyOperation(user.id, {
        type: "lesson_complete",
        payload: { lessonId: id, studentId: user.id },
      });
      setCompleted(true);
      setNotice("Lesson completion saved on this device and will sync later.");
      return;
    }
    const { error } = await markLessonComplete(id, user.id);
    if (error) {
      if (!navigator.onLine) {
        await enqueueAcademyOperation(user.id, {
          type: "lesson_complete",
          payload: { lessonId: id, studentId: user.id },
        });
        setCompleted(true);
        setNotice("The connection dropped. Your lesson completion is waiting to sync.");
        return;
      }
      setNotice(
        friendlyError(
          error,
          "The server could not complete this lesson yet. Please try again.",
        ),
      );
      return;
    }
    setNotice("");
    setCompleted(true);
  }

  if (state === "loading")
    return <AcademyConnectionState loading title="" description="" showChallenge={false} />;
  if (state === "unconfigured")
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Connect Supabase to load this lesson.
      </p>
    );
  if (locked)
    return (
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-bold">This lesson is not unlocked yet</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Lessons open in order. Finish the one before this and it will unlock
          straight away, with nothing extra to do.
        </p>
        <Link
          to="/academy/lessons"
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          Back to your lessons
        </Link>
      </section>
    );
  if (state === "error" || !lesson)
    return (
      <AcademyConnectionState
        online={network.online}
        slow={network.slow}
        title={network.online ? "This lesson is not available" : "This lesson is not downloaded"}
        description={
          network.online
            ? "It may still be a draft, or it may have moved. Open the lesson list to see what is published."
            : "Reconnect once to open this lesson, then download the course to keep it available offline."
        }
        onRetry={
          network.online
            ? undefined
            : () => setReloadToken((value) => value + 1)
        }
      >
        <Link to="/academy/lessons" className="button-secondary mt-4 inline-flex">
          Back to lessons
        </Link>
      </AcademyConnectionState>
    );

  const content = lesson.content || {};
  // Driven by academy_courses.language so a new course in a new language needs
  // no change here.
  const courseLanguage = lesson.academy_weeks?.academy_courses?.language ?? "python";
  const courseSlug = lesson.academy_weeks?.academy_courses?.slug ?? "";
  const isCppCourse = courseLanguage === "cpp";
  const isTerminalCourse = courseLanguage === "shell";
  const practice = lesson.exercises ?? [];
  const scoredPractice = practice.filter(
    (exercise) => exercise.question_type !== "programming",
  );
  const tasks = lesson.tasks ?? [];
  const practiceDone = scoredPractice.every((exercise) => exercise.completed);
  const taskDone = tasks.every((task) => Boolean(task.submission));
  const jumpTo = (target) => {
    setStep(target);
    document
      .getElementById(`topic-step-${target}`)
      ?.scrollIntoView({ block: "start" });
  };

  return (
    <article className="max-w-3xl space-y-7">
      <Link
        to="/academy/lessons"
        className="text-sm font-semibold text-blue-600"
      >
        ← All lessons
      </Link>
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Week {lesson.academy_weeks?.week_number ?? "?"}
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          {lesson.title}
        </h1>
      </header>

      <TopicStepper
        current={step}
        learnDone={completed}
        practiceCount={scoredPractice.length}
        taskCount={tasks.length}
        practiceDone={practiceDone}
        taskDone={taskDone}
        onJump={jumpTo}
      />
      <section id="topic-step-learn">
        <h2 className="text-xl font-bold">What you will learn</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
          {(lesson.objectives ?? []).map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
      </section>
      <LessonContent content={content} />
      {isCppCourse && content.starter_code && (
        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
              C++ embedded-systems terminal
            </p>
            <h2 className="mt-1 text-2xl font-bold">Write and run C++</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Edit the starter program, run it in your browser, and experiment
              with the lesson. Hardware calls are simulated here; nothing is
              sent to a device or the server.
            </p>
          </div>
          <CppEditor starterCode={content.starter_code} />
        </section>
      )}
      {isTerminalCourse && content.starter_code && (
        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
              Command terminal
            </p>
            <h2 className="mt-1 text-2xl font-bold">Run the commands yourself</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Type the commands rather than reading about them. This terminal is
              sandboxed in your browser: it has its own small filesystem and only
              the commands from the lesson, and nothing it does reaches your
              computer or the server.
            </p>
          </div>
          <TerminalEditor starterScript={content.starter_code} />
        </section>
      )}
      {/* Optional all the way down. These come from a join, and a lesson whose
          week or course is missing used to throw here and take the whole page
          with it, which is what a blank page with no error is. */}
      {courseSlug === "python-for-ai-machine-learning" && (
        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
              Practice terminal
            </p>
            <h2 className="mt-1 text-2xl font-bold">Rewrite and run the code</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Edit the starter code, run it in your browser, and experiment
              with your own changes. Nothing is sent to the server.
            </p>
          </div>
          <PythonEditor starterCode={content.starter_code || "print('Hello, engineer!')"} />
        </section>
      )}
      {practice.length > 0 && (
        <section
          id="topic-step-practice"
          className="rounded-xl border border-slate-200 p-5 dark:border-slate-800"
        >
          <h2 className="text-xl font-bold">Practice</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {scoredPractice.filter((exercise) => exercise.completed).length} of{" "}
            {scoredPractice.length} scored questions passed. Pass each one to
            unlock the next lesson.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
            {practice.slice(0, 6).map((exercise) => (
              <li key={exercise.id} className="flex items-start gap-2">
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
                <span className="min-w-0 flex-1">{exercise.title}</span>
                {exercise.completed && (
                  <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Passed
                  </span>
                )}
              </li>
            ))}
            {practice.length > 6 ? (
              <li className="text-slate-500">
                and {practice.length - 6} more
              </li>
            ) : null}
          </ul>
          <Link
            className="button-primary mt-4 inline-flex"
            to={`/academy/practice?lesson=${encodeURIComponent(id)}`}
          >
            Start practice
          </Link>
        </section>
      )}

      {tasks.length > 0 && (
        <section
          id="topic-step-task"
          className="rounded-xl border border-slate-200 p-5 dark:border-slate-800"
        >
          <h2 className="text-xl font-bold">Task</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            The work you hand in for this topic.
          </p>
          <ul className="mt-3 space-y-3">
            {tasks.map((task) => {
              const submission = task.submission;
              const result = submission?.academy_submission_results?.[0] ??
                submission?.academy_submission_results;
              const score = result?.final_score ?? result?.objective_score;
              const max = result?.max_score ?? task.points;
              return (
                <li
                  key={task.assignmentId}
                  className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold">{task.title}</p>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {task.points ? `${task.points} points` : null}
                      {task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleString()}` : ""}
                    </span>
                  </div>

                  {submission ? (
                    <div className="mt-2 space-y-1 text-sm">
                      <p className="text-slate-600 dark:text-slate-300">
                        Attempt {submission.attempt_number} submitted
                        {submission.submitted_at
                          ? ` on ${new Date(submission.submitted_at).toLocaleDateString()}`
                          : ""}
                        {" · "}
                        <span className="font-semibold">
                          {submission.status.replace(/_/g, " ")}
                        </span>
                      </p>
                      {score != null ? (
                        <p className="font-semibold">
                          {score}
                          {max ? ` out of ${max}` : ""}
                        </p>
                      ) : null}
                      {result?.teacher_feedback ? (
                        <p className="text-slate-600 dark:text-slate-300">
                          Teacher feedback: {result.teacher_feedback}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Not submitted yet.
                      {task.retryLimit
                        ? ` Up to ${task.retryLimit} attempt${task.retryLimit === 1 ? "" : "s"}.`
                        : ""}
                    </p>
                  )}

                  <Link
                    className="button-secondary mt-3 inline-flex"
                    to={`/academy/assignments/${task.assignmentId}`}
                  >
                    {submission ? "View or resubmit" : "Open task"}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {notice && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{notice}</p>}
      <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
        <h2 className="text-xl font-bold">
          {completed && practiceDone && taskDone
            ? "Topic complete"
            : completed
              ? "Required activities remain"
              : "Finished this topic?"}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {completed
            ? practiceDone && taskDone
              ? "Nice work. The next topic is now unlocked."
              : "Complete every scored practice question and submit each task to unlock the next topic."
            : "Mark it complete to unlock the next topic and add it to your progress."}
        </p>
        <button
          type="button"
          className="button-primary mt-4"
          onClick={completeLesson}
          disabled={completed || !practiceDone || !taskDone}
        >
          {completed
            ? practiceDone && taskDone
              ? "Topic completed"
              : "Complete required activities above"
            : practiceDone && taskDone
              ? "Mark topic complete"
              : "Complete required activities first"}
        </button>
      </div>
    </article>
  );
}
