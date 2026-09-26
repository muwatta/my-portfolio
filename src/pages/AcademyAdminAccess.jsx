import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import {
  getAcademyAdminAccess,
  setAcademyAdmin,
  setAcademyUserRole,
} from "../lib/academy";
import { friendlyError } from "../lib/utils";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { Skeleton } from "../components/ui/Skeleton";

export default function AcademyAdminAccess() {
  const [data, setData] = useState({ profiles: [], admins: [] });
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async (background = false) => {
    const result = await getAcademyAdminAccess();
    if (background && result.error) return;
    setData(result.data ?? { profiles: [], admins: [] });
    setState(result.error ? "error" : "ready");
  }, []);

  useAutoRefresh(load);

  async function changeAdmin(userId, enabled) {
    const { error } = await setAcademyAdmin(userId, enabled);
    setMessage(
      friendlyError(
        error,
        enabled ? "Administrator appointed." : "Administrator access removed.",
      ),
    );
    if (!error) await load();
  }

  async function changeRole(userId, role) {
    const { error } = await setAcademyUserRole(userId, role);
    setMessage(friendlyError(error, "Role updated."));
    if (!error) await load();
  }

  const adminIds = new Set(data.admins.map((admin) => admin.user_id));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Primary administrator
        </p>
        <h1 className="mt-2 text-3xl font-bold">Access and roles</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Appoint trusted administrators and set teaching roles. Current-course
          assignment remains a staff-only action.
        </p>
      </header>
      {message && (
        <p
          role="status"
          className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-900"
        >
          {message}
        </p>
      )}
      {state === "loading" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
          aria-hidden="true"
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <Skeleton className="h-10 w-10 shrink-0" rounded="rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-1/3" rounded="rounded-full" />
                <Skeleton className="h-3 w-1/4" rounded="rounded-full" />
              </div>
              <Skeleton className="h-8 w-24 shrink-0" />
            </div>
          ))}
        </motion.div>
      )}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          Access records could not be loaded.
        </p>
      )}
      {state === "ready" && (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Academy role</th>
                <th className="px-5 py-4">Administrator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.profiles.map((profile) => (
                <tr key={profile.id}>
                  <td className="px-5 py-4 font-semibold">
                    {profile.display_name || "Unnamed user"}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      className="field"
                      value={profile.role}
                      onChange={(event) =>
                        changeRole(profile.id, event.target.value)
                      }
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={adminIds.has(profile.id)}
                        onChange={(event) =>
                          changeAdmin(profile.id, event.target.checked)
                        }
                      />
                      <span>
                        {adminIds.has(profile.id)
                          ? "Admin"
                          : "Student or teacher"}
                      </span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
