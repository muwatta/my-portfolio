import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAcademyStudentProfile } from "../lib/academy";

export default function AcademyAdminStudentProfile() {
  const { studentId } = useParams();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  useEffect(() => {
    getAcademyStudentProfile(studentId).then(({ data: result, error }) => {
      setData(result);
      setState(error ? "error" : "ready");
    });
  }, [studentId]);
  const profile = data?.profile;
  const overview = data?.overview;
  return (
    <div className="max-w-3xl space-y-8">
      <Link
        className="text-sm font-semibold text-blue-600"
        to="/academy/admin/students"
      >
        ← All students
      </Link>
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Student profile
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          {profile?.display_name || "Student"}
        </h1>
      </header>
      {state === "loading" && <p>Loading profile...</p>}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          Student profile could not be loaded.
        </p>
      )}
      {state === "ready" && (
        <>
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="border-l-4 border-cyan-400 bg-white p-5 dark:bg-slate-900">
              <p className="text-sm text-slate-500">Level</p>
              <p className="mt-2 text-xl font-bold">
                {profile?.academy_levels?.name || "Unassigned"}
              </p>
            </div>
            <div className="border-l-4 border-cyan-400 bg-white p-5 dark:bg-slate-900">
              <p className="text-sm text-slate-500">Course</p>
              <p className="mt-2 text-xl font-bold">
                {overview?.enrollment?.academy_courses?.title || "Not enrolled"}
              </p>
            </div>
            <div className="border-l-4 border-cyan-400 bg-white p-5 dark:bg-slate-900">
              <p className="text-sm text-slate-500">Learning time</p>
              <p className="mt-2 text-xl font-bold">
                {Math.floor((overview?.learningSeconds || 0) / 3600)}h
              </p>
            </div>
            <div className="border-l-4 border-cyan-400 bg-white p-5 dark:bg-slate-900">
              <p className="text-sm text-slate-500">Badges</p>
              <p className="mt-2 text-xl font-bold">
                {overview?.badges?.length || 0}
              </p>
            </div>
          </section>
          <section className="border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl font-bold">Recent scheduled activity</h2>
            {overview?.schedules?.length ? (
              <ul className="mt-4 space-y-2">
                {overview.schedules.map((item) => (
                  <li key={item.id} className="text-sm">
                    {item.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No upcoming activity.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
