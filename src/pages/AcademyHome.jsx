import { Link } from "react-router-dom";

export default function AcademyHome() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 px-4 py-12 text-white">
      <section className="w-full max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Muwatta Academy
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-bold tracking-tight sm:text-6xl">
          Learn Python by building toward AI.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
          A focused learning space for secondary-school students: short lessons,
          practical code, useful feedback, and a clear path through 11 weeks.
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
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-700 px-5 py-2 text-sm font-semibold text-white hover:border-slate-500"
          >
            Back to portfolio
          </Link>
        </div>
      </section>
    </div>
  );
}
