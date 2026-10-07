const VARIANTS = {
  python: {
    border: "border-violet-300 dark:border-violet-900",
    header: "bg-violet-950",
    accent: "bg-violet-400",
    label: "Python lab",
  },
  cpp: {
    border: "border-cyan-300 dark:border-cyan-900",
    header: "bg-slate-950",
    accent: "bg-cyan-400",
    label: "C++ lab",
  },
  shell: {
    border: "border-emerald-300 dark:border-emerald-900",
    header: "bg-emerald-950",
    accent: "bg-emerald-400",
    label: "Command lab",
  },
};

export default function TerminalFrame({
  variant = "python",
  title,
  meta,
  children,
}) {
  const style = VARIANTS[variant] ?? VARIANTS.python;

  return (
    <section
      aria-label={title}
      className={`overflow-hidden rounded-2xl border bg-slate-950 text-slate-100 shadow-xl shadow-slate-950/10 ${style.border}`}
    >
      <header
        className={`flex min-h-14 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 ${style.header}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300/90" />
            <span className={`h-2.5 w-2.5 rounded-full ${style.accent}`} />
          </span>
          <span className="truncate text-sm font-semibold text-white">{title}</span>
        </div>
        <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-300">
          {meta || style.label}
        </span>
      </header>
      {children}
    </section>
  );
}
