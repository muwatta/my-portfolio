import { FiAlertCircle, FiRefreshCw } from "react-icons/fi";

export default function AdminLoadError({
  title,
  message,
  onRetry,
  retrying = false,
}) {
  return (
    <section
      className="flex flex-col gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:border-rose-900/70 dark:bg-rose-950/30"
      role="alert"
    >
      <div className="flex min-w-0 items-start gap-3">
        <FiAlertCircle
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300"
        />
        <div className="min-w-0">
          <h2 className="font-bold text-rose-950 dark:text-rose-100">{title}</h2>
          <p className="mt-1 text-sm text-rose-900 dark:text-rose-200">
            {message}
          </p>
          <p className="mt-1 text-xs text-rose-800/90 dark:text-rose-300">
            Your existing records are unchanged. Try again; if the problem
            continues, contact your Academy administrator.
          </p>
        </div>
      </div>
      <button
        className="button-secondary inline-flex shrink-0 items-center justify-center gap-2 self-start sm:self-center"
        type="button"
        onClick={onRetry}
        disabled={retrying}
      >
        <FiRefreshCw
          aria-hidden="true"
          className={retrying ? "h-4 w-4 animate-spin" : "h-4 w-4"}
        />
        {retrying ? "Retrying..." : "Try again"}
      </button>
    </section>
  );
}
