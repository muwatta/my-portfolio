import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { Link } from "react-router-dom";

export default function AcademyProfile() {
  const { user, profile } = useAcademyAuth();
  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Your account
        </p>
        <h1 className="mt-2 text-3xl font-bold">Profile</h1>
      </header>
      <section className="border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-cyan-500 text-2xl font-bold text-slate-950">
            {(profile?.display_name || user?.email || "S")
              .charAt(0)
              .toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold">
              {profile?.display_name || "Student"}
            </h2>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>
        <dl className="mt-8 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500">Role</dt>
            <dd className="mt-1 font-semibold">Student</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Level</dt>
            <dd className="mt-1 font-semibold">
              {profile?.academy_levels?.name || "Pending assignment"}
            </dd>
          </div>
        </dl>
      </section>
      <Link className="button-secondary inline-flex" to="/academy/dashboard">
        Back to dashboard
      </Link>
    </div>
  );
}
