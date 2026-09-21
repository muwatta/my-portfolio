import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getAcademyLesson,
  markLessonComplete,
  markLessonStarted,
} from "../lib/academy";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import LessonContent from "../components/academy/LessonContent";

export default function AcademyLesson() {
  const { id } = useParams();
  const { user } = useAcademyAuth();
  const [lesson, setLesson] = useState(null);
  const [state, setState] = useState("loading");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    markLessonStarted(id, user.id);
    getAcademyLesson(id, user.id).then(({ data, error, configured }) => {
      setLesson(data);
      setCompleted(Boolean(data?.progress?.completed_at));
      setState(error ? "error" : configured ? "ready" : "unconfigured");
    });
  }, [id, user.id]);

  async function completeLesson() {
    const { error } = await markLessonComplete(id, user.id);
    if (!error) setCompleted(true);
  }

  if (state === "loading") return <p>Loading lesson...</p>;
  if (state === "unconfigured")
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Connect Supabase to load this lesson.
      </p>
    );
  if (state === "error" || !lesson)
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
      >
        This lesson could not be found.
      </p>
    );

  const content = lesson.content || {};
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
          Week {lesson.academy_weeks.week_number}
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          {lesson.title}
        </h1>
      </header>
      <section>
        <h2 className="text-xl font-bold">What you will learn</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
          {lesson.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
      </section>
      <LessonContent content={content} />
      {lesson.exercises?.length > 0 && (
        <section className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
          <h2 className="text-xl font-bold">Practice for this lesson</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {lesson.exercises.length} exercise
            {lesson.exercises.length === 1 ? "" : "s"} available.
          </p>
          <Link
            className="button-primary mt-4 inline-flex"
            to="/academy/practice"
          >
            Open practice
          </Link>
        </section>
      )}
      <button
        type="button"
        className="button-primary"
        onClick={completeLesson}
        disabled={completed}
      >
        {completed ? "Lesson completed" : "Mark lesson complete"}
      </button>
    </article>
  );
}
