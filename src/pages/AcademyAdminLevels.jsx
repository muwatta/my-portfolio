import { useEffect, useState } from "react";
import { getAcademyAdminLevels, saveAcademyLevel } from "../lib/academy";
import { friendlyError } from "../lib/utils";

const emptyLevel = {
  id: "",
  slug: "",
  name: "",
  description: "",
  sort_order: 0,
  active: true,
};

export default function AcademyAdminLevels() {
  const [levels, setLevels] = useState([]);
  const [form, setForm] = useState(emptyLevel);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");

  async function load() {
    const result = await getAcademyAdminLevels();
    setLevels(result.data ?? []);
    setState(result.error ? "error" : "ready");
  }

  useEffect(() => {
    load();
  }, []);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    const { error } = await saveAcademyLevel(form);
    if (error) {
      setMessage(friendlyError(error, "Level could not be saved."));
      return;
    }
    setMessage("Level saved.");
    setForm(emptyLevel);
    await load();
  }

  function editLevel(level) {
    setForm({
      id: level.id,
      slug: level.slug,
      name: level.name,
      description: level.description,
      sort_order: level.sort_order,
      active: level.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Academy administration
        </p>
        <h1 className="mt-2 text-3xl font-bold">Levels</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Define the learning stages for the academy catalog and keep them in a
          stable order.
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
          Level data could not be loaded. Confirm the Academy migrations are
          applied.
        </p>
      )}
      <form
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        onSubmit={submit}
      >
        <h2 className="text-xl font-bold">
          {form.id ? "Edit level" : "Create level"}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="label">
            Name
            <input
              className="field"
              name="name"
              value={form.name}
              onChange={updateField}
              required
            />
          </label>
          <label className="label">
            Slug
            <input
              className="field"
              name="slug"
              value={form.slug}
              onChange={updateField}
              required
              pattern="[a-z0-9-]+"
            />
          </label>
          <label className="label">
            Sort order
            <input
              className="field"
              name="sort_order"
              type="number"
              min="0"
              value={form.sort_order}
              onChange={updateField}
            />
          </label>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input
              name="active"
              type="checkbox"
              checked={form.active}
              onChange={updateField}
            />
            Active
          </label>
        </div>
        <label className="label">
          Description
          <textarea
            className="field min-h-24"
            name="description"
            value={form.description}
            onChange={updateField}
          />
        </label>
        <div className="flex w-fit items-center gap-3">
          <button className="button-primary" type="submit">
            Save level
          </button>
          {form.id && (
            <button
              className="button-secondary"
              type="button"
              onClick={() => setForm(emptyLevel)}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Existing levels</h2>
        {state === "ready" && levels.length === 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No levels have been created yet.
          </p>
        )}
        {levels.map((level) => (
          <div
            key={level.id}
            className="flex flex-wrap items-center justify-between gap-4 border-l-4 border-cyan-400 bg-white p-5 shadow-sm dark:bg-slate-900"
          >
            <div>
              <p className="font-bold">{level.name}</p>
              <p className="text-sm text-slate-500">
                {level.slug} · Order {level.sort_order}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold">
              {level.active ? "Active" : "Inactive"}
            </span>
            <button
              className="button-ghost text-xs"
              type="button"
              onClick={() => editLevel(level)}
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
