import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getAcademyAdminPractice,
  getAcademyProjects,
  getAcademyTeacherAssignments,
} from "../lib/academy";
import ProgressBar from "../components/academy/ProgressBar";

const counts = (items) => items.length;

export default function AcademyAdminContent() {
  const [lessons, setLessons] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAcademyAdminPractice(),
      getAcademyTeacherAssignments(),
      getAcademyProjects(null),
    ]).then(([practiceResult, assignmentResult, projectResult]) => {
      if (cancelled) return;
      setLessons(practiceResult.data?.lessons ?? []);
      setExercises(practiceResult.data?.exercises ?? []);
      setAssignments(assignmentResult.data ?? []);
      setProjects(projectResult.data ?? []);
      setState(
        practiceResult.error || assignmentResult.error || projectResult.error
          ? "error"
          : "ready",
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const weeks = useMemo(() => {
    const byWeek = new Map();
    lessons.forEach((lesson) => {
      const weekNumber = lesson.academy_weeks?.week_number ?? 0;
      if (!byWeek.has(weekNumber)) byWeek.set(weekNumber, []);
      byWeek.get(weekNumber).push(lesson);
    });
    return [...byWeek.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([weekNumber, weekLessons]) => ({
        weekNumber,
        lessons: weekLessons
          .slice()
          .sort(
            (left, right) =>
              (left.sort_order ?? 0) - (right.sort_order ?? 0) ||
              (left.lesson_number ?? 0) - (right.lesson_number ?? 0),
          ),
      }));
  }, [lessons]);

  const exercisesByLesson = useMemo(() => {
    const map = new Map();
    exercises.forEach((exercise) => {
      if (!exercise.lesson_id) return;
      map.set(exercise.lesson_id, (map.get(exercise.lesson_id) ?? 0) + 1);
    });
    return map;
  }, [exercises]);

  const assignmentsByLesson = useMemo(() => {
    const map = new Map();
    assignments.forEach((assignment) => {
      if (!assignment.lesson_id) return;
      map.set(
        assignment.lesson_id,
        (map.get(assignment.lesson_id) ?? 0) + 1,
      );
    });
    return map;
  }, [assignments]);

  const publishedAssignments = assignments.filter(
    (assignment) => !assignment.is_draft,
  );
  const publishedExercises = exercises.filter((exercise) => exercise.published);
  const milestoneTotal = projects.reduce(
    (total, project) =>
      total + (project.academy_project_milestones?.length ?? 0),
    0,
  );
  const completion =
    lessons.length === 0
      ? 0
      : Math.round(
          (lessons.filter((lesson) => lesson.published).length /
            lessons.length) *
            100,
        );

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Curriculum
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Course content</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          One place to review what students learn, in the order they learn it.
          Lessons, practice, assignments, projects and materials are grouped
          here so nothing is duplicated across the menu.
        </p>
      </header>

      {state === "loading" && <p>Loading course content...</p>}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
        >
          Some content could not be loaded. Use the section links below to open
          each area directly.
        </p>
      )}

      {state === "ready" && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Lessons", value: lessons.length, to: "/academy/admin/lessons" },
              {
                label: "Practice exercises",
                value: publishedExercises.length,
                to: "/academy/admin/practice",
              },
              {
                label: "Published assignments",
                value: publishedAssignments.length,
                to: "/academy/admin/assignments",
              },
              {
                label: "Project milestones",
                value: milestoneTotal,
                to: "/academy/admin/projects",
              },
            ].map((card) => (
              <Link
                key={card.label}
                to={card.to}
                className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {card.label}
                </p>
                <p className="mt-2 text-3xl font-bold">{card.value}</p>
              </Link>
            ))}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl font-bold">Publishing progress</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {lessons.length
                ? `${lessons.filter((lesson) => lesson.published).length} of ${lessons.length} lessons are visible to students.`
                : "No lessons have been created yet."}
            </p>
            <div className="mt-4">
              <ProgressBar value={completion} label="Lessons published" />
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Learning sequence</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Weeks in order, with the practice and assignments attached to
                  each lesson.
                </p>
              </div>
              <Link to="/academy/admin/lessons" className="button-secondary">
                Edit lessons
              </Link>
            </div>

            {weeks.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm dark:border-slate-700">
                No lessons yet. Create a course, then add lessons to build the
                sequence.
              </p>
            )}

            {weeks.map((week) => (
              <article
                key={week.weekNumber}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              >
                <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950">
                  <h3 className="font-bold">Week {week.weekNumber}</h3>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {counts(week.lessons)} lessons
                  </span>
                </header>
                <ol className="divide-y divide-slate-100 dark:divide-slate-800">
                  {week.lessons.map((lesson, index) => {
                    const practiceCount = exercisesByLesson.get(lesson.id) ?? 0;
                    const assignmentCount =
                      assignmentsByLesson.get(lesson.id) ?? 0;
                    return (
                      <li
                        key={lesson.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-cyan-300">
                            Lesson {index + 1}
                            {lesson.lesson_number ? ` · #${lesson.lesson_number}` : ""}
                          </p>
                          <p className="mt-1 font-semibold">{lesson.title}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {practiceCount} practice · {assignmentCount}{" "}
                            assignment{assignmentCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/academy/admin/lessons?lesson=${lesson.id}`}
                            className="button-secondary px-3 py-1.5 text-xs"
                          >
                            Lesson
                          </Link>
                          <Link
                            to={`/academy/admin/practice?lesson=${lesson.id}`}
                            className="button-secondary px-3 py-1.5 text-xs"
                          >
                            Practice
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </article>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-xl font-bold">Assignments in order</h2>
              <ol className="mt-4 space-y-2 text-sm">
                {assignments.length === 0 && (
                  <li className="text-slate-500">No assignments yet.</li>
                )}
                {assignments.map((assignment, index) => (
                  <li
                    key={assignment.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0 truncate">
                      <span className="mr-2 text-xs font-bold text-slate-400">
                        {index + 1}
                      </span>
                      {assignment.title}
                    </span>
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        assignment.is_draft
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {assignment.is_draft ? "Draft" : "Published"}
                    </span>
                  </li>
                ))}
              </ol>
              <Link
                to="/academy/admin/assignments"
                className="button-secondary mt-4"
              >
                Manage assignments
              </Link>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-xl font-bold">Projects in order</h2>
              <ol className="mt-4 space-y-3 text-sm">
                {projects.length === 0 && (
                  <li className="text-slate-500">No projects yet.</li>
                )}
                {projects.map((project) => (
                  <li key={project.id}>
                    <p className="font-semibold">{project.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {(project.academy_project_milestones ?? [])
                        .map((milestone) => milestone.milestone_number)
                        .filter(Boolean)
                        .join(" → ") || "No milestones"}
                    </p>
                  </li>
                ))}
              </ol>
              <Link to="/academy/admin/projects" className="button-secondary mt-4">
                Manage projects
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
