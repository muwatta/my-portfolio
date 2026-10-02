import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAcademyNotifications } from "../../lib/academy";

const NOTICE_TYPE = "password_policy_update";
const DISMISS_KEY = "academy:password-notice-dismissed";

// Advisory only. The server enforces the rule when a password is next set, so
// there is nothing here that can lock a student out, and dismissing it only hides
// the banner -- the notification itself stays in the notifications list.
export default function PasswordPolicyNotice({ userId }) {
  const [pending, setPending] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(DISMISS_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!userId || dismissed) return;
    let cancelled = false;
    getAcademyNotifications(userId)
      .then((items) => {
        if (cancelled) return;
        const match = (items ?? []).find((item) => item.type === NOTICE_TYPE);
        setPending(Boolean(match));
      })
      .catch(() => {
        // A failed lookup just means no banner. Never block the dashboard on it.
      });
    return () => {
      cancelled = true;
    };
  }, [userId, dismissed]);

  if (!pending || dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // Storage can be unavailable in private browsing; hiding the banner for
      // this session is still better than leaving it stuck on screen.
    }
    setDismissed(true);
  }

  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/40"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-amber-900 dark:text-amber-100">
            Strengthen your password
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-900/90 dark:text-amber-100/90">
            New Academy passwords now need at least 8 characters mixing uppercase
            and lowercase letters, a number, and a symbol. Changing yours is
            optional and you keep full access either way, but a stronger password
            protects your coursework.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link className="button-primary inline-flex" to="/academy/forgot-password">
              Update my password
            </Link>
            <Link
              className="button-secondary inline-flex"
              to="/academy/notifications"
            >
              See all notifications
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="flex min-h-11 shrink-0 items-center rounded-md px-3 text-xs font-semibold text-amber-800 hover:bg-amber-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-amber-200 dark:hover:bg-amber-900/60"
        >
          Dismiss
          <span className="sr-only"> the password reminder</span>
        </button>
      </div>
    </section>
  );
}