import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAcademyCourses, selectAcademyCourse } from "../lib/academy";
import { useAcademyAuth } from "../hooks/useAcademyAuth";

export default function AcademyCourses() {
  const [courses, setCourses] = useState([]);
  const [state, setState] = useState("loading");
  const [notice, setNotice] = useState("");
  const [selecting, setSelecting] = useState("");
  const { user } = useAcademyAuth();

  useEffect(() => {
    let mounted = true;
    getAcademyCourses().then(({ data, error }) => {
      if (!mounted) return;
      setCourses(data ?? []);
      setState(error ? "error" : "ready");
    });
    return () => {
      mounted = false;
    };
  }, []);

  async function selectCourse(courseId) {
    setSelecting(courseId);
    setNotice("");
    const { error } = await selectAcademyCourse(user.id, courseId);
    setNotice(
      error ? error.message : "Course selected. Your lessons are ready.",
    );
    setSelecting("");
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Your curriculum
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Courses</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Explore published paths in software, C++, embedded systems, Python,
          and AI/ML.
        </p>
      </header>

      {state === "loading" && (
        <p className="text-sm text-slate-500">Loading published courses...</p>
      )}
      {state === "error" && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          Courses could not be loaded. Please try again later.
        </div>
      )}
      {state === "ready" && courses.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <h2 className="font-bold">No courses published yet</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Your teacher will publish learning paths here when they are ready.
          </p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {courses.map((course) => (
          <article
            key={course.id}
            className="border-l-4 border-cyan-400 bg-white p-6 shadow-sm dark:bg-slate-900"
          >
            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {course.academy_subjects?.name && (
                <span>{course.academy_subjects.name}</span>
              )}
            </div>
            <h2 className="mt-3 text-xl font-bold">{course.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {course.description || "A structured Academy learning path."}
            </p>
            <div className="mt-5 flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-500 dark:text-slate-400">
                {course.duration_weeks} weeks
              </span>
              <Link
                className="font-semibold text-blue-600 hover:text-blue-700"
                to="/academy/lessons"
              >
                View lessons
              </Link>
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
              disabled={selecting === course.id}
              onClick={() => selectCourse(course.id)}
            >
              {selecting === course.id ? "Selecting..." : "Select this course"}
            </button>
          </article>
        ))}
      </div>
      {notice && (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
          {notice}
        </p>
      )}
    </div>
  );
}
