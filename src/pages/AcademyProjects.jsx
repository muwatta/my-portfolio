import { useEffect, useState } from "react";
import {
  getAcademyProjects,
  markProjectMilestoneComplete,
} from "../lib/academy";
import { useAcademyAuth } from "../hooks/useAcademyAuth";

export default function AcademyProjects() {
  const { user } = useAcademyAuth();
  const [projects, setProjects] = useState([]);
  const [state, setState] = useState("loading");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let mounted = true;
    getAcademyProjects(user.id).then((result) => {
      if (!mounted) return;
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
    const { error } = await markProjectMilestoneComplete(milestoneId, user.id);
    if (error) setNotice(error.message || "Milestone could not be updated.");
    else {
      setNotice("Milestone completed.");
      const result = await getAcademyProjects(user.id);
      setProjects(result.data ?? []);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Applied learning
        </p>
        <h1 className="mt-2 text-3xl font-bold">Projects</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Turn lessons into finished work through a clear milestone roadmap.
        </p>
      </header>
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100"
        >
          {notice}
        </p>
      )}
      {state === "loading" && (
        <p className="text-sm text-slate-500">Loading projects...</p>
      )}
      {state === "unconfigured" && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Connect Supabase to load projects.
        </p>
      )}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
        >
          Projects could not be loaded.
        </p>
      )}
      {state === "ready" && projects.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-sm dark:border-slate-700">
          No projects have been published yet.
        </p>
      )}
      {projects.map((project) => (
        <article
          key={project.id}
          className="border-l-4 border-cyan-400 bg-white p-6 shadow-sm dark:bg-slate-900"
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
                  <span className="mr-2 text-xs font-bold text-slate-500">
                    {milestone.milestone_number}
                  </span>
                  {milestone.title}
                </span>
                {milestone.progress?.completed_at ? (
                  <span className="text-sm font-semibold text-emerald-600">
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
