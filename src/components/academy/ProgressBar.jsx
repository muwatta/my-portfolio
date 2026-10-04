export default function ProgressBar({ value = 0, label = "Progress" }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>{label}</span>
        <span>{safeValue}%</span>
      </div>
      <div
        className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-200 shadow-inner dark:bg-slate-800"
        role="progressbar"
        aria-label={label}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={safeValue}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500 transition-[width] duration-700 motion-reduce:transition-none"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
