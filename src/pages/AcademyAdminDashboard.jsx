import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAcademyAdminOverview } from "../lib/academy";

export default function AcademyAdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [state, setState] = useState("loading");
  useEffect(() => {
    getAcademyAdminOverview().then(({ data, error }) => {
      setOverview(data);
      setState(error ? "error" : "ready");
    });
  }, []);
  const cards = [
    ["Students", overview?.students ?? 0],
    ["Teachers", overview?.teachers ?? 0],
    ["Courses", overview?.courses ?? 0],
    ["Active learners", overview?.activeLearners ?? 0],
  ];
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Academy administration
        </p>
        <h1 className="mt-2 text-3xl font-bold">Admin overview</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Manage people, curriculum, and activity from one protected workspace.
        </p>
      </header>
      {state === "loading" && <p>Loading overview...</p>}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          Admin data could not be loaded. Check administrator RLS permissions.
        </p>
      )}
      {state === "ready" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(([label, value]) => (
              <div
                key={label}
                className="border-l-4 border-cyan-400 bg-white p-5 shadow-sm dark:bg-slate-900"
              >
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="button-primary" to="/academy/admin/students">
              Manage students
            </Link>
            <Link className="button-secondary" to="/academy/teacher/courses">
              Manage courses
            </Link>
            <Link className="button-secondary" to="/academy/teacher/lessons">
              Manage lessons
            </Link>
            <Link className="button-secondary" to="/academy/admin/access">
              Manage access
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
