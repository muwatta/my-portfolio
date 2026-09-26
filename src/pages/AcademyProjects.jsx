import { useEffect, useState } from "react";
import {
  getAcademyProjects,
  markProjectMilestoneComplete,
} from "../lib/academy";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { friendlyError } from "../lib/utils";
import { fetchWithOfflineFallback } from "../lib/academyOffline";
import { OFFLINE_STORES } from "../lib/offlineStore";
import { enqueueAcademyOperation } from "../lib/academySync";

const NOTICE_STYLES = {
  success:
    "border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100",
  info: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
  error:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
};

export default function AcademyProjects() {
  const { user } = useAcademyAuth();
  const [projects, setProjects] = useState([]);
  const [state, setState] = useState("loading");
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchWithOfflineFallback({
      userId: user.id,
      store: OFFLINE_STORES.progress,
      fetcher: () => getAcademyProjects(user.id),
    }).then((result) => {
      if (!mounted) return;
      setOffline(Boolean(result.offline));
      setProjects(result.data ?? []);
      setState(
        result.error ? "error" : result.configured ? "ready" : "unconfigured",
      );
    });
    return () => {
      mounted = false;
    };
  }, [user.id]);

  async function complete(milestoneId) {
    setNotice("");
    if (!navigator.onLine) {
      await enqueueAcademyOperation(user.id, {
        type: "project_milestone_complete",
        payload: { milestoneId, studentId: user.id },
      });
      setProjects((current) =>
        current.map((project) => ({
          ...project,
          academy_project_milestones: project.academy_project_milestones.map(
            (milestone) =>
              milestone.id === milestoneId
                ? {
                    ...milestone,
                    progress: { completed_at: new Date().toISOString() },
                  }
                : milestone,
          ),
        })),
      );
      setNoticeType("info");
      setNotice("Milestone saved on this device and waiting to sync.");
      return;
    }
    const { error } = await markProjectMilestoneComplete(milestoneId, user.id);
    if (error) {
      setNoticeType("error");
      setNotice(friendlyError(error, "Milestone could not be updated."));
    } else {
      setNoticeType("success");
      setNotice("Milestone completed.");
      const result = await getAcademyProjects(user.id);
      setProjects(result.data ?? []);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Turn lessons into finished work through a clear milestone roadmap.
        </p>
      </header>

      {offline && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Offline project mode. Milestone changes will sync when you reconnect.
        </p>
      )}

      {notice && (
        <p
          role={noticeType === "error" ? "alert" : "status"}
          className={`rounded-lg border p-3 text-sm ${NOTICE_STYLES[noticeType]}`}
        >
          {notice}
        </p>
      )}

      {state === "loading" && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Loading projects...
        </p>
      )}
      {state === "unconfigured" && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Connect Supabase to load projects.
        </p>
      )}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
        >
          Projects could not be loaded.
        </p>
      )}
      {state === "ready" && projects.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          No projects have been published yet.
        </p>
      )}

      {projects.map((project) => (
        <article
          key={project.id}
          className="rounded-2xl border border-slate-200 border-l-4 border-l-teal-400 bg-white p-6 shadow-sm dark:border-slate-800 dark:border-l-teal-500 dark:bg-slate-900"
        >
          <h2 className="text-xl font-bold">{project.title}</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {project.description}
          </p>
          <ol className="mt-6 space-y-3">
            {project.academy_project_milestones.map((milestone) => (
              <li
                key={milestone.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <span>
                  <span className="mr-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                    {milestone.milestone_number}
                  </span>
                  {milestone.title}
                </span>
                {milestone.progress?.completed_at ? (
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    Completed
                  </span>
                ) : (
                  <button
                    className="button-secondary px-3 py-1.5 text-sm"
                    type="button"
                    onClick={() => complete(milestone.id)}
                  >
                    Complete
                  </button>
                )}
              </li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  );
}
