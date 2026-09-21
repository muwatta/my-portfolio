import { supabase } from "./supabase";

const COURSE_SLUG = "python-for-ai-machine-learning";

const lessonSelect =
  "id, title, slug, lesson_number, objectives, content, academy_weeks!inner(id, week_number, title, academy_courses!inner(id, slug, title, duration_weeks))";

const unavailable = (data = null) => ({ data, error: null, configured: false });

export async function getAcademyStudentOverview(studentId) {
  if (!supabase) return unavailable(null);

  const [
    { data: enrollments, error: enrollmentError },
    { data: schedules, error: scheduleError },
    { data: badges, error: badgeError },
    { data: sessions, error: sessionError },
  ] = await Promise.all([
    supabase
      .from("academy_enrollments")
      .select(
        "id, status, enrolled_at, academy_courses(id, slug, title, duration_weeks, academy_subjects(name), academy_levels(name))",
      )
      .eq("student_id", studentId)
      .eq("status", "active"),
    supabase
      .from("academy_schedules")
      .select(
        "id, activity_type, title, description, starts_at, ends_at, academy_courses(title), academy_lessons(title)",
      )
      .eq("published", true)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(5),
    supabase
      .from("academy_student_badges")
      .select("awarded_at, academy_badges(name, description, icon)")
      .eq("student_id", studentId)
      .order("awarded_at", { ascending: false })
      .limit(6),
    supabase
      .from("academy_learning_sessions")
      .select("active_seconds, started_at, last_heartbeat_at")
      .eq("student_id", studentId)
      .order("started_at", { ascending: false })
      .limit(100),
  ]);

  const errors = enrollmentError || scheduleError || badgeError || sessionError;
  return {
    data: {
      enrollment: enrollments?.[0] ?? null,
      schedules: schedules ?? [],
      badges: badges ?? [],
      learningSeconds: (sessions ?? []).reduce(
        (total, session) => total + (session.active_seconds ?? 0),
        0,
      ),
    },
    error: errors,
    configured: true,
  };
}

export async function getAcademyCourses() {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase
    .from("academy_courses")
    .select(
      "id, slug, title, description, duration_weeks, academy_subjects(name, slug), academy_levels(name, slug)",
    )
    .eq("published", true)
    .order("title");
  return { data: data ?? [], error, configured: true };
}

export async function getAcademyLeaderboard() {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase.rpc("academy_leaderboard");
  return { data: data ?? [], error, configured: true };
}

export async function getAcademyNotifications(studentId) {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase
    .from("academy_notifications")
    .select("id, type, title, body, read_at, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(20);
  return { data: data ?? [], error, configured: true };
}

export async function getAcademyLiveRooms() {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase
    .from("academy_live_rooms")
    .select(
      "id, title, status, created_at, academy_schedules(title, starts_at)",
    )
    .in("status", ["scheduled", "live"])
    .order("created_at", { ascending: false });
  return { data: data ?? [], error, configured: true };
}

export async function getAcademyLiveMessages(roomId) {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase
    .from("academy_live_messages")
    .select("id, sender_id, body, created_at")
    .eq("room_id", roomId)
    .order("created_at");
  return { data: data ?? [], error, configured: true };
}

export async function sendAcademyLiveMessage(roomId, senderId, body) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase
    .from("academy_live_messages")
    .insert({ room_id: roomId, sender_id: senderId, body: body.trim() })
    .select("id, sender_id, body, created_at")
    .single();
  return { data, error };
}

export async function joinAcademyLiveRoom(roomId, studentId) {
  if (!supabase) return { error: new Error("Academy is not configured.") };
  const { error } = await supabase
    .from("academy_live_attendance")
    .upsert(
      { room_id: roomId, student_id: studentId },
      { onConflict: "room_id,student_id" },
    );
  return { error };
}

