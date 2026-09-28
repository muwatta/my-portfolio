import { useState } from "react";

const STATUS_STYLES = {
  draft: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  scheduled: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  published: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  archived: "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400",
};

export default function TopicList({
  topics,
  weekTitle,
  onEdit,
  onDuplicate,
  onSetStatus,
  onReorder,
  busy,
}) {
  const [dragging, setDragging] = useState(null);
  const [order, setOrder] = useState(null);

  const shown = order ?? topics;

  function commit(nextOrder) {
    setOrder(nextOrder);
    onReorder(nextOrder.map((topic) => topic.id));
  }

  function handleDrop(targetId) {
    if (dragging === null || dragging === targetId) return;
    const from = shown.findIndex((topic) => topic.id === dragging);
    const to = shown.findIndex((topic) => topic.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...shown];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
    setDragging(null);
  }

  function moveBy(index, offset) {
    const next = [...shown];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }

  if (!shown.length) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No topics in {weekTitle} yet.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {shown.map((topic, index) => (
        <li
          key={topic.id}
          draggable
          onDragStart={() => setDragging(topic.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => handleDrop(topic.id)}
          onDragEnd={() => setDragging(null)}
          className={`rounded-xl border bg-white p-3 transition-colors dark:bg-slate-900 ${
            dragging === topic.id
              ? "border-blue-400 opacity-60"
              : "border-slate-200 dark:border-slate-800"
          }`}
        >
          <div className="flex flex-wrap items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-1 cursor-grab text-slate-400"
              title="Drag to reorder"
            >
              ⠿
            </span>

            <div className="min-w-0 flex-1">
              <p className="font-semibold">{topic.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLES[topic.status] ?? STATUS_STYLES.draft}`}
                >
                  {topic.status}
                </span>
                <span>Position {topic.lesson_number}</span>
                {topic.points ? <span>{topic.points} points</span> : null}
                {topic.release_at ? (
                  <span>
                    Releases {new Date(topic.release_at).toLocaleString()}
                  </span>
                ) : null}
                {topic.due_at ? (
                  <span>Due {new Date(topic.due_at).toLocaleString()}</span>
                ) : null}
                {topic.unlock_after_id ? (
                  <span>Locked until a previous topic is done</span>
                ) : null}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                className="button-ghost"
                onClick={() => moveBy(index, -1)}
                disabled={busy || index === 0}
                aria-label={`Move ${topic.title} up`}
              >
                ↑
              </button>
              <button
                type="button"
                className="button-ghost"
                onClick={() => moveBy(index, 1)}
                disabled={busy || index === shown.length - 1}
                aria-label={`Move ${topic.title} down`}
              >
                ↓
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => onEdit(topic)}
              >
                Edit
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => onDuplicate(topic)}
                disabled={busy}
              >
                Duplicate
              </button>
              {topic.status === "published" ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => onSetStatus(topic, "draft")}
                  disabled={busy}
                >
                  Unpublish
                </button>
              ) : (
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => onSetStatus(topic, "published")}
                  disabled={busy}
                >
                  Publish
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
