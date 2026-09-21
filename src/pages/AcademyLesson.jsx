import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAcademyLesson, markLessonComplete } from "../lib/academy";
import { useAcademyAuth } from "../context/AcademyAuthContext";

export default function AcademyLesson() {
  const { id } = useParams();
  const { user } = useAcademyAuth();
  const [lesson, setLesson] = useState(null);
  const [state, setState] = useState("loading");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    getAcademyLesson(id).then(({ data, error, configured }) => {
      setLesson(data);
      setState(error ? "error" : configured ? "ready" : "unconfigured");
    });
  }, [id]);

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
      <section className="prose prose-slate max-w-none dark:prose-invert">
        <p>{content.explanation}</p>
        {content.examples?.map((example) => (
          <pre
            key={example}
            className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100"
          >
            <code>{example}</code>
          </pre>
        ))}
        <h2>Why this matters for AI/ML</h2>
        <p>{content.connection}</p>
      </section>
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
