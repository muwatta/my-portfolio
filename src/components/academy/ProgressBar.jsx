export default function ProgressBar({ value = 0, label = "Progress" }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>{label}</span>
        <span>{safeValue}%</span>
      </div>
      <div
        className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        role="progressbar"
        aria-label={label}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={safeValue}
      >
        <div
          className="h-full rounded-full bg-blue-600 transition-[width]"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
