import { Link, useLocation } from "react-router-dom";

export default function AcademyPlaceholder() {
  const { pathname } = useLocation();
  const label =
    pathname.split("/").filter(Boolean).pop()?.replaceAll("-", " ") ||
    "Academy";

  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 dark:border-slate-700 dark:bg-slate-900 sm:p-12">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
        Academy workspace
      </p>
      <h1 className="mt-3 text-3xl font-bold capitalize">{label}</h1>
      <p className="mt-3 max-w-xl text-slate-600 dark:text-slate-300">
        This workspace is ready for Academy activities and course records.
      </p>
      <Link
        className="button-primary mt-6 inline-flex items-center"
        to="/academy/dashboard"
      >
        Back to dashboard
      </Link>
    </section>
  );
}
