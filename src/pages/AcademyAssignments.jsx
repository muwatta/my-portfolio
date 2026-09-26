import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAcademyAssignments } from "../lib/academy";
import { fetchWithOfflineFallback } from "../lib/academyOffline";
import { OFFLINE_STORES } from "../lib/offlineStore";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import AcademyConnectionState from "../components/academy/AcademyConnectionState";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

export default function AcademyAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [state, setState] = useState("loading");
  const [offline, setOffline] = useState(false);
  const { user } = useAcademyAuth();
  const network = useNetworkStatus();
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    fetchWithOfflineFallback({
      userId: user.id,
      store: OFFLINE_STORES.assignments,
      fetcher: () => getAcademyAssignments(user.id),
    }).then(({ data, error, configured, offline: isOffline }) => {
      setOffline(Boolean(isOffline));
      setAssignments(data ?? []);
      setState(error ? "error" : configured ? "ready" : "unconfigured");
    });
  }, [user?.id, reloadToken]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Your work
        </p>
        <h1 className="mt-2 text-3xl font-bold">Assignments</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Only assignments targeted to you or one of your classes appear here.
        </p>
      </header>
      {offline && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Offline learning mode. Downloaded assignment briefs are available on this device.
        </p>
      )}
      {state === "loading" && (
        <AcademyConnectionState loading title="" description="" showChallenge={false} />
      )}
      {state === "unconfigured" && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Connect Supabase to load assignments.
        </p>
      )}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
        >
          Assignments could not be loaded.
        </p>
      )}
      {state === "ready" && assignments.length === 0 && (
        <AcademyConnectionState
          online={network.online}
          slow={network.slow}
          title={
            network.online
              ? "No assignments yet"
              : "Assignments are not downloaded"
          }
          description={
            network.online
              ? "Nothing is due right now. Your teacher will publish new assignments here."
              : "Reconnect once to download your assignments, then you can keep working offline."
          }
          onRetry={
            network.online
              ? undefined
              : () => setReloadToken((value) => value + 1)
          }
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {assignments.map((assignment) => (
          <Link
            key={assignment.id}
            to={`/academy/assignments/${assignment.id}`}
            className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              {assignment.points} points
            </p>
            <h2 className="mt-2 text-lg font-bold">{assignment.title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {assignment.due_at
                ? `Due ${new Date(assignment.due_at).toLocaleDateString()}`
                : "No due date"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
