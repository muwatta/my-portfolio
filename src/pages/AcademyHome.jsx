import { Link, Navigate } from "react-router-dom";
import { FiArrowRight, FiBookOpen, FiCpu, FiZap } from "react-icons/fi";
import { useTheme } from "../context/useTheme";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import AcademyFooter from "../components/academy/AcademyFooter";
import AcademyLoadingScreen from "../components/academy/AcademyLoadingScreen";
import Seo from "../components/seo/Seo";
import { ACADEMY } from "../data/academy";

const tracks = [
  {
    name: "Python for AI/ML",
    detail: "Explore data, machine learning, and the ideas behind intelligent systems.",
    label: "Code & intelligence",
    icon: FiZap,
    accent:
      "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-200",
  },
  {
    name: "C++ for embedded systems",
    detail: "Write firmware and learn how code connects to microcontrollers and hardware.",
    label: "Code & hardware",
    icon: FiCpu,
    accent:
      "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
  },
  {
    name: "PictoBlox intro track",
    detail: "Start with visual programming, then grow your confidence to write code.",
    label: "A friendly first step",
    icon: FiBookOpen,
    accent:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  },
];

const learningSteps = [
  {
    n: "01",
    title: "Learn",
    body: "Build foundations in software and hardware with guidance from people who use them.",
  },
  {
    n: "02",
    title: "Build",
    body: "Turn each new idea into something working, while it is still fresh.",
  },
  {
    n: "03",
    title: "Practice",
    body: "Try focused exercises and get feedback that helps you improve.",
  },
  {
    n: "04",
    title: "Apply",
    body: "Bring your skills together in a real project you can share with confidence.",
  },
];

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950";

export default function AcademyHome() {
  const { theme, toggle } = useTheme();
  const { initializing, user, isAdmin, isTeacher } = useAcademyAuth();

  if (initializing) {
    return (
      <AcademyLoadingScreen
        title="Loading Academy"
        subtitle="Checking your account"
      />
    );
  }

  if (user) {
    const dashboard = isAdmin
      ? "/academy/admin"
      : isTeacher
        ? "/academy/teacher"
        : "/academy/dashboard";
    return <Navigate to={dashboard} replace />;
  }

  return (
    <div className="min-h-screen overflow-hidden bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <Seo
        title={`${ACADEMY.name} | Learn Programming, C++ and AI Online`}
        description={`${ACADEMY.name} teaches Python for AI and machine learning and C++ for embedded systems through weekly lessons, graded exercises, and projects you build as you learn.`}
        path={ACADEMY.path}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          name: ACADEMY.name,
          url: ACADEMY.url,
          founder: {
            "@type": "Person",
            name: "Abdullahi Oladipupo Musliudeen",
          },
        }}
      />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5">
        <Link
          to="/academy"
          className={`flex min-w-0 items-center gap-2.5 rounded-lg ${focusRing}`}
          aria-label={`${ACADEMY.name} home`}
        >
          <img
            src="/images/ate-icon-192.png"
            alt=""
            width="40"
            height="40"
            className="h-10 w-10 shrink-0 rounded-xl"
          />
          <span className="max-w-44 text-sm font-extrabold leading-tight tracking-tight sm:max-w-none sm:text-base">
            {ACADEMY.name}
          </span>
        </Link>
        <nav aria-label="Academy links" className="flex shrink-0 items-center gap-2">
          <Link
            to="/academy/faq"
            className={`hidden min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800 sm:inline-flex ${focusRing}`}
          >
            Help
          </Link>
          <button
            type="button"
            className={`min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 ${focusRing}`}
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </nav>
      </header>

      <main>
        <section className="relative isolate border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-32 -z-10 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl"
          />
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:py-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-teal-800 dark:border-teal-900 dark:bg-teal-950/60 dark:text-teal-200">
                <span className="h-2 w-2 rounded-full bg-teal-500" aria-hidden="true" />
                Learn by making
              </p>
              <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                Build things that actually run.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg sm:leading-8">
                A hands-on program in Python for AI/ML and C++ for embedded
                systems, for students who would rather ship a project than sit
                through another slideshow. PictoBlox gives first-timers a way in.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/academy/signup"
                  className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-sm transition hover:bg-amber-300 ${focusRing}`}
                >
                  Apply to Academy
                </Link>
                <Link
                  to="/academy/login"
                  className={`inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 ${focusRing}`}
                >
                  Student sign in
                </Link>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
                New here? Apply to create your student account. Already enrolled?
                Sign in to continue.
              </p>
            </div>

            <div className="grid gap-3">
              {tracks.map(({ name, detail, label, icon: Icon, accent }, index) => (
                <article
                  key={name}
                  className={`rounded-2xl border p-4 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 sm:p-5 ${accent}`}
                >
                  <div className="flex items-start gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/80 dark:bg-slate-950/40">
                      <Icon aria-hidden="true" className="text-xl" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide opacity-75">
                        {label} · 0{index + 1}
                      </p>
                      <h2 className="mt-1 text-base font-extrabold sm:text-lg">
                        {name}
                      </h2>
                      <p className="mt-1 text-sm leading-6 opacity-90">
                        {detail}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="learning-path"
          className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-8 sm:py-20"
        >
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">
              A clear path from curiosity to confidence
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              How the cohort runs
            </h2>
            <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
              Four stages, repeated for every module, so students always know
              what comes next—and why they are learning it.
            </p>
          </div>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {learningSteps.map((step) => (
              <li
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-extrabold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {step.n}
                </span>
                <h3 className="mt-4 text-lg font-extrabold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-8 sm:pb-20">
          <div className="relative isolate overflow-hidden rounded-3xl bg-slate-950 px-5 py-8 text-white sm:px-8 sm:py-10 lg:flex lg:items-center lg:justify-between lg:gap-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -top-20 -z-10 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl"
            />
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">
                Your next project starts here
              </p>
              <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
                Ready to start learning?
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300 sm:text-base">
                Applications for the next cohort are open now. Start your
                application and take the first step toward building something real.
              </p>
            </div>
            <Link
              to="/academy/signup"
              className={`mt-6 inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-amber-300 sm:w-auto lg:mt-0 ${focusRing}`}
            >
              Start your application
            </Link>
          </div>
        </section>
      </main>

      <AcademyFooter isPublic />
    </div>
  );
}