export async function markAcademyNotificationRead(notificationId) {
  if (!supabase) return { error: new Error("Academy is not configured.") };
  const { error } = await supabase
    .from("academy_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  return { error };
}

export async function getAcademyProjects(studentId) {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase
    .from("academy_projects")
    .select(
      "id, title, description, academy_project_milestones(id, milestone_number, title, academy_project_progress(student_id, completed_at, notes))",
    )
    .order("created_at");
  const projects = (data ?? []).map((project) => ({
    ...project,
    academy_project_milestones: (project.academy_project_milestones ?? []).map(
      (milestone) => ({
        ...milestone,
        progress:
          milestone.academy_project_progress?.find(
            (item) => item.student_id === studentId,
          ) ?? null,
      }),
    ),
  }));
  return { data: projects, error, configured: true };
}

export async function markProjectMilestoneComplete(
  milestoneId,
  studentId,
  notes = "",
) {
  if (!supabase) return { error: new Error("Academy is not configured.") };
  const { error } = await supabase.from("academy_project_progress").upsert(
    {
      milestone_id: milestoneId,
      student_id: studentId,
      completed_at: new Date().toISOString(),
      notes,
    },
    { onConflict: "milestone_id,student_id" },
  );
  return { error };
}

export async function getAcademyTeacherStudents() {
  if (!supabase) return unavailable([]);
  await supabase.rpc("academy_sync_profiles");
  const [
    { data: students, error: studentError },
    { data: levels, error: levelError },
    { data: sessions, error: sessionError },
  ] = await Promise.all([
    supabase
      .from("academy_profiles")
      .select(
        "id, display_name, role, level_id, school_id, state, city, student_level, updated_at, academy_levels(id, name, slug), academy_schools(id, name, code, state, city)",
      )
      .eq("role", "student")
      .order("display_name"),
    supabase
      .from("academy_levels")
      .select("id, name, slug")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("academy_learning_sessions")
      .select("student_id, active_seconds, last_heartbeat_at"),
  ]);
  const activityByStudent = new Map();
  (sessions ?? []).forEach((session) => {
    const activity = activityByStudent.get(session.student_id) ?? {
      seconds: 0,
      lastActive: null,
    };
    activity.seconds += session.active_seconds ?? 0;
    if (!activity.lastActive || session.last_heartbeat_at > activity.lastActive)
      activity.lastActive = session.last_heartbeat_at;
    activityByStudent.set(session.student_id, activity);
  });
  return {
    data: {
      students: (students ?? []).map((student) => ({
        ...student,
        activity: activityByStudent.get(student.id) ?? {
          seconds: 0,
          lastActive: null,
        },
      })),
      levels: levels ?? [],
    },
    error: studentError || levelError || sessionError,
    configured: true,
  };
}

export async function getAcademyTeacherAnalytics() {
  if (!supabase) return unavailable(null);
  const [
    { data: students, error: studentError },
    { data: sessions, error: sessionError },
    { data: progress, error: progressError },
    { count: submissions, error: submissionError },
  ] = await Promise.all([
    supabase
      .from("academy_profiles")
      .select("id, display_name, level_id, academy_levels(name)")
      .eq("role", "student"),
    supabase
      .from("academy_learning_sessions")
      .select("student_id, active_seconds, last_heartbeat_at"),
    supabase.from("academy_lesson_progress").select("student_id, completed_at"),
    supabase
      .from("academy_submissions")
      .select("id", { count: "exact", head: true }),
  ]);
  const sessionByStudent = new Map();
  (sessions ?? []).forEach((session) => {
    const current = sessionByStudent.get(session.student_id) ?? {
      seconds: 0,
      lastActive: null,
    };
    current.seconds += session.active_seconds ?? 0;
    if (!current.lastActive || session.last_heartbeat_at > current.lastActive)
      current.lastActive = session.last_heartbeat_at;
    sessionByStudent.set(session.student_id, current);
  });
  const completedByStudent = new Map();
  (progress ?? []).forEach((item) => {
    if (item.completed_at)
      completedByStudent.set(
        item.student_id,
        (completedByStudent.get(item.student_id) ?? 0) + 1,
      );
  });
  return {
    data: {
      students: (students ?? []).map((student) => ({
        ...student,
        activity: sessionByStudent.get(student.id) ?? {
          seconds: 0,
          lastActive: null,
        },
        completedLessons: completedByStudent.get(student.id) ?? 0,
      })),
      submissions: submissions ?? 0,
    },
    error: studentError || sessionError || progressError || submissionError,
    configured: true,
  };
}

export async function getAcademyAdminOverview() {
  if (!supabase) return unavailable(null);
  const [
    { data: profiles, error: profileError },
    { data: courses, error: courseError },
    { data: sessions, error: sessionError },
  ] = await Promise.all([
    supabase
      .from("academy_profiles")
      .select(
        "id, display_name, role, level_id, updated_at, academy_levels(name)",
      ),
    supabase.from("academy_courses").select("id, published"),
    supabase
      .from("academy_learning_sessions")
      .select("student_id, last_heartbeat_at"),
  ]);
  return {
    data: {
      students: (profiles ?? []).filter((profile) => profile.role === "student")
        .length,
      teachers: (profiles ?? []).filter((profile) => profile.role === "teacher")
        .length,
      courses: courses?.length ?? 0,
      activeLearners: new Set(
        (sessions ?? [])
          .filter(
            (session) =>
              Date.now() - new Date(session.last_heartbeat_at).getTime() <
              15 * 60 * 1000,
          )
          .map((session) => session.student_id),
      ).size,
    },
    error: profileError || courseError || sessionError,
    configured: true,
  };
}

export async function getAcademyAdminAccess() {
  if (!supabase) return unavailable({ profiles: [], admins: [] });
  const [
    { data: profiles, error: profileError },
    { data: admins, error: adminError },
  ] = await Promise.all([
    supabase
      .from("academy_profiles")
      .select("id, display_name, role, updated_at")
      .order("display_name"),
    supabase.from("academy_admins").select("user_id"),
  ]);
  return {
    data: { profiles: profiles ?? [], admins: admins ?? [] },
    error: profileError || adminError,
    configured: true,
  };
}

export async function setAcademyAdmin(userId, enabled) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_set_user_admin", {
    target_user_id: userId,
    should_be_admin: enabled,
  });
  return { data, error };
}

