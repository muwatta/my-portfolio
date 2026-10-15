import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getAcademyNotifications,
  markAcademyNotificationRead,
} from "../lib/academy";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { fetchWithOfflineFallback } from "../lib/academyOffline";
import { OFFLINE_STORES } from "../lib/offlineStore";
import { enqueueAcademyOperation } from "../lib/academySync";
import { friendlyError } from "../lib/utils";

export default function AcademyNotifications() {
  const { user } = useAcademyAuth();
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading");
  const [offline, setOffline] = useState(false);
  const [readError, setReadError] = useState("");
  const [readingId, setReadingId] = useState(null);
  const unreadCount = items.filter((item) => !item.read_at).length;
  useEffect(() => {
    fetchWithOfflineFallback({
      userId: user.id,
      store: OFFLINE_STORES.notifications,
      fetcher: () => getAcademyNotifications(user.id),
    }).then(({ data, error, configured, offline: isOffline }) => {
      setOffline(Boolean(isOffline));
      setItems(data ?? []);
      setState(error ? "error" : configured ? "ready" : "unconfigured");
    });
  }, [user.id]);
  async function read(id) {
    setReadError("");
    setReadingId(id);
    try {
      if (!navigator.onLine) {
        await enqueueAcademyOperation(user.id, {
          type: "notification_read",
          payload: { notificationId: id, studentId: user.id },
        });
      } else {
        const { error } = await markAcademyNotificationRead(id, user.id);
        if (error) {
          setReadError(
            friendlyError(error, "This notification could not be marked as read."),
          );
          return;
        }
      }
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, read_at: new Date().toISOString() }
            : item,
        ),
      );
    } catch (error) {
      setReadError(
        friendlyError(error, "This notification could not be marked as read."),
      );
    } finally {
      setReadingId(null);
    }
  }
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Superadmin workspace
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {unreadCount
                ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`
                : "You are up to date."}
            </p>
          </div>
          {items.length > 0 && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {items.length} recent
            </span>
          )}
        </div>
      </header>
      {offline && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Offline mode. Read markers are saved locally and will sync when you reconnect.
        </p>
      )}
      {readError && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          {readError}
        </p>
      )}
      {state === "loading" && <p>Loading notifications...</p>}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          Notifications could not be loaded.
        </p>
      )}
      {state === "ready" && items.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-sm dark:border-slate-700">
          You are all caught up.
        </p>
      )}
      <div className="space-y-3">
        {items.map((item) => (
          <article
            key={item.id}
            className={`rounded-xl border border-slate-200 border-l-4 p-4 shadow-sm dark:border-slate-800 sm:p-5 ${item.read_at ? "border-l-slate-300 bg-white dark:border-l-slate-700 dark:bg-slate-900" : "border-l-cyan-500 bg-cyan-50 dark:border-l-cyan-400 dark:bg-cyan-950/30"}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words font-bold">{item.title}</h2>
                  {!item.read_at && (
                    <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-900 dark:bg-cyan-900/60 dark:text-cyan-100">
                      New
                    </span>
                  )}
                </div>
                <p className="mt-2 break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {item.message}
                </p>
                {item.created_at && (
                  <time
                    className="mt-2 block text-xs text-slate-500 dark:text-slate-400"
                    dateTime={item.created_at}
                  >
                    {new Date(item.created_at).toLocaleString()}
                  </time>
                )}
                {item.type === "registration" && (
                  <Link
                    to="/academy/admin/registrations"
                    className="mt-3 inline-flex min-h-11 items-center font-semibold text-cyan-700 underline underline-offset-2 dark:text-cyan-300"
                  >
                    Review registrations
                  </Link>
                )}
              </div>
              {!item.read_at && (
                <button
                  className="button-secondary min-h-11 w-full px-3 text-sm sm:w-auto"
                  type="button"
                  disabled={readingId === item.id}
                  onClick={() => read(item.id)}
                >
                  {readingId === item.id ? "Saving..." : "Mark read"}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
