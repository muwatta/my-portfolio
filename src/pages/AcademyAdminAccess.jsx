import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import {
  getAcademyAdminAccess,
  setAcademyGrader,
  setAcademySchoolAdmin,
  setAcademyUserRole,
} from "../lib/academy";
import { friendlyError } from "../lib/utils";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { Skeleton } from "../components/ui/Skeleton";

export default function AcademyAdminAccess({ settingsPage = false }) {
  const { user, isAdmin } = useAcademyAuth();
  const [data, setData] = useState({
    profiles: [],
    graders: [],
    schoolAdmins: [],
    schools: [],
  });
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async (background = false) => {
    const result = await getAcademyAdminAccess();
    if (background && result.error) return;
    setData(
      result.data ?? {
        profiles: [],
        graders: [],
        schoolAdmins: [],
        schools: [],
      },
    );
    setState(result.error ? "error" : "ready");
  }, []);

  // Poll while visible; returning from a brief app switch should not reload it.
  useAutoRefresh(load, { interval: 120000 });

  async function changeSchoolAdmin(userId, schoolId) {
    const { error } = await setAcademySchoolAdmin(userId, schoolId);
    setMessage(
      friendlyError(error, schoolId ? "School administrator assigned." : "School administrator access removed."),
    );
    if (!error) await load();
  }

  async function changeGrader(userId, enabled) {
    const { error } = await setAcademyGrader(userId, enabled);
    setMessage(friendlyError(error, enabled ? "Grader appointed." : "Grader access removed."));
    if (!error) await load();
  }

  async function changeRole(userId, role) {
    const { error } = await setAcademyUserRole(userId, role);
    setMessage(friendlyError(error, "Role updated."));
    if (!error) await load();
  }

  const graderIds = new Set(data.graders.map((grader) => grader.user_id));
  const schoolByAdmin = new Map(
    data.schoolAdmins.map((admin) => [admin.user_id, admin.school_id]),
  );

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          {settingsPage ? "Superadmin settings" : "Administrator controls"}
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          {settingsPage ? "Academy settings" : "Access and roles"}
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Manage Academy roles, grading privileges, and school-scoped access.
          School viewers see and support students at one assigned school;
          grading editors can review and publish submissions across schools.
          Only you can change these permissions or access the all-school dashboard.
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
        <>
        <div className="space-y-3 md:hidden">
          {data.profiles.map((profile) => {
            const isPrimaryAdmin = isAdmin && profile.id === user?.id;
            const name =
              profile.display_name ||
              (isPrimaryAdmin ? "Abdullahi Musliudeen" : "Unnamed user");
            return (
              <article
                key={profile.id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="break-words font-semibold">{name}</h2>
                  {isPrimaryAdmin && (
                    <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-900 dark:bg-cyan-900/60 dark:text-cyan-100">
                      Superadmin
                    </span>
                  )}
                </div>
                <label className="label mt-4 block">
                  Academy role
                  <select
                    className="field mt-1"
                    value={profile.role}
                    disabled={isPrimaryAdmin}
                    onChange={(event) =>
                      changeRole(profile.id, event.target.value)
                    }
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                  </select>
                </label>
                <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
                  <input
                    className="h-5 w-5 shrink-0"
                    type="checkbox"
                    checked={isPrimaryAdmin || graderIds.has(profile.id)}
                    disabled={isPrimaryAdmin}
                    aria-label={`Appoint ${name} as a grading editor`}
                    onChange={(event) =>
                      changeGrader(profile.id, event.target.checked)
                    }
                  />
                  <span>
                    {isPrimaryAdmin
                      ? "Superadmin can grade"
                      : graderIds.has(profile.id)
                        ? "Appointed grading editor"
                        : "Appoint as grading editor"}
                  </span>
                </label>
                <label className="label mt-4 block">
                  School viewer access
                  <select
                    className="field mt-1"
                    value={schoolByAdmin.get(profile.id) || ""}
                    aria-label={`School viewer access for ${name}`}
                    disabled={isPrimaryAdmin}
                    onChange={(event) =>
                      changeSchoolAdmin(profile.id, event.target.value)
                    }
                  >
                    <option value="">
                      {isPrimaryAdmin
                        ? "Primary superadmin"
                        : "No school viewer access"}
                    </option>
                    {data.schools.map((school) => (
                      <option
                        key={school.id}
                        value={school.id}
                        disabled={!school.is_active}
                      >
                        {school.name} · {school.city}, {school.state}
                        {!school.is_active ? " (inactive)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </article>
            );
          })}
          {!data.profiles.length && (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
              No Academy accounts to manage.
            </p>
          )}
        </div>
        <div className="hidden overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Academy role</th>
                <th className="px-5 py-4">Grading editor</th>
                <th className="px-5 py-4">School viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.profiles.map((profile) => {
                const isPrimaryAdmin = isAdmin && profile.id === user?.id;
                return (
                  <tr key={profile.id}>
                    <td className="px-5 py-4 font-semibold">
                      {profile.display_name ||
                        (isPrimaryAdmin
                          ? "Abdullahi Musliudeen"
                          : "Unnamed user")}
                    </td>
                    <td className="px-5 py-4">
                      <select
                        className="field"
                        value={profile.role}
                        disabled={isPrimaryAdmin}
                        onChange={(event) =>
                          changeRole(profile.id, event.target.value)
                        }
                      >
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                      </select>
                      {isPrimaryAdmin && (
                        <span className="ml-2 text-xs text-slate-500">
                          Superadmin
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={isPrimaryAdmin || graderIds.has(profile.id)}
                        disabled={isPrimaryAdmin}
                        aria-label={`Appoint ${profile.display_name || (isPrimaryAdmin ? "the superadmin" : "this user")} as a grading editor`}
                        onChange={(event) => changeGrader(profile.id, event.target.checked)}
                      />
                      <span className="ml-2">
                        {isPrimaryAdmin
                          ? "Superadmin"
                          : graderIds.has(profile.id)
                            ? "Appointed grader"
                            : "Appoint grading editor"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <select
                        className="field min-w-48"
                        value={schoolByAdmin.get(profile.id) || ""}
                        aria-label={`School viewer access for ${profile.display_name || (isPrimaryAdmin ? "the superadmin" : "this user")}`}
                        disabled={isPrimaryAdmin}
                        onChange={(event) =>
                          changeSchoolAdmin(profile.id, event.target.value)
                        }
                      >
                        <option value="">
                          {isPrimaryAdmin
                            ? "Primary superadmin"
                            : "No school viewer access"}
                        </option>
                        {data.schools.map((school) => (
                          <option
                            key={school.id}
                            value={school.id}
                            disabled={!school.is_active}
                          >
                            {school.name} · {school.city}, {school.state}
                            {!school.is_active ? " (inactive)" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
