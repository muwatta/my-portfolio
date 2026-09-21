import { supabase } from "./supabase";

const COURSE_SLUG = "python-for-ai-machine-learning";

export async function getAcademyLessons() {
  if (!supabase) return { data: [], error: null, configured: false };

  const { data, error } = await supabase
    .from("academy_lessons")
    .select(
      "id, title, slug, lesson_number, objectives, content, academy_weeks!inner(week_number, title, academy_courses!inner(slug))",
    )
    .eq("published", true)
    .eq("academy_weeks.academy_courses.slug", COURSE_SLUG)
    .order("lesson_number");

  return { data: data ?? [], error, configured: true };
}

export async function getAcademyLesson(id) {
  if (!supabase) return { data: null, error: null, configured: false };

  const { data, error } = await supabase
    .from("academy_lessons")
    .select(
      "id, title, slug, lesson_number, objectives, content, academy_weeks!inner(week_number, title, academy_courses!inner(slug))",
    )
    .eq("id", id)
    .eq("published", true)
    .eq("academy_weeks.academy_courses.slug", COURSE_SLUG)
    .maybeSingle();

  return { data, error, configured: true };
}

export async function markLessonComplete(lessonId, studentId) {
  if (!supabase) return { error: new Error("Academy is not configured.") };

  const { error } = await supabase
    .from("academy_lesson_progress")
    .upsert(
      {
        lesson_id: lessonId,
        student_id: studentId,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "lesson_id,student_id" },
    );

  return { error };
}
