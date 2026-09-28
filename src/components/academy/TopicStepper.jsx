const STEPS = [
  { id: "learn", label: "Learn" },
  { id: "practice", label: "Practice" },
  { id: "task", label: "Task" },
];

// Learn, then Practice, then Task. A step the topic has no content for is left
// out rather than shown as an empty dead end, so a lesson with no practice reads
// as two steps instead of three with a hole in the middle.
export default function TopicStepper({
  current,
  learnDone = false,
  practiceCount = 0,
  taskCount = 0,
  practiceDone = false,
  taskDone = false,
  onJump,
}) {
  const steps = STEPS.filter((step) => {
    if (step.id === "practice") return practiceCount > 0;
    if (step.id === "task") return taskCount > 0;
    return true;
  }).map((step) => ({
    ...step,
    done:
      step.id === "learn"
        ? learnDone
        : step.id === "practice"
          ? practiceDone
          : taskDone,
  }));

  return (
    <nav aria-label="Topic steps">
      <ol className="flex items-stretch gap-1">
        {steps.map((step, index) => {
          const isCurrent = step.id === current;
          return (
            <li key={step.id} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onJump?.(step.id)}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex min-h-11 w-full min-w-0 flex-col justify-center rounded-lg border px-2 py-1.5 text-left transition-colors ${
                  isCurrent
                    ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/40"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                }`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                  Step {index + 1} of {steps.length}
                </span>
                <span className="flex w-full items-center justify-between gap-1 text-sm font-semibold">
                  <span className="truncate">{step.label}</span>
                  {step.done ? (
                    <span
                      aria-label="done"
                      className="text-emerald-600 dark:text-emerald-400"
                    >
                      ✓
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
