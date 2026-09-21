import { Link } from "react-router-dom";
import { useTheme } from "../context/useTheme";

export default function AcademyHome() {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-6xl justify-end">
        <button
          type="button"
          className="button-secondary min-h-9 px-3 py-1.5"
          onClick={toggle}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>
      <section className="mx-auto grid w-full max-w-6xl gap-8 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Muwatta Academy
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight sm:text-6xl">
            Learn Python by building toward AI.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
            A focused learning space for secondary-school students: short
            lessons, practical code, useful feedback, and a clear path through
            11 weeks.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/academy/login"
              className="inline-flex min-h-11 items-center rounded-lg bg-cyan-400 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300"
            >
              Sign in to Academy
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
          {["11-week path", "Practical code", "Clear progress"].map((item) => (
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
    </div>
  );
}