export async function setAcademyUserRole(userId, role) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_set_user_role", {
    target_user_id: userId,
    target_role: role,
  });
  return { data, error };
}

export async function getAcademyStudentProfile(studentId) {
  if (!supabase) return unavailable(null);
  const [
    { data: profile, error: profileError },
    { data: overview, error: overviewError },
  ] = await Promise.all([
    supabase
      .from("academy_profiles")
      .select(
        "id, display_name, role, avatar_url, level_id, school_id, state, city, student_level, updated_at, academy_levels(name), academy_schools(id, name, code, state, city)",
      )
      .eq("id", studentId)
      .maybeSingle(),
    getAcademyStudentOverview(studentId),
  ]);
  return {
    data: { profile, overview },
    error: profileError || overviewError,
    configured: true,
  };
}

export async function getAcademySchools() {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase
    .from("academy_schools")
    .select("id, name, code, state, city")
    .eq("is_active", true)
    .order("name");
  return { data: data ?? [], error, configured: true };
}

export async function updateAcademyStudentProfile(studentId, updates) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  return supabase
    .from("academy_profiles")
    .update(updates)
    .eq("id", studentId)
    .select(
      "id, display_name, avatar_url, school_id, state, city, student_level, academy_schools(id, name, code, state, city)",
    )
    .single();
}

export async function getAcademyTeacherCourses() {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase
    .from("academy_courses")
    .select(
      "id, slug, title, description, duration_weeks, published, subject_id, level_id, academy_subjects(name), academy_levels(name)",
    )
    .order("title");
  return { data: data ?? [], error, configured: true };
}

export async function getAcademyCourseOptions() {
  if (!supabase) return unavailable({ levels: [], subjects: [] });
  const [
    { data: levels, error: levelError },
    { data: subjects, error: subjectError },
  ] = await Promise.all([
    supabase
      .from("academy_levels")
      .select("id, name")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("academy_subjects")
      .select("id, name")
      .eq("active", true)
      .order("name"),
  ]);
  return {
    data: { levels: levels ?? [], subjects: subjects ?? [] },
    error: levelError || subjectError,
    configured: true,
  };
}

export async function saveAcademyCourse(course) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const payload = {
    slug: course.slug.trim().toLowerCase(),
    title: course.title.trim(),
    description: course.description.trim(),
    duration_weeks: Number(course.duration_weeks),
    subject_id: course.subject_id || null,
    level_id: course.level_id || null,
    published: Boolean(course.published),
  };
  const query = course.id
    ? supabase.from("academy_courses").update(payload).eq("id", course.id)
    : supabase.from("academy_courses").insert(payload);
  const { data, error } = await query
    .select(
      "id, slug, title, description, duration_weeks, published, subject_id, level_id",
    )
    .single();
  return { data, error };
}

