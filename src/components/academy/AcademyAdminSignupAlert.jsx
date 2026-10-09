import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";
import { supabase } from "../../lib/supabase";

export default function AcademyAdminSignupAlert() {
  const { user } = useAcademyAuth();
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (!supabase || !user?.id) return undefined;

    const channel = supabase
      .channel(`academy-admin-signups:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "academy_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        ({ new: row }) => {
          if (row?.type === "registration") setNotification(row);
        },
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(
            "Live signup notifications could not be connected.",
            error ?? new Error(status),
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  if (!notification) return null;

  return (
    <aside
      role="status"
      className="fixed right-4 top-20 z-50 w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-cyan-300 bg-white p-4 shadow-xl dark:border-cyan-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold">{notification.title}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {notification.message}
          </p>
          <Link
            to="/academy/admin/registrations"
            className="mt-3 inline-flex min-h-10 items-center font-semibold text-cyan-700 underline underline-offset-2 dark:text-cyan-300"
          >
            Review registrations
          </Link>
        </div>
        <button
          type="button"
          className="button-secondary min-h-10 shrink-0 px-3"
          onClick={() => setNotification(null)}
          aria-label="Dismiss signup notification"
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
}
