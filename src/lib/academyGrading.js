import { supabase } from "./supabase";

const notConfigured = (data = null) => ({
  data,
  error: new Error("Academy is not configured."),
});

// One queue for everything waiting to be graded, already joined to the student,
// the topic and the course so the grading screen needs a single call.

export async function getGradingQueue(filters = {}) {
  if (!supabase) return notConfigured([]);
  const { data, error } = await supabase.rpc("academy_grading_queue", {
    p_course_id: filters.courseId || null,
    p_topic_id: filters.topicId || null,
    p_student_id: filters.studentId || null,
    p_review_state: filters.reviewState || null,
  });
  return { data: data ?? [], error };
}

// Filter options for the inbox. Topics and students come from the same teacher
// scoped reads the rest of the admin uses.
export async function getGradingFilters() {
  if (!supabase) return notConfigured({ courses: [], topics: [], students: [] });

  const [courses, topics, students] = await Promise.all([
    supabase
      .from("academy_courses")
      .select("id, title")
      .order("title"),
    supabase
      .from("academy_lessons")
      .select("id, title, academy_weeks!inner(title, week_number, academy_courses!inner(id, title))")
      .order("lesson_number")
      .limit(400),
    supabase
      .from("academy_profiles")
      .select("id, display_name")
      .order("display_name")
      .limit(400),
  ]);

  return {
    data: {
      courses: courses.data ?? [],
      topics: topics.data ?? [],
      students: students.data ?? [],
    },
    error: courses.error || topics.error || students.error,
  };
}

// A grade is never a published grade. This records the review; the student sees
// nothing until publishResult.
export async function reviewSubmission({
  submissionId,
  score,
  feedback,
  rubricFeedback,
}) {
  if (!supabase) return notConfigured(null);
  const { data, error } = await supabase.rpc("academy_review_submission", {
    p_submission_id: submissionId,
    p_teacher_score: score === "" || score == null ? null : Number(score),
    p_teacher_feedback: feedback?.trim() ? feedback.trim() : null,
    p_rubric_feedback: rubricFeedback ?? null,
  });
  return { data, error };
}

export async function publishResult(submissionId) {
  if (!supabase) return notConfigured(null);
  const { data, error } = await supabase.rpc("academy_publish_result", {
    p_submission_id: submissionId,
  });
  return { data, error };
}

// Records a run the student made in their own browser. The server stores it as
// unverified, so this is a hint for the teacher and never a mark.
export async function recordBrowserRun({
  assignmentId,
  sourceCode,
  passed,
  total,
  failedNames = [],
  clientOperationId,
  maxScore,
}) {
  if (!supabase) return notConfigured(null);
  const { data, error } = await supabase.rpc("academy_record_client_run", {
    p_assignment_id: assignmentId,
    p_source_code: sourceCode,
    p_passed: Number(passed),
    p_total: Number(total),
    p_failed_names: failedNames,
    p_client_operation_id: clientOperationId ?? null,
    p_max_score: maxScore ?? null,
  });
  return { data, error };
}

// The rubric on an assignment is stored as jsonb in whatever shape the teacher
// saved. Normalise it to a list of criteria so the grading screen can render
// and score it without caring which shape it arrived in.
export function normaliseRubric(rubric) {
  if (!rubric) return [];
  if (Array.isArray(rubric)) {
    return rubric
      .map((entry) => {
        if (typeof entry === "string") {
          return { criterion: entry, max: null, weight: null };
        }
        return {
          criterion: entry?.criterion ?? entry?.name ?? entry?.title ?? "",
          max: numberOrNull(entry?.max ?? entry?.max_points ?? entry?.points),
          weight: numberOrNull(entry?.weight),
        };
      })
      .filter((entry) => entry.criterion);
  }
  if (typeof rubric === "object") {
    const list = rubric.criteria ?? rubric.items ?? rubric.rows;
    if (Array.isArray(list)) return normaliseRubric(list);
    return Object.entries(rubric)
      .map(([criterion, value]) => ({
        criterion,
        max: numberOrNull(value?.max ?? value),
        weight: numberOrNull(value?.weight),
      }))
      .filter((entry) => entry.criterion);
  }
  return [];
}

export function reviewStateLabel(state) {
  switch (state) {
    case "published":
      return "Published to the student";
    case "reviewed":
      return "Reviewed, not published yet";
    case "in_review":
      return "Being reviewed";
    default:
      return "Waiting to be graded";
  }
}

function numberOrNull(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
