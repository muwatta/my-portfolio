import { useEffect, useState } from "react";
import { getAcademyAdminProjects, saveAcademyProject } from "../lib/academy";

const emptyProject = {
  id: "",
  course_id: "",
  title: "",
  description: "",
};

export default function AcademyAdminProjects() {
  const [data, setData] = useState({ courses: [], projects: [] });
  const [form, setForm] = useState(emptyProject);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");

  async function load() {
    const result = await getAcademyAdminProjects();
    setData(result.data ?? { courses: [], projects: [] });
    setState(result.error ? "error" : "ready");
  }

  useEffect(() => {
    load();
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

async function submit(event) {
    event.preventDefault();
    setMessage("");
    const { error } = await saveAcademyProject(form);
    if (error) {
      setMessage(error.message || "Project could not be saved.");
      return;
    }
    setMessage("Project saved.");
    setForm(emptyProject);
    await load();
  }

  function editProject(project) {
    setForm({
      id: project.id,
      course_id: project.course_id,
      title: project.title,
      description: project.description,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Academy administration
        </p>
        <h1 className="mt-2 text-3xl font-bold">Projects</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Build course-linked project milestones for learners to complete as they
          progress.
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
      {state === "error" && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          Project data could not be loaded. Confirm the Academy migrations are
          applied.
        </p>
      )}
      <form
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        onSubmit={submit}
      >
        <h2 className="text-xl font-bold">
          {form.id ? "Edit project" : "Create project"}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="label">
            Course
            <select
              className="field"
              name="course_id"
              value={form.course_id}
              onChange={updateField}
              required
            >
              <option value="">Select course</option>
              {data.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Title
            <input
              className="field"
              name="title"
              value={form.title}
              onChange={updateField}
              required
            />
          </label>
        </div>
        <label className="label">
          Description
          <textarea
            className="field min-h-28"
            name="description"
            value={form.description}
            onChange={updateField}
            required
          />
        </label>
<div className="flex w-fit items-center gap-3">
          <button className="button-primary" type="submit">
            Save project
          </button>
          {form.id && (
            <button
              className="button-secondary"
              type="button"
              onClick={() => setForm(emptyProject)}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Existing projects</h2>
        {state === "ready" && data.projects.length === 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No projects have been created yet.
          </p>
        )}
        {data.projects.map((project) => (
          <div
            key={project.id}
            className="flex flex-wrap items-center justify-between gap-4 border-l-4 border-cyan-400 bg-white p-5 shadow-sm dark:bg-slate-900"
          >
            <div>
              <p className="font-bold">{project.title}</p>
              <p className="text-sm text-slate-500">
                {project.academy_courses?.title || "Unassigned course"}
              </p>
            </div>
<div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {new Date(project.created_at).toLocaleDateString()}
            </span>
            <button
              className="button-ghost text-xs"
              type="button"
              onClick={() => editProject(project)}
            >
              Edit
            </button>
          </div>
          </div>
        ))}
      </section>
    </div>
  );
}
