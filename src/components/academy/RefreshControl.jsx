import { useEffect, useState } from "react";

function relativeTime(then) {
  if (!then) return "not loaded yet";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

// Auto refresh should never yank the page out from under someone mid sentence.
// This is the deliberate alternative: say how old the data is, and let the
// reader decide when to pull fresh.
export default function RefreshControl({ onRefresh, busy, updatedAt }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Updated {relativeTime(updatedAt)}
      </p>
      <button
        type="button"
        className="button-secondary"
        onClick={onRefresh}
        disabled={busy}
        aria-label="Refresh now"
      >
        {busy ? "Refreshing" : "Refresh"}
      </button>
    </div>
  );
}
