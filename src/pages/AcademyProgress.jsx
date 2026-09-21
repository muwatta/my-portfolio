import { useEffect, useState } from "react";
import { getAcademyProgress } from "../lib/academy";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import ProgressBar from "../components/academy/ProgressBar";

export default function AcademyProgress() {
  const { user } = useAcademyAuth();
  const [progress, setProgress] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    getAcademyProgress(user.id).then(({ data, error, configured }) => {
      setProgress(data);
      setState(error ? "error" : configured ? "ready" : "unconfigured");
    });
  }, [user.id]);

  if (state === "loading") return <p>Loading your progress...</p>;
  if (state === "unconfigured")
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Connect Supabase to load progress.
      </p>
    );
  if (state === "error")
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
      >
        Progress could not be loaded.
      </p>
    );
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Your learning record
        </p>
        <h1 className="mt-2 text-3xl font-bold">Progress</h1>
      </header>
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <ProgressBar
          value={progress?.completionPercent}
          label="Course completion"
        />
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Lessons completed",
            value: `${progress?.completedLessons} / ${progress?.lessonCount}`,
          },
          { label: "Assignments submitted", value: progress?.submissions ?? 0 },
          { label: "Current week", value: `${progress?.currentWeek} / 11` },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-bold">{item.value}</p>
          </div>
        ))}
      </section>
      <section className="rounded-xl border border-slate-200 p-6 dark:border-slate-800">
        <h2 className="font-bold">Project milestones</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          No project milestones completed yet.
        </p>
      </section>
    </div>
  );
}
