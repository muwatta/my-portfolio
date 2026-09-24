import { useEffect, useState } from "react";
import {
  getAcademyNotifications,
  markAcademyNotificationRead,
} from "../lib/academy";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { fetchWithOfflineFallback } from "../lib/academyOffline";
import { OFFLINE_STORES } from "../lib/offlineStore";
import { enqueueAcademyOperation } from "../lib/academySync";

export default function AcademyNotifications() {
  const { user } = useAcademyAuth();
  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading");
  const [offline, setOffline] = useState(false);
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
    if (!navigator.onLine) {
      await enqueueAcademyOperation(user.id, {
        type: "notification_read",
        payload: { notificationId: id, studentId: user.id },
      });
    } else {
      const { error } = await markAcademyNotificationRead(id, user.id);
      if (error) return;
    }
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, read_at: new Date().toISOString() } : item,
      ),
    );
  }
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Academy updates
        </p>
        <h1 className="mt-2 text-3xl font-bold">Notifications</h1>
      </header>
      {offline && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Offline mode. Read markers are saved locally and will sync when you reconnect.
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
            className={`border-l-4 p-5 ${item.read_at ? "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900" : "border-cyan-400 bg-cyan-50 dark:bg-cyan-950/30"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold">{item.title}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {item.body}
                </p>
              </div>
              {!item.read_at && (
                <button
                  className="button-secondary px-3 py-1.5 text-sm"
                  type="button"
                  onClick={() => read(item.id)}
                >
                  Mark read
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
