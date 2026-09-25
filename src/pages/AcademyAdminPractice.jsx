import { useEffect, useState } from "react";
import { getAcademyAdminPractice, saveAcademyExercise } from "../lib/academy";
import { friendlyError } from "../lib/utils";

const emptyExercise = {
  id: "",
  lesson_id: "",
  title: "",
  instructions: "",
  starter_code: "",
  difficulty: "beginner",
  expected_concepts: "",
  hints: "",
  explanation: "",
  tests: "[]",
  solution_code: "",
};

export default function AcademyAdminPractice() {
  const [data, setData] = useState({ lessons: [], exercises: [] });
  const [form, setForm] = useState(emptyExercise);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");

  async function load() {
    const result = await getAcademyAdminPractice();
    setData(result.data ?? { lessons: [], exercises: [] });
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
    const { error } = await saveAcademyExercise(form);
    if (error) {
      setMessage(friendlyError(error, "Exercise could not be saved."));
      return;
    }
    setMessage("Exercise saved.");
    setForm(emptyExercise);
    await load();
  }

  function editExercise(exercise) {
    setForm({
      id: exercise.id,
      lesson_id: exercise.lesson_id,
      title: exercise.title,
      instructions: exercise.instructions,
      starter_code: exercise.starter_code ?? "",
      difficulty: exercise.difficulty,
      expected_concepts: Array.isArray(exercise.expected_concepts)
        ? exercise.expected_concepts.join("\n")
        : exercise.expected_concepts ?? "",
      hints: Array.isArray(exercise.hints)
        ? exercise.hints.join("\n")
        : exercise.hints ?? "",
      explanation: exercise.explanation ?? "",
      tests: JSON.stringify(exercise.tests ?? []),
      solution_code: exercise.solution_code ?? "",
      published: exercise.published,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function togglePublish(exercise) {
    setMessage("");
    const { error } = await saveAcademyExercise({
      ...exercise,
      published: !exercise.published,
    });
    if (error)
      setMessage(
        friendlyError(error, "Publish state could not be changed."),
      );
    else {
      setMessage(`Exercise ${exercise.published ? "unpublished" : "published"}.`);
      await load();
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Academy administration
        </p>
        <h1 className="mt-2 text-3xl font-bold">Practice</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Manage coding exercises for lessons and keep the practice library ready
          for student work.
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
          Practice data could not be loaded. Confirm the Academy migrations are
          applied.
        </p>
      )}
      <form
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        onSubmit={submit}
      >
        <h2 className="text-xl font-bold">
          {form.id ? "Edit exercise" : "Create exercise"}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="label">
            Lesson
            <select
              className="field"
              name="lesson_id"
              value={form.lesson_id}
              onChange={updateField}
              required
            >
              <option value="">Select lesson</option>
              {data.lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Difficulty
            <select
              className="field"
              name="difficulty"
              value={form.difficulty}
              onChange={updateField}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="label md:col-span-2">
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
          Instructions
          <textarea
            className="field min-h-24"
            name="instructions"
            value={form.instructions}
            onChange={updateField}
            required
          />
        </label>
        <label className="label">
          Starter code
          <textarea
            className="field min-h-28 font-mono text-sm"
            name="starter_code"
            value={form.starter_code}
            onChange={updateField}
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="label">
            Expected concepts
            <input
              className="field"
              name="expected_concepts"
              value={form.expected_concepts}
              onChange={updateField}
              placeholder="arrays, loops"
            />
          </label>
          <label className="label">
            Hints
            <input
              className="field"
              name="hints"
              value={form.hints}
              onChange={updateField}
              placeholder="Hint 1, Hint 2"
            />
          </label>
        </div>
        <label className="label">
          Explanation
          <textarea
            className="field min-h-20"
            name="explanation"
            value={form.explanation}
            onChange={updateField}
          />
        </label>
        <label className="label">
          Test payload (JSON array)
          <textarea
            className="field min-h-20 font-mono text-sm"
            name="tests"
            value={form.tests}
            onChange={updateField}
          />
        </label>
        <label className="label">
          Solution code
          <textarea
            className="field min-h-28 font-mono text-sm"
            name="solution_code"
            value={form.solution_code}
            onChange={updateField}
          />
        </label>
        <div className="flex w-fit items-center gap-3">
          <button className="button-primary" type="submit">
            Save exercise
          </button>
          {form.id && (
            <button
              className="button-secondary"
              type="button"
              onClick={() => setForm(emptyExercise)}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Existing exercises</h2>
        {state === "ready" && data.exercises.length === 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No practice exercises have been created yet.
          </p>
        )}
        {data.exercises.map((exercise) => (
          <div
            key={exercise.id}
            className="flex flex-wrap items-center justify-between gap-4 border-l-4 border-cyan-400 bg-white p-5 shadow-sm dark:bg-slate-900"
          >
            <div>
              <p className="font-bold">{exercise.title}</p>
              <p className="text-sm text-slate-500">
                {exercise.academy_lessons?.title || "Unassigned lesson"} · {exercise.difficulty}
              </p>
            </div>
            <span className="text-sm font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
              {exercise.difficulty}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`text-sm font-semibold ${
                  exercise.published
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {exercise.published ? "published" : "draft"}
              </span>
              <button
                className="button-ghost text-xs"
                type="button"
                onClick={() => editExercise(exercise)}
              >
                Edit
              </button>
              <button
                className="button-ghost text-xs"
                type="button"
                onClick={() => togglePublish(exercise)}
              >
                {exercise.published ? "Unpublish" : "Publish"}
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
