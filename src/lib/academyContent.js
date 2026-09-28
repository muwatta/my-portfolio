import { supabase } from "./supabase";

const notConfigured = (data = null) => ({
  data,
  error: new Error("Academy is not configured."),
});

// The teacher content flow lives behind these helpers so the lifecycle rules
// have a single home in the database rather than being spread across forms.

export async function saveLessonRecord(lesson) {
  if (!supabase) return notConfigured(null);

  const objectives = Array.isArray(lesson.objectives)
    ? lesson.objectives
    : String(lesson.objectives ?? "")
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean);

  let content = lesson.content;
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed) content = {};
    else if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        content = parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        content = { explanation: trimmed };
      }
    } else {
      content = { explanation: trimmed };
    }
  }

  const { data, error } = await supabase.rpc("academy_save_lesson", {
    p_lesson_id: lesson.id || null,
    p_week_id: lesson.week_id || null,
    p_title: String(lesson.title ?? "").trim(),
    p_slug: String(lesson.slug ?? "").trim().toLowerCase(),
    p_lesson_number: Number(lesson.lesson_number ?? 0),
    p_objectives: objectives,
    p_content: content && typeof content === "object" ? content : {},
    p_status: lesson.status ?? "draft",
    p_release_at: toTimestamp(lesson.release_at),
    p_due_at: toTimestamp(lesson.due_at),
    p_points: numberOrNull(lesson.points),
    p_late_policy: lesson.late_policy ?? "accept_penalty",
    p_unlock_after_id: lesson.unlock_after_id || null,
    p_sort_order: Number(lesson.sort_order ?? 0),
  });
  return { data, error };
}

export async function setLessonStatus(lessonId, status, releaseAt) {
  if (!supabase) return notConfigured(null);
  const { data, error } = await supabase.rpc("academy_set_lesson_status", {
    p_lesson_id: lessonId,
    p_status: status,
    p_release_at: toTimestamp(releaseAt),
  });
  return { data, error };
}

export async function duplicateLesson(lessonId, overrides = {}) {
  if (!supabase) return notConfigured(null);
  const { data, error } = await supabase.rpc("academy_duplicate_lesson", {
    p_lesson_id: lessonId,
    p_title: overrides.title ?? null,
    p_slug: overrides.slug ?? null,
  });
  return { data, error };
}

export async function reorderLessons(weekId, orderedIds) {
  if (!supabase) return notConfigured(null);
  const { data, error } = await supabase.rpc("academy_reorder_lessons", {
    p_week_id: weekId,
    p_ordered_ids: orderedIds,
  });
  return { data, error };
}

export async function saveActivity(activity) {
  if (!supabase) return notConfigured(null);
  const { data, error } = await supabase.rpc("academy_save_activity", {
    p_lesson_id: activity.lesson_id,
    p_kind: activity.kind,
    p_ref_id: activity.ref_id,
    p_activity_id: activity.id || null,
    p_title: activity.title ?? null,
    p_points: numberOrNull(activity.points),
    p_status: activity.status ?? "published",
    p_release_at: toTimestamp(activity.release_at),
    p_due_at: toTimestamp(activity.due_at),
    p_sort_order: Number(activity.sort_order ?? 0),
  });
  return { data, error };
}

export async function removeActivity(activityId) {
  if (!supabase) return notConfigured(null);
  const { data, error } = await supabase.rpc("academy_remove_activity", {
    p_activity_id: activityId,
  });
  return { data, error };
}

// A dry run. Writes nothing, so the editor can show exactly which rows would
// fail before the teacher commits to an import.
export async function validateLessonImport(weekId, rows) {
  if (!supabase) return notConfigured([]);
  const { data, error } = await supabase.rpc(
    "academy_validate_lesson_import",
    { p_week_id: weekId, p_rows: rows },
  );
  return { data: data ?? [], error };
}

export async function importLessons(weekId, rows) {
  if (!supabase) return notConfigured(null);
  const { data, error } = await supabase.rpc("academy_import_lessons", {
    p_week_id: weekId,
    p_rows: rows,
    p_status: "draft",
  });
  return { data, error };
}

