import { supabase } from "./supabase";

const COURSE_SLUG = "python-for-ai-machine-learning";

const lessonSelect =
  "id, title, slug, lesson_number, objectives, content, academy_weeks!inner(id, week_number, title, academy_courses!inner(id, slug, title, duration_weeks))";

const unavailable = (data = null) => ({ data, error: null, configured: false });

export async function getAcademyLessons(studentId) {
  if (!supabase) return unavailable([]);

  const { data, error } = await supabase
    .from("academy_lessons")
    .select(lessonSelect)
    .eq("published", true)
    .eq("academy_weeks.academy_courses.slug", COURSE_SLUG)
    .order("lesson_number");

  if (error || !studentId) return { data: data ?? [], error, configured: true };

  const { data: progress, error: progressError } = await supabase
    .from("academy_lesson_progress")
    .select("lesson_id, completed_at")
    .eq("student_id", studentId);
  const progressByLesson = new Map(
    (progress ?? []).map((item) => [item.lesson_id, item]),
  );

  return {
    data: (data ?? []).map((lesson) => ({
      ...lesson,
      progress: progressByLesson.get(lesson.id) ?? null,
    })),
    error: error ?? progressError,
    configured: true,
  };
}

export async function getAcademyLesson(id, studentId) {
  if (!supabase) return unavailable(null);

  const { data, error } = await supabase
    .from("academy_lessons")
    .select(lessonSelect)
    .eq("id", id)
    .eq("published", true)
    .eq("academy_weeks.academy_courses.slug", COURSE_SLUG)
    .maybeSingle();
  if (error || !data) return { data, error, configured: true };

  const [{ data: exercises, error: exercisesError }, { data: progress }] =
    await Promise.all([
      supabase
        .from("academy_exercises")
        .select(
          "id, lesson_id, title, instructions, starter_code, difficulty, expected_concepts, hints, tests, explanation",
        )
        .eq("lesson_id", id),
      studentId
        ? supabase
            .from("academy_lesson_progress")
            .select("lesson_id, completed_at")
            .eq("lesson_id", id)
            .eq("student_id", studentId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  return {
    data: { ...data, exercises: exercises ?? [], progress: progress ?? null },
    error: error ?? exercisesError,
    configured: true,
  };
}

export async function markLessonComplete(lessonId, studentId) {
  if (!supabase) return { error: new Error("Academy is not configured.") };
  const { error } = await supabase.from("academy_lesson_progress").upsert(
    {
      lesson_id: lessonId,
      student_id: studentId,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "lesson_id,student_id" },
  );
  return { error };
}

export async function getAcademyAssignments() {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase
    .from("academy_assignments")
    .select(
      "id, course_id, lesson_id, title, instructions, due_at, points, allowed_submission_types, starter_code, hints, retry_limit, published, created_at",
    )
    .eq("published", true)
    .order("due_at", { ascending: true, nullsFirst: false });
  return { data: data ?? [], error, configured: true };
}

export async function getAcademyExercises() {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase
    .from("academy_exercises")
    .select(
      "id, lesson_id, title, instructions, starter_code, difficulty, expected_concepts, hints, tests, explanation, academy_lessons!inner(title, published)",
    )
    .eq("academy_lessons.published", true)
    .order("title");
  return { data: data ?? [], error, configured: true };
}

export async function getAcademyAssignment(id) {
  if (!supabase) return unavailable(null);
  const { data, error } = await supabase
    .from("academy_assignments")
    .select(
      "id, course_id, lesson_id, title, instructions, due_at, points, allowed_submission_types, starter_code, hints, retry_limit, published, created_at",
    )
    .eq("id", id)
    .eq("published", true)
    .maybeSingle();
  return { data, error, configured: true };
}

export async function getSubmissionCount(assignmentId, studentId) {
  if (!supabase)
    return { count: 0, error: new Error("Academy is not configured.") };
  const { count, error } = await supabase
    .from("academy_submissions")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId);
  return { count: count ?? 0, error };
}

export async function submitAssignment({
  assignmentId,
  studentId,
  attemptNumber,
  sourceCode = null,
  filePath = null,
  originalFilename = null,
  mimeType = null,
  fileSizeBytes = null,
}) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase
    .from("academy_submissions")
    .insert({
      assignment_id: assignmentId,
      student_id: studentId,
      attempt_number: attemptNumber,
      source_code: sourceCode,
      file_path: filePath,
      original_filename: originalFilename,
      mime_type: mimeType,
      file_size_bytes: fileSizeBytes,
    })
    .select("id, assignment_id, attempt_number, status, submitted_at")
    .single();
  return { data, error };
}

export async function getAcademyProgress(studentId) {
  if (!supabase) return { data: null, error: null, configured: false };
  const [
    { data: lessons, error: lessonsError },
    { data: progress, error: progressError },
    { count: submissions, error: submissionsError },
  ] = await Promise.all([
    supabase
      .from("academy_lessons")
      .select(
        "id, academy_weeks!inner(week_number, academy_courses!inner(slug, duration_weeks))",
      )
      .eq("published", true)
      .eq("academy_weeks.academy_courses.slug", COURSE_SLUG),
    supabase
      .from("academy_lesson_progress")
      .select("lesson_id, completed_at")
      .eq("student_id", studentId)
      .not("completed_at", "is", null),
    supabase
      .from("academy_submissions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId),
  ]);
  const completedLessonIds = new Set(
    (progress ?? []).map((item) => item.lesson_id),
  );
  const lessonCount = lessons?.length ?? 0;
  const completedLessons = completedLessonIds.size;
  const currentWeek =
    lessons
      ?.filter((lesson) => completedLessonIds.has(lesson.id))
      .reduce(
        (week, lesson) => Math.max(week, lesson.academy_weeks.week_number),
        0,
      ) ?? 0;
  return {
    data: {
      lessonCount,
      completedLessons,
      completionPercent: lessonCount
        ? Math.round((completedLessons / lessonCount) * 100)
        : 0,
      currentWeek: Math.min(currentWeek + 1, 11),
      submissions: submissions ?? 0,
    },
    error: lessonsError ?? progressError ?? submissionsError,
    configured: true,
  };
}