export async function getAcademyTeacherCurriculum() {
  if (!supabase) return unavailable({ courses: [], weeks: [], lessons: [] });
  const [
    { data: courses, error: courseError },
    { data: weeks, error: weekError },
    { data: lessons, error: lessonError },
  ] = await Promise.all([
    supabase
      .from("academy_courses")
      .select("id, title, duration_weeks")
      .order("title"),
    supabase
      .from("academy_weeks")
      .select("id, course_id, week_number, title")
      .order("week_number"),
    supabase
      .from("academy_lessons")
      .select(
        "id, week_id, title, slug, lesson_number, objectives, content, published",
      )
      .order("lesson_number"),
  ]);
  return {
    data: {
      courses: courses ?? [],
      weeks: weeks ?? [],
      lessons: lessons ?? [],
    },
    error: courseError || weekError || lessonError,
    configured: true,
  };
}

export async function saveAcademyWeek(week) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase
    .from("academy_weeks")
    .insert({
      course_id: week.course_id,
      week_number: Number(week.week_number),
      title: week.title.trim(),
    })
    .select("id, course_id, week_number, title")
    .single();
  return { data, error };
}

export async function saveAcademyLesson(lesson) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase
    .from("academy_lessons")
    .insert({
      week_id: lesson.week_id,
      title: lesson.title.trim(),
      slug: lesson.slug.trim().toLowerCase(),
      lesson_number: Number(lesson.lesson_number),
      objectives: lesson.objectives
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      content: { explanation: lesson.content.trim() },
      published: Boolean(lesson.published),
    })
    .select("id, week_id, title, slug, lesson_number, published")
    .single();
  return { data, error };
}

export async function scheduleAcademyLesson(schedule) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data: userResult } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("academy_schedules")
    .insert({
      course_id: schedule.course_id,
      level_id: schedule.level_id || null,
      lesson_id: schedule.lesson_id,
      activity_type: "lesson",
      title: schedule.title.trim(),
      description: schedule.description.trim(),
      starts_at: new Date(schedule.starts_at).toISOString(),
      ends_at: schedule.ends_at
        ? new Date(schedule.ends_at).toISOString()
        : null,
      published: Boolean(schedule.published),
      created_by: userResult.user?.id,
    })
    .select("id, title, starts_at, published")
    .single();
  return { data, error };
}

export async function assignAcademyStudentLevel(studentId, levelId) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_assign_student_level", {
    target_student_id: studentId,
    target_level_id: levelId || null,
  });
  return { data, error };
}

export async function startAcademyLearningSession(route) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  return supabase.rpc("academy_start_learning_session", {
    target_route: route,
  });
}

export async function heartbeatAcademyLearningSession(sessionId, route) {
  if (!supabase) return { error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc(
    "academy_record_learning_heartbeat",
    { target_session_id: sessionId, target_route: route },
  );
  return { data, error };
}

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
  let foundAvailable = false;

  return {
    data: (data ?? []).map((lesson) => ({
      ...lesson,
      progress: progressByLesson.get(lesson.id) ?? null,
      status: progressByLesson.get(lesson.id)?.completed_at
        ? "completed"
        : progressByLesson.get(lesson.id)?.started_at
          ? "in-progress"
          : foundAvailable
            ? "locked"
            : ((foundAvailable = true), "available"),
    })),
    error: error ?? progressError,
    configured: true,
  };
}

export async function markLessonStarted(lessonId, studentId) {
  if (!supabase) return { error: new Error("Academy is not configured.") };
  const { error } = await supabase.from("academy_lesson_progress").upsert(
    {
      lesson_id: lessonId,
      student_id: studentId,
      started_at: new Date().toISOString(),
    },
    { onConflict: "lesson_id,student_id", ignoreDuplicates: false },
  );
  return { error };
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
          "id, lesson_id, title, instructions, starter_code, difficulty, expected_concepts, hints, explanation, question_type, choices, attempt_limit",
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
      "id, lesson_id, title, instructions, starter_code, difficulty, expected_concepts, hints, explanation, question_type, choices, attempt_limit, academy_lessons!inner(title, published)",
    )
    .eq("academy_lessons.published", true)
    .order("title");
  return { data: data ?? [], error, configured: true };
}

export async function submitObjectiveAnswer(exerciseId, answer) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc(
    "academy_submit_objective_answer",
    {
      target_exercise_id: exerciseId,
      submitted_answer: answer,
    },
  );
  return { data, error };
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
