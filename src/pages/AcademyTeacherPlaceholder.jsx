export default function AcademyTeacherPlaceholder() {
  return (
    <section className="space-y-6">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
        Teacher workspace
      </p>
      <h1 className="mt-3 text-3xl font-bold">Teaching workspace</h1>
      <p className="mt-3 max-w-xl text-slate-600 dark:text-slate-300">
        Use the live tools below to manage the learning experience. Courses,
        lessons, student levels, and analytics are available now.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Classes", "Review cohorts and upcoming classroom work."],
          ["Assignments", "Plan work and monitor the student workflow."],
          ["Submissions", "Review submitted work and follow up with learners."],
        ].map(([title, description]) => (
          <div
            key={title}
            className="border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="font-bold">{title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {description}
            </p>
            <span className="mt-4 inline-flex text-xs font-semibold uppercase tracking-wide text-cyan-600">
              Workspace ready
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
