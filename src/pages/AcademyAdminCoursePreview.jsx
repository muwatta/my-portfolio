import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft, FiBookOpen, FiCheckCircle, FiEye } from "react-icons/fi";
import LessonContent from "../components/academy/LessonContent";
import { getAcademyCoursePreview } from "../lib/academy";

export default function AcademyAdminCoursePreview() {
  const { courseSlug } = useParams();
  const [course, setCourse] = useState(null);
  const [state, setState] = useState("loading");
  const [selectedLessonId, setSelectedLessonId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setCourse(null);
    setSelectedLessonId(null);
    getAcademyCoursePreview(courseSlug)
      .then(({ data, error }) => {
        if (cancelled) return;
        setCourse(data);
        setState(error ? "error" : data ? "ready" : "not-found");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [courseSlug]);

  const lessons = useMemo(
    () => course?.weeks?.flatMap((week) => week.lessons) ?? [],
    [course],
  );
  const selectedLesson =
    lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0];

  return (
    <div className="space-y-6">
      <Link
        to="/academy/admin"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-900 dark:text-cyan-300 dark:hover:text-cyan-100"
      >
        <FiArrowLeft aria-hidden="true" />
        Admin dashboard
      </Link>

      {state === "loading" && (
        <p role="status" className="rounded-2xl bg-white p-5 text-sm dark:bg-slate-900">
          Loading student-facing course content...
        </p>
      )}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
        >
          Course preview could not be loaded. Check administrator access and try
          again.
        </p>
      )}
      {state === "not-found" && (
        <p
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          This course could not be found.
        </p>
      )}

      {state === "ready" && course && (
        <>
          <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-950 p-6 text-white shadow-xl sm:p-8">
            <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full border-[26px] border-cyan-200/10" />
            <div className="relative">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-cyan-100">
                <FiEye aria-hidden="true" />
                Student view · read only
              </p>
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {course.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                {course.description || "Explore the published learning path as students see it."}
              </p>
              <p className="mt-4 text-sm font-semibold text-cyan-100">
                {course.weeks.length} available weeks · {lessons.length} published lessons
              </p>
            </div>
          </header>

          <div className="grid gap-5 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.5fr)]">
            <section aria-labelledby="preview-outline">
              <h2 id="preview-outline" className="mb-3 text-lg font-bold">
                Course outline
              </h2>
              {course.weeks.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  No published lessons are available to students yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {course.weeks.map((week) => (
                    <details
                      key={week.id}
                      open={week.lessons.some(
                        (lesson) => lesson.id === selectedLesson?.id,
                      )}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <summary className="cursor-pointer rounded-lg font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                        <span className="text-xs font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                          Week {week.week_number}
                        </span>
                        <span className="ml-2">{week.title}</span>
                      </summary>
                      {week.description && (
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          {week.description}
                        </p>
                      )}
                      <ul className="mt-3 space-y-2">
                        {week.lessons.map((lesson) => {
                          const active = lesson.id === selectedLesson?.id;
                          return (
                            <li key={lesson.id}>
                              <button
                                type="button"
                                onClick={() => setSelectedLessonId(lesson.id)}
                                aria-current={active ? "true" : undefined}
                                className={`flex min-h-11 w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                                  active
                                    ? "bg-cyan-50 text-cyan-950 dark:bg-cyan-950/50 dark:text-cyan-100"
                                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                }`}
                              >
                                <FiBookOpen
                                  aria-hidden="true"
                                  className="mt-0.5 shrink-0"
                                />
                                <span>{lesson.title}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  ))}
                </div>
              )}
            </section>

            <section aria-live="polite" aria-labelledby="preview-lesson">
              {selectedLesson ? (
                <article className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                  <header>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">
                      Student lesson preview
                    </p>
                    <h2
                      id="preview-lesson"
                      className="mt-2 text-2xl font-bold tracking-tight"
                    >
                      {selectedLesson.title}
                    </h2>
                  </header>

                  {selectedLesson.objectives?.length > 0 && (
                    <section>
                      <h3 className="font-bold">What students will learn</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                        {selectedLesson.objectives.map((objective) => (
                          <li key={objective}>{objective}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  <LessonContent content={selectedLesson.content ?? {}} />
                  {selectedLesson.content?.starter_code && (
                    <section>
                      <h3 className="font-bold">Lesson starter code</h3>
                      <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">
                        <code>{selectedLesson.content.starter_code}</code>
                      </pre>
                    </section>
                  )}

                  <section className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                      <h3 className="font-bold">Practice</h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {selectedLesson.exercises.length
                          ? `${selectedLesson.exercises.length} published practice ${
                              selectedLesson.exercises.length === 1
                                ? "activity"
                                : "activities"
                            }`
                          : "No published practice yet"}
                      </p>
                      {selectedLesson.exercises.length > 0 && (
                        <ul className="mt-3 space-y-2 text-sm">
                          {selectedLesson.exercises.map((exercise) => (
                            <li key={exercise.id}>
                              <p className="font-semibold">{exercise.title}</p>
                              {exercise.instructions && (
                                <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                                  {exercise.instructions}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                      <h3 className="font-bold">Assignments</h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {selectedLesson.assignments.length
                          ? `${selectedLesson.assignments.length} published ${
                              selectedLesson.assignments.length === 1
                                ? "assignment"
                                : "assignments"
                            }`
                          : "No published assignments yet"}
                      </p>
                      {selectedLesson.assignments.length > 0 && (
                        <ul className="mt-3 space-y-2 text-sm">
                          {selectedLesson.assignments.map((assignment) => (
                            <li key={assignment.id}>
                              <p className="font-semibold">
                                {assignment.title}
                                {assignment.points
                                  ? ` · ${assignment.points} points`
                                  : ""}
                              </p>
                              <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                                {assignment.instructions}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                  <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <FiCheckCircle aria-hidden="true" className="shrink-0" />
                    This preview does not change enrollments, record progress,
                    or submit student work.
                  </p>
                </article>
              ) : (
                <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  Choose a published lesson from the course outline to preview it.
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
