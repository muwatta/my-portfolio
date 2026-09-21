import { Link } from "react-router-dom";
import { useAcademyAuth } from "../context/AcademyAuthContext";

const cards = [
  {
    label: "Completed lessons",
    value: "0",
    detail: "Your lesson history will appear here.",
  },
  {
    label: "Pending assignments",
    value: "0",
    detail: "No assignments have been assigned yet.",
  },
  {
    label: "Current week",
    value: "1 / 11",
    detail: "Start with Python foundations.",
  },
];

export default function AcademyDashboard() {
  const { profile, user } = useAcademyAuth();
  const name = profile?.display_name || user?.email?.split("@")[0] || "Student";

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-xl sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Python → AI/ML
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Good to see you, {name}.
        </h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          Build the programming habits that make data and machine learning
          easier to understand.
        </p>
        <Link
          to="/academy/lessons"
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300"
        >
          Start your first lesson
        </Link>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {card.label}
            </p>
            <p className="mt-3 text-3xl font-bold">{card.value}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {card.detail}
            </p>
          </div>
        ))}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-bold">Your learning path</h2>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full w-0 rounded-full bg-blue-600" />
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Progress is calculated from completed lessons, exercises, and
          assignments.
        </p>
      </section>
    </div>
  );
}
