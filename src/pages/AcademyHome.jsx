import { Link } from "react-router-dom";
import { useTheme } from "../context/useTheme";

const learningSteps = [
  ["Learn", "Build foundations across software and hardware."],
  ["Build", "Turn each concept into practical code."],
  ["Practice", "Work through exercises with useful feedback."],
  ["Apply", "Ship projects in web, C++, embedded, or AI/ML."],
];

export default function AcademyHome() {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-6xl justify-end">
        <button
          type="button"
          className="button-secondary min-h-9 px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2"
          onClick={toggle}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>
      <section className="mx-auto grid w-full max-w-6xl gap-8 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Algorise Tech Explorers · ATE Academy
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight sm:text-6xl">
            Learn. Build. Practice. Grow.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
            A practical learning environment focused first on Python for
            artificial intelligence and machine learning, alongside C++ for
            embedded systems. PictoBlox can support introductory activities as
            the curriculum expands.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/academy/signup"
              className="inline-flex min-h-11 items-center rounded-lg bg-cyan-400 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2"
            >
              Apply to Academy
            </Link>
            <Link
              to="/academy/login"
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 dark:border-slate-700 dark:text-white dark:hover:border-slate-500"
            >
              Student sign in
            </Link>
            <Link
              to="/"
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:text-white dark:hover:border-slate-500"
            >
              Back to portfolio
            </Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {["Python for AI/ML", "C++ for embedded systems", "Assignment submissions"].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {item}
              </p>
              <div className="mt-4 h-1.5 rounded-full bg-cyan-100 dark:bg-slate-800">
                <div className="h-full w-2/3 rounded-full bg-cyan-400" />
              </div>
            </div>
          ))}
        </div>
      </section>
      <footer className="mx-auto w-full max-w-6xl border-t border-slate-200 py-8 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-200">
          Algorise Tech Explorers (ATE)
        </p>
        <p className="mt-1">
          ATE Academy · RC No. RC-8665201 · muwatta.com.ng/academy
        </p>
      </footer>
      <section className="mx-auto w-full max-w-6xl border-t border-slate-200 py-12 dark:border-slate-800">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
            The learning path
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            Learn, build, practice, and apply.
          </h2>
          <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
            Academy is a guided learning environment for students building
            practical software, embedded systems, and AI/ML projects.
          </p>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {learningSteps.map(([title, description]) => (
            <div
              key={title}
              className="border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {description}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6 dark:border-slate-800">
          <div>
            <h2 className="font-bold">Ready to start learning?</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Submit your application to join the next Academy cohort.
            </p>
          </div>
          <Link
            to="/academy/signup"
            className="inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2"
          >
            Start your application
          </Link>
        </div>
      </section>
    </div>
  );
}
