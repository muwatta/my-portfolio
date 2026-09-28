import { supabase } from "./supabase";

const notConfigured = (data = null) => ({
  data,
  error: new Error("Academy is not configured."),
});

export async function getTeacherDashboard() {
  if (!supabase) return notConfigured(null);
  const { data, error } = await supabase.rpc("academy_teacher_dashboard");
  if (error || !data) return { data: null, error, configured: true };
  return {
    data: {
      needsGrading: data.needs_grading ?? [],
      dueThisWeek: data.due_this_week ?? [],
      inactiveStudents: data.inactive_students ?? [],
      completion: data.completion ?? [],
      recentActivity: data.recent_activity ?? [],
      totals: data.totals ?? {},
    },
    error: null,
    configured: true,
  };
}

// Announce to a whole course, a class, or one student. The database resolves
// the audience, so the client never has to know who is enrolled.
export async function sendAnnouncement({
  title,
  message,
  courseId,
  classId,
  studentId,
}) {
  if (!supabase) return notConfigured(null);
  const { data, error } = await supabase.rpc("academy_announce", {
    p_title: String(title ?? "").trim(),
    p_message: String(message ?? "").trim(),
    p_course_id: courseId || null,
    p_class_id: classId || null,
    p_student_id: studentId || null,
  });
  return { data, error };
}

export async function getGradebook(courseId) {
  if (!supabase) return notConfigured([]);
  if (!courseId) return { data: [], error: null };
  const { data, error } = await supabase.rpc("academy_gradebook", {
    p_course_id: courseId,
  });
  return { data: data ?? [], error };
}

export async function getCourseOptions() {
  if (!supabase) return notConfigured([]);
  const { data, error } = await supabase
    .from("academy_courses")
    .select("id, title, published")
    .order("title");
  return { data: data ?? [], error };
}

export async function getClassOptions() {
  if (!supabase) return notConfigured([]);
  const { data, error } = await supabase
    .from("academy_classes")
    .select("id, name, course_id")
    .order("name");
  return { data: data ?? [], error };
}

// CSV export. A spreadsheet opens a cell as a formula when it starts with =,
// + or -, so those are prefixed. Without it a student called "=cmd" turns a
// gradebook download into something that runs on the teacher's machine.
export function gradebookToCsv(rows) {
  if (!rows?.length) return "";

  const tasks = [];
  for (const row of rows) {
    for (const result of row.results ?? []) {
      if (!tasks.some((task) => task.assignment_id === result.assignment_id)) {
        tasks.push(result);
      }
    }
  }
  tasks.sort((left, right) => (left.title ?? "").localeCompare(right.title ?? ""));

  const header = [
    "Student",
    "Email",
    ...tasks.map((task) => `${task.title} (${task.max_points})`),
    "Total",
    "Possible",
    "Percent",
  ];

  const lines = rows.map((row) => {
    const byId = new Map(
      (row.results ?? []).map((result) => [result.assignment_id, result]),
    );
    const earned = Number(row.total_earned ?? 0);
    const possible = Number(row.total_possible ?? 0);
    const percent = possible ? ((earned / possible) * 100).toFixed(1) : "";
    return [
      row.student_name,
      row.student_email,
      ...tasks.map((task) => {
        const result = byId.get(task.assignment_id);
        if (!result || result.state !== "published") return "";
        return result.score ?? "";
      }),
      earned,
      possible,
      percent,
    ];
  });

  const escape = (value) => {
    const text = value == null ? "" : String(value);
    const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${guarded.replace(/"/g, '""')}"`;
  };

  const csv = [header, ...lines].map((row) => row.map(escape).join(",")).join("\r\n");
  return `${csv}\r\n`;
}

export function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function gradebookFilename(courseTitle) {
  const safe = String(courseTitle ?? "gradebook")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safe || "gradebook"}-gradebook.csv`;
}
