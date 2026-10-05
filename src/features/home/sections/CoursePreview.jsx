import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Container } from "../../../components/layout/Container";
import { courseSummary, fetchPublicCourses } from "../../../lib/publicCourses";

export const CoursePreview = () => {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    let mounted = true;
    fetchPublicCourses()
      .then((publishedCourses) => {
        if (mounted) setCourses(publishedCourses);
      })
      .catch((error) => {
        console.warn("Home course preview unavailable:", error);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="py-16 md:py-24">
      <Container>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-500 dark:text-blue-400">
              Learn by building
            </p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
              Practical technology courses.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Structured learning for programming, AI, and embedded systems.
            </p>
          </div>
          <Link
            to="/courses"
            className="font-semibold text-blue-600 dark:text-blue-400"
          >
            Browse courses at Algorise Tech Explorers
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {courses.map((course) => (
            <Link
              key={course.slug}
              to={`/courses/${course.slug}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
                {course.language || "Course"}
              </p>
              <h3 className="mt-3 font-bold">{course.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {courseSummary(course)}
              </p>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
};
