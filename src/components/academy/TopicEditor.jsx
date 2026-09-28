import { useState } from "react";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", hint: "Only you can see it." },
  {
    value: "scheduled",
    label: "Scheduled",
    hint: "Appears for students at the release time you pick.",
  },
  { value: "published", label: "Published", hint: "Visible to students now." },
  {
    value: "archived",
    label: "Archived",
    hint: "Kept for records, hidden from students.",
  },
];

const LATE_POLICIES = [
  { value: "accept_penalty", label: "Accept late, with a penalty" },
  { value: "closed", label: "Close after the due date" },
];

export default function TopicEditor({
  topic,
  weeks,
  lessons,
  onChange,
  onSubmit,
  onCancel,
  busy,
  error,
}) {
  const [showAll, setShowAll] = useState(false);
  const set = (field) => (event) =>
    onChange({ ...topic, [field]: event.target.value });

  const hint = STATUS_OPTIONS.find((option) => option.value === topic.status);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(topic);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="label sm:col-span-2">
          Topic title
          <input
            className="field"
            value={topic.title}
            onChange={set("title")}
            required
            maxLength={200}
            placeholder="Loops and iteration"
          />
        </label>

        <label className="label">
          Week
          <select
            className="field"
            value={topic.week_id}
            onChange={set("week_id")}
            required
          >
            <option value="">Choose a week</option>
            {weeks.map((week) => (
              <option key={week.id} value={week.id}>
                {week.week_number}. {week.title}
              </option>
            ))}
          </select>
        </label>

        <label className="label">
          Position in week
          <input
            className="field"
            type="number"
            min={0}
            value={topic.lesson_number}
            onChange={set("lesson_number")}
          />
        </label>
      </div>

      <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <legend className="px-1 text-sm font-semibold">
          When students see this
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="label">
            Status
            <select className="field" value={topic.status} onChange={set("status")}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {topic.status === "scheduled" ? (
            <label className="label">
              Release date and time
              <input
                className="field"
                type="datetime-local"
                value={topic.release_at}
                onChange={set("release_at")}
                required
              />
            </label>
          ) : (
            <div className="text-sm text-slate-600 self-end pb-2 dark:text-slate-400">
              {hint?.hint}
            </div>
          )}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="label">
            Due date (optional)
            <input
              className="field"
              type="datetime-local"
              value={topic.due_at}
              onChange={set("due_at")}
            />
          </label>
          <label className="label">
            Points
            <input
              className="field"
              type="number"
              min={0}
              step="0.5"
              value={topic.points}
              onChange={set("points")}
            />
          </label>
          <label className="label">
            Late work
            <select
              className="field"
              value={topic.late_policy}
              onChange={set("late_policy")}
            >
              {LATE_POLICIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="label mt-3">
          Unlock after
          <select
            className="field"
            value={topic.unlock_after_id}
            onChange={set("unlock_after_id")}
          >
            <option value="">Nothing, available from the start</option>
            {lessons
              .filter((lesson) => lesson.id !== topic.id)
              .map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title}
                </option>
              ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
            The topic stays locked until a student completes the one you pick.
          </span>
        </label>
      </fieldset>

      <label className="label">
        What the student will be able to do
        <textarea
          className="field min-h-28 font-mono text-xs"
          value={topic.objectives}
          onChange={set("objectives")}
          placeholder={"One objective per line"}
        />
      </label>

      <div>
        <button
          type="button"
          className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
          onClick={() => setShowAll((value) => !value)}
          aria-expanded={showAll}
        >
          {showAll ? "Hide" : "Show"} lesson content JSON
        </button>
        {showAll ? (
          <textarea
            className="field mt-2 min-h-40 font-mono text-xs"
            value={topic.content}
            onChange={set("content")}
            placeholder='{ "explanation": "..." }'
          />
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button className="button-primary" type="submit" disabled={busy}>
          {busy ? "Saving" : "Save topic"}
        </button>
        <button className="button-secondary" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