// Accepts the Markdown, JSON array and CSV shapes a teacher is likely to paste
// or upload, and returns the row objects the validator expects.
export function parseTopicRows(input) {
  const text = String(input ?? "").trim();
  if (!text) {
    return { rows: [], error: "Paste or upload some topics first." };
  }

  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        return { rows: [], error: "The JSON must be an array of topics." };
      }
      return { rows: parsed.map(normaliseRow), error: null };
    } catch {
      return { rows: [], error: "That is not valid JSON." };
    }
  }

  // Markdown headings, optionally followed by a "## Objectives" list.
  if (/^#{1,3}\s+/m.test(text)) {
    return { rows: parseMarkdown(text), error: null };
  }

  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const header = splitCsvLine(lines[0] ?? "").map((cell) =>
    cell.trim().toLowerCase().replace(/\s+/g, "_"),
  );

  // A bare list of titles is a valid import, so a single "title" column counts
  // as CSV even without a comma.
  if (lines.length >= 2 && header.includes("title")) {
    // handled below
  } else if (lines.length >= 2 && lines[0].includes(",")) {
    // Comma separated but no title column, so say which column is missing
    // rather than pretending the format was not recognised at all.
    return { rows: [], error: "The CSV needs a title column." };
  } else {
    return {
      rows: [],
      error:
        "Unrecognised format. Use JSON, Markdown headings, or CSV with a title column.",
    };
  }

  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return normaliseRow(
      Object.fromEntries(
        header.map((key, index) => [key, (cells[index] ?? "").trim()]),
      ),
    );
  });
  return { rows, error: null };
}

export const TOPIC_IMPORT_TEMPLATE = `title,objectives,lesson_number,points,due_at,late_policy
"Loops and iteration","for loops|while loops",1,10,2026-11-14,accept_penalty
"Functions and scope","def|return|scope",2,15,,closed
`;

function normaliseRow(row) {
  const value = row && typeof row === "object" ? row : {};
  const rawObjectives = value.objectives;
  const objectives = Array.isArray(rawObjectives)
    ? rawObjectives
    : String(rawObjectives ?? "")
        .split(/[|;\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
  const content = value.content;
  return {
    title: String(value.title ?? "").trim(),
    slug: String(value.slug ?? "").trim().toLowerCase(),
    lesson_number:
      value.lesson_number === "" || value.lesson_number == null
        ? null
        : Number(value.lesson_number),
    objectives,
    content: content && typeof content === "object" ? content : undefined,
    points: value.points === "" || value.points == null ? null : Number(value.points),
    due_at: value.due_at || null,
    release_at: value.release_at || null,
    late_policy: value.late_policy || "accept_penalty",
  };
}

function parseMarkdown(text) {
  const rows = [];
  let current = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const heading = rawLine.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      if (current) rows.push(current);
      current = { title: heading[2].trim(), objectives: [] };
      continue;
    }
    const bullet = rawLine.match(/^\s*[-*]\s+(.*)$/);
    if (bullet && current) current.objectives.push(bullet[1].trim());
  }
  if (current) rows.push(current);
  return rows.map(normaliseRow);
}

// Minimal CSV reader: handles quoted fields and escaped quotes, which is enough
// for a template the teacher downloads from this page.
function splitCsvLine(line) {
  const cells = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      cells.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  cells.push(value);
  return cells;
}

function toTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function numberOrNull(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// The shape the topic editor binds to. Kept here rather than beside the
// component so the component file only exports a component.

export const emptyTopic = {
  id: "",
  week_id: "",
  title: "",
  slug: "",
  lesson_number: 1,
  objectives: "",
  content: "",
  status: "draft",
  release_at: "",
  due_at: "",
  points: "",
  late_policy: "accept_penalty",
  unlock_after_id: "",
  sort_order: 0,
};

export function topicFromRow(row) {
  return {
    id: row.id,
    week_id: row.week_id,
    title: row.title ?? "",
    slug: row.slug ?? "",
    lesson_number: row.lesson_number ?? 1,
    objectives: Array.isArray(row.objectives)
      ? row.objectives.join("\n")
      : (row.objectives ?? ""),
    content: row.content && typeof row.content === "object"
      ? JSON.stringify(row.content, null, 2)
      : (row.content ?? ""),
    status: row.status ?? (row.published ? "published" : "draft"),
    release_at: toLocalInput(row.release_at),
    due_at: toLocalInput(row.due_at),
    points: row.points ?? "",
    late_policy: row.late_policy ?? "accept_penalty",
    unlock_after_id: row.unlock_after_id ?? "",
    sort_order: row.sort_order ?? 0,
  };
}

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
