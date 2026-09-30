import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Container } from "../components/layout/Container";
import Seo from "../components/seo/Seo";
import { fetchPublicCourses, courseSummary, coursePath } from "../lib/publicCourses";
import { ACADEMY } from "../data/academy";
import { fetchCourses } from "../lib/courses";

// The course catalogue is the sitemap route into the academy, so it links to
// every public course by its real name. Anchor text is the course title, which
// is the phrase someone would actually search for.
export default function PublicCourses() {
  const [academyCourses, setAcademyCourses] = useState([]);
  const [studioCourses, setStudioCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPublicCourses(), fetchCourses()])
      .then(([academy, studio]) => {
        if (cancelled) return;
        setAcademyCourses(academy);
        setStudioCourses(studio);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allCourses = [
    ...academyCourses.map((course) => ({
      key: `academy-${course.slug}`,
      slug: course.slug,
      title: course.title,
      summary: courseSummary(course),
      meta: course.durationWeeks
        ? `${course.durationWeeks} weeks`
        : course.language || "Online",
      href: coursePath(course.slug),
    })),
    ...studioCourses.map((course) => ({
      key: `studio-${course.slug}`,
      slug: course.slug,
      title: course.title,
      summary: course.description,
      meta: course.duration || course.level || "Online",
      href: coursePath(course.slug),
    })),
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Courses at ${ACADEMY.name}`,
    itemListElement: allCourses.map((course, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: course.title,
      url: `https://www.muwatta.com.ng${course.href}`,
    })),
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Seo
        title={`Courses | ${ACADEMY.name}`}
        description={`Programming, C++ and embedded systems, and terminal courses taught at ${ACADEMY.name}, with weekly lessons, graded exercises, and projects.`}
        path="/courses"
        jsonLd={jsonLd}
      />
      <Container className="py-16">
        <header className="max-w-3xl">
          <h1 className="text-3xl font-bold sm:text-4xl">Courses</h1>
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            Every course runs in weekly lessons with exercises that are graded as
            you go, so you find out what to fix while it is still fresh. Start
            with{" "}
            <Link to={ACADEMY.path} className="font-semibold text-cyan-600 hover:underline">
              {ACADEMY.name}
            </Link>
            .
          </p>
        </header>

        {loading ? (
          <p className="mt-12 text-slate-500">Loading courses…</p>
        ) : allCourses.length === 0 ? (
          <p className="mt-12 text-slate-500">
            No published courses right now.{" "}
            <Link to={ACADEMY.path} className="font-semibold text-cyan-600 hover:underline">
              {ACADEMY.name}
            </Link>{" "}
            has the latest.
          </p>
        ) : (
          <ul className="mt-12 grid gap-6 sm:grid-cols-2">
            {allCourses.map((course) => (
              <li
                key={course.key}
                className="rounded-xl border border-slate-200 p-6 dark:border-slate-800"
              >
                <h2 className="text-lg font-semibold">
                  <Link
                    to={course.href}
                    className="hover:text-cyan-600 hover:underline"
                  >
                    {course.title}
                  </Link>
                </h2>
                <p className="mt-1 text-sm uppercase tracking-wide text-slate-500">
                  {course.meta}
                </p>
                {course.summary ? (
                  <p className="mt-3 text-slate-600 dark:text-slate-300">
                    {course.summary}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Container>
    </div>
  );
}
