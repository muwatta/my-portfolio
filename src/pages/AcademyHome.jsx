import { Link } from "react-router-dom";
import { useTheme } from "../context/useTheme";
import AcademyFooter from "../components/academy/AcademyFooter";

const tracks = [
  {
    name: "Python for AI/ML",
    detail: "Data, models, and the math underneath them.",
    accent: "teal",
  },
  {
    name: "C++ for embedded systems",
    detail: "Firmware, microcontrollers, real hardware.",
    accent: "violet",
  },
  {
    name: "PictoBlox intro track",
    detail: "A visual on-ramp for first-time builders.",
    accent: "amber",
  },
];

const learningSteps = [
  {
    n: "01",
    title: "Learn",
    body: "Build foundations across software and hardware, taught by people who ship both.",
  },
  {
    n: "02",
    title: "Build",
    body: "Turn each concept into working code the same week you learn it.",
  },
  {
    n: "03",
    title: "Practice",
    body: "Work through exercises with feedback that tells you what to fix, not just what's wrong.",
  },
  {
    n: "04",
    title: "Apply",
    body: "Ship a real project in web, C++, embedded, or AI/ML by the end of the cohort.",
  },
];

const accentClasses = {
  teal: {
    dot: "bg-teal-500",
    text: "text-teal-700 dark:text-teal-300",
    ring: "ring-teal-500/20",
  },
  violet: {
    dot: "bg-violet-500",
    text: "text-violet-700 dark:text-violet-300",
    ring: "ring-violet-500/20",
  },
  amber: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500/20",
  },
};

export default function AcademyHome() {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-[#F2F4F8] text-[#101425] dark:bg-[#0B0F1A] dark:text-slate-100">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .ate-hero-in {
            animation: ate-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          .ate-hero-in-delay {
            animation: ate-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both;
          }
        }
        @keyframes ate-rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-8">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight">Algorise Tech Explorers</span>
        </Link>
        <button
          type="button"
          className="min-h-11 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500"
          onClick={toggle}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </header>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="ate-hero-in">
          <h1 className="max-w-xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Build things that actually run.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-7 text-slate-600 dark:text-slate-300">
            A hands-on program in Python for AI/ML and C++ for embedded systems,
            for students who'd rather ship a project than sit through another
            slideshow. PictoBlox gives first-timers a way in.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/academy/signup"
              className="inline-flex min-h-11 items-center rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              Apply to Academy
            </Link>
            <Link
              to="/academy/login"
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:text-white dark:hover:border-slate-500"
            >
              Student sign in
            </Link>
          </div>
        </div>

        <div className="ate-hero-in-delay grid gap-3">
          {tracks.map((track) => {
            const a = accentClasses[track.accent];
            return (
              <div
                key={track.name}
                className={`rounded-2xl border border-slate-200 bg-white p-5 ring-1 ${a.ring} dark:border-slate-800 dark:bg-slate-900`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${a.dot}`}
                    aria-hidden="true"
                  />
                  <p className={`text-sm font-semibold ${a.text}`}>
                    {track.name}
                  </p>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {track.detail}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Learning path */}
      <section className="mx-auto w-full max-w-6xl border-t border-slate-200 px-4 py-14 sm:px-8 dark:border-slate-800">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight">
            How the cohort runs
          </h2>
          <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
            Four stages, repeated for every module, so students always know
            what's next.
          </p>
        </div>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {learningSteps.map((step) => (
            <li
              key={step.title}
              className="border-t-2 border-slate-900 pt-4 dark:border-slate-100"
            >
              <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">
                {step.n}
              </span>
              <h3 className="mt-1 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-8 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-xl font-bold">Ready to start learning?</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Applications for the next cohort are open now.
            </p>
          </div>
          <Link
            to="/academy/signup"
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
          >
            Start your application
          </Link>
        </div>
      </section>

      {/* Footer */}
      <AcademyFooter isPublic />
    </div>
  );
}
