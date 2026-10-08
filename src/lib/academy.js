import { supabase } from "./supabase";
import { fetchWithOfflineFallback } from "./academyOffline";
import { OFFLINE_STORES } from "./offlineStore";

const lessonSelect =
  "id, title, slug, lesson_number, sort_order, objectives, content, prerequisite_lesson_id, completion_requirement, completion_mode, preview_allowed, academy_weeks!inner(id, week_number, title, academy_courses!inner(id, slug, title, duration_weeks, language))";

const unavailable = (data = null) => ({ data, error: null, configured: false });
const isReleased = (item) =>
  item.status === "published" &&
  (!item.release_at || Date.parse(item.release_at) <= Date.now());
const createClientOperationId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `academy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const academyCache = new Map();
const academyRequests = new Map();
let academyCacheGeneration = 0;

function withAcademyCache(key, ttl, loader) {
  const cached = academyCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value);
  }
  if (academyRequests.has(key)) return academyRequests.get(key);

  const staleValue = cached?.value;
  const generation = academyCacheGeneration;
  const request = Promise.resolve()
    .then(loader)
    .then((value) => {
      if (value?.error) {
        return staleValue ? { ...value, data: staleValue.data, stale: true } : value;
      }
      if (generation === academyCacheGeneration) {
        academyCache.set(key, { value, expiresAt: Date.now() + ttl });
      }
      return value;
    })
    .finally(() => academyRequests.delete(key));
  academyRequests.set(key, request);
  return request;
}

export function invalidateAcademyCache(...prefixes) {
  academyCacheGeneration += 1;
  if (!prefixes.length) {
    academyCache.clear();
    return;
  }
  for (const key of academyCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      academyCache.delete(key);
    }
  }
}

export async function getActiveCourseForStudent(studentId) {
  if (!supabase || !studentId) return null;
  return withAcademyCache(`active-course:${studentId}`, 5 * 60 * 1000, async () => {
    const { data: enrollmentData } = await supabase
      .from("academy_enrollments")
      .select(
        "course_id, academy_courses!academy_enrollments_course_id_fkey(id, slug, title, description, duration_weeks)",
      )
      .eq("student_id", studentId)
      .eq("status", "active")
      .order("enrolled_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return enrollmentData?.academy_courses ?? null;
  });
}

export async function selectAcademyCourse(studentId, courseId) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_select_course", {
    target_course_id: courseId,
    target_student_id: studentId,
  });
  if (!error) {
    invalidateAcademyCache(
      `active-course:${studentId}`,
      `lessons:${studentId}`,
      `progress:${studentId}`,
      `assignments:${studentId}`,
      `overview:${studentId}`,
    );
  }
  return { data, error };
}

// One round trip for everything the home screen needs to say "what now". The
// rules live in the database so the answer matches what the student is actually
// allowed to see.
export async function getAcademyStudentHome(userId) {
  if (!supabase) return unavailable(null);
  // Cached to IndexedDB as well as memory, so a student on a bad connection
  // still sees what to do next instead of an empty home screen. The cached copy
  // is a snapshot, so the page already treats it as something to read rather
  // than something to act on.
  return fetchWithOfflineFallback({
    userId,
    store: OFFLINE_STORES.metadata,
    id: "student-home",
fetcher: () =>
        // Scoped by user: the RPC result is whoever is signed in, and the cache
        // outlives a sign-out, so a shared key would serve one student's home
        // snapshot to the next.
        withAcademyCache(`home:${userId ?? "anon"}`, 60 * 1000, async () => {
        const { data, error } = await supabase.rpc("academy_student_home");
        if (error || !data) return { data: null, error, configured: true };
        return {
          data: {
            course: data.course ?? null,
            continueLesson: data.continue_lesson ?? null,
            nextLesson: data.next_lesson ?? null,
            dueSoon: Array.isArray(data.due_soon) ? data.due_soon : [],
            completedCount: Number(data.completed_count ?? 0),
            totalCount: Number(data.total_count ?? 0),
          },
          error: null,
          configured: true,
        };
      }),
  });
}

export async function getAcademyStudentOverview(studentId) {
  if (!supabase) return unavailable(null);
  return withAcademyCache(`overview:${studentId}`, 60 * 1000, async () => {
    const [
      { data: enrollments, error: enrollmentError },
      { data: schedules, error: scheduleError },
      { data: badges, error: badgeError },
      { data: sessions, error: sessionError },
    ] = await Promise.all([
      supabase
        .from("academy_enrollments")
        .select(
          "id, status, enrolled_at, academy_courses!academy_enrollments_course_id_fkey(id, slug, title, duration_weeks, academy_subjects!academy_courses_subject_id_fkey(name), course_family)",
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
        .eq("student_id", studentId),
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
  });
}

export async function getAcademyCourses() {
  if (!supabase) return unavailable([]);
  return withAcademyCache("courses:published", 15 * 60 * 1000, async () => {
    const { data, error } = await supabase
      .from("academy_courses")
      .select(
        "id, slug, title, description, duration_weeks, sort_order, academy_subjects(name, slug), course_family, is_programming_course",
      )
      .eq("published", true)
      // By sort_order, then by id so the order is total and two courses can
      // never swap places between loads. Ordering by title, which is what this
      // did, put C++ before Python before Terminal, which is not the order
      // anybody set and is the "scattered" symptom.
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    return { data: data ?? [], error, configured: true };
  });
}

export async function getAcademyLeaderboard() {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase.rpc("academy_leaderboard");
  return { data: data  ??  [], error, configured: true };
}

export async function getAcademyWeeklyLeaderboard() {
  if (!supabase) return unavailable([]);
  return withAcademyCache("leaderboard:weekly", 30 * 1000, async () => {
    const { data, error } = await supabase.rpc("academy_weekly_leaderboard");
    return { data: (data ?? []).slice(0, 10), error, configured: true };
  });
}

export async function getAcademyNotifications(studentId) {
  if (!supabase) return unavailable([]);
  return withAcademyCache(`notifications:${studentId}`, 15 * 1000, async () => {
    const { data, error } = await supabase
      .from("academy_notifications")
      .select("id, type, title, message, read_at, created_at")
      .eq("user_id", studentId)
      .order("created_at", { ascending: false })
      .limit(20);
    return { data: data ?? [], error, configured: true };
  });
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
  return { data: data  ??  [], error, configured: true };
}

export const VOICE_NOTE_BUCKET = "live-voice-notes";
export const MAX_VOICE_NOTE_SECONDS = 300;
export const MAX_VOICE_NOTE_BYTES = 2 * 1024 * 1024;

export function formatDuration(totalSeconds) {
  const value = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = String(Math.floor(value / 60)).padStart(2, "0");
  const seconds = String(value % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export async function getAcademyLiveMessages(roomId) {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase
    .from("academy_live_messages")
    .select(
      "id, sender_id, body, audio_path, audio_mime, duration_seconds, created_at",
    )
    .eq("room_id", roomId)
    .order("created_at");
  return { data: data ?? [], error, configured: true };
}

// A short lived signed URL, so a private recording can be played without ever
// making the bucket public. Five minutes is all an audio element needs.
export async function getVoiceNoteUrl(messageId, storedPath) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const path = storedPath || `messages/${messageId}.webm`;
  const { data, error } = await supabase.storage
    .from(VOICE_NOTE_BUCKET)
    .createSignedUrl(path, 300);
  return { data: data?.signedUrl ?? null, error };
}

export async function sendAcademyVoiceNote({
  roomId,
  blob,
  durationSeconds,
  extension = "webm",
}) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { data: null, error: new Error("Sign in to post a voice note.") };
  }

  const mime = blob.type || "audio/webm";
  const path = `${userData.user.id}/messages/${globalThis.crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(VOICE_NOTE_BUCKET)
    .upload(path, blob, { contentType: mime, upsert: false });
  if (uploadError) return { data: null, error: uploadError };

  const { data, error } = await supabase.rpc("academy_post_voice_note", {
    p_room_id: roomId,
    p_audio_path: path,
    p_audio_mime: mime,
    p_duration_seconds: Math.round(durationSeconds),
    p_size_bytes: blob.size,
  });

  // The upload landed but the message did not, so remove the orphan rather than
  // leaving audio in the bucket that nothing can reach.
  if (error) {
    await supabase.storage.from(VOICE_NOTE_BUCKET).remove([path]);
    return { data: null, error };
  }
  return { data, error: null };
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

export async function leaveAcademyLiveRoom(roomId) {
  if (!supabase) return { error: new Error("Academy is not configured.") };
  const { error } = await supabase.rpc("academy_leave_live_room", {
    target_room_id: roomId,
  });
  return { error };
}

export async function markAcademyNotificationRead(notificationId, studentId) {
  if (!supabase) return { error: new Error("Academy is not configured.") };
  const { error } = await supabase
    .from("academy_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (!error && studentId) invalidateAcademyCache(`notifications:${studentId}`);
  return { error };
}

export async function getAcademyProjects(studentId) {
  if (!supabase) return unavailable([]);
  return withAcademyCache(`projects:${studentId}`, 2 * 60 * 1000, async () => {
    const { data, error } = await supabase
      .from("academy_projects")
      .select(
        "id, title, description, academy_project_milestones(id, milestone_number, title, academy_project_progress(student_id, completed_at, notes))",
      )
      .order("created_at");
    const projects = (data ?? []).map((project) => ({
      ...project,
      academy_project_milestones: (project.academy_project_milestones ?? [])
        .slice()
        .sort(
          (left, right) =>
            (left.milestone_number ?? 0) - (right.milestone_number ?? 0),
        )
        .map((milestone) => ({
          ...milestone,
          progress:
            milestone.academy_project_progress?.find(
              (item) => item.student_id === studentId,
            ) ?? null,
        })),
    }));
    return { data: projects, error, configured: true };
  });
}

export async function markProjectMilestoneComplete(
  milestoneId,
  studentId,
  notes = "",
) {
  if (!supabase) return { error: new Error("Academy is not configured.") };
  if (!studentId) return { error: new Error("Authentication required.") };
  const { error } = await supabase.rpc("academy_complete_project_milestone", {
    target_milestone_id: milestoneId,
    target_notes: notes,
  });
  if (!error) invalidateAcademyCache(`projects:${studentId}`);
  return { error };
}

export async function getAcademyTeacherStudents() {
  if (!supabase) return unavailable([]);
  return withAcademyCache("teacher-students", 10 * 1000, async () => {
    const [
    { data: students, error: studentError },
    { data: levels, error: levelError },
    { data: sessions, error: sessionError },
    { data: enrollments, error: enrollmentError },
    { data: progress, error: progressError },
  ] = await Promise.all([
    supabase
      .from("academy_profiles")
      .select(
        "id, display_name, email, role, current_course_id, school_id, state, city, student_level, registration_code_id, updated_at, academy_registration_codes!academy_profiles_registration_code_id_fkey(registration_number, status), academy_courses!academy_profiles_current_course_id_fkey(id, slug, title), academy_schools!academy_profiles_school_id_fkey(id, name, code, state, city)",
      )
      .eq("role", "student")
      .order("display_name"),
    supabase
      .from("academy_courses")
      .select("id, slug, title")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("academy_learning_sessions")
      .select("student_id, active_seconds, last_heartbeat_at"),
    supabase
      .from("academy_enrollments")
      .select("student_id, status, enrolled_at, completed_at, course_id")
      .order("enrolled_at", { ascending: false }),
    supabase
      .from("academy_lesson_progress")
      .select("student_id, completed_at")
      .not("completed_at", "is", null),
  ]);
  const enrollmentByStudent = new Map();
  (enrollments  ??  []).forEach((enrollment) => {
    if (!enrollmentByStudent.has(enrollment.student_id)) {
      enrollmentByStudent.set(enrollment.student_id, enrollment);
    }
  });
  const completedLessonsByStudent = new Map();
  (progress  ??  []).forEach((item) => {
    completedLessonsByStudent.set(
      item.student_id,
      (completedLessonsByStudent.get(item.student_id)  ??  0) + 1,
    );
  });
  const activityByStudent = new Map();
  (sessions  ??  []).forEach((session) => {
    const activity = activityByStudent.get(session.student_id)  ??  {
      seconds: 0,
      lastActive: null,
    };
    activity.seconds += session.active_seconds  ??  0;
    if (!activity.lastActive || session.last_heartbeat_at > activity.lastActive)
      activity.lastActive = session.last_heartbeat_at;
    activityByStudent.set(session.student_id, activity);
  });
  return {
    data: {
      students: (students  ??  []).map((student) => ({
        ...student,
        activity: activityByStudent.get(student.id)  ??  {
          seconds: 0,
          lastActive: null,
        },
        enrollment: enrollmentByStudent.get(student.id)  ??  null,
        completedLessons: completedLessonsByStudent.get(student.id)  ??  0,
      })),
      levels: levels  ??  [],
    },
      error: studentError || levelError || sessionError || enrollmentError || progressError,
      configured: true,
    };
  });
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
      .select(
        "id, display_name, current_course_id, academy_courses!academy_profiles_current_course_id_fkey(title, slug)",
      )
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
  (sessions  ??  []).forEach((session) => {
    const current = sessionByStudent.get(session.student_id)  ??  {
      seconds: 0,
      lastActive: null,
    };
    current.seconds += session.active_seconds  ??  0;
    if (!current.lastActive || session.last_heartbeat_at > current.lastActive)
      current.lastActive = session.last_heartbeat_at;
    sessionByStudent.set(session.student_id, current);
  });
  const completedByStudent = new Map();
  (progress  ??  []).forEach((item) => {
    if (item.completed_at)
      completedByStudent.set(
        item.student_id,
        (completedByStudent.get(item.student_id)  ??  0) + 1,
      );
  });
  return {
    data: {
      students: (students  ??  []).map((student) => ({
        ...student,
        activity: sessionByStudent.get(student.id)  ??  {
          seconds: 0,
          lastActive: null,
        },
        completedLessons: completedByStudent.get(student.id)  ??  0,
      })),
      submissions: submissions  ??  0,
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
    { data: assignments, error: assignmentError },
    { data: submissions, error: submissionError },
    { data: points, error: pointsError },
  ] = await Promise.all([
    supabase
      .from("academy_profiles")
      .select(
        "id, display_name, role, current_course_id, updated_at, academy_courses!academy_profiles_current_course_id_fkey(title, slug)",
      ),
    supabase.from("academy_courses").select("id, published"),
    supabase
      .from("academy_learning_sessions")
      .select("student_id, last_heartbeat_at, active_seconds"),
    supabase
      .from("academy_assignments")
      .select("id, due_at, published")
      .eq("published", true),
    supabase
      .from("academy_submissions")
      .select("id, status, submitted_at"),
    supabase
      .from("academy_leaderboard_points")
      .select("points, verification_status"),
  ]);
  const pendingSubmissions = (submissions  ??  []).filter(
    (submission) => submission.status !== "graded",
  ).length;
  const overdueAssignments = (assignments  ??  []).filter(
    (assignment) =>
      assignment.due_at && new Date(assignment.due_at).getTime() < Date.now(),
  ).length;
  const learningSeconds = (sessions  ??  []).reduce(
    (total, session) => total + Number(session.active_seconds ?? 0),
    0,
  );
  const verifiedPoints = (points  ??  [])
    .filter((point) => point.verification_status === "verified")
    .reduce((total, point) => total + Number(point.points ?? 0), 0);
  return {
    data: {
      students: (profiles  ??  []).filter((profile) => profile.role === "student")
        .length,
      teachers: (profiles  ??  []).filter((profile) => profile.role === "teacher")
        .length,
      courses: courses ?.length  ??  0,
      activeLearners: new Set(
        (sessions  ??  [])
          .filter(
            (session) =>
              Date.now() - new Date(session.last_heartbeat_at).getTime() <
              15 * 60 * 1000,
          )
          .map((session) => session.student_id),
      ).size,
      pendingSubmissions,
      overdueAssignments,
      learningSeconds,
      verifiedPoints,
    },
    error:
      profileError ||
      courseError ||
      sessionError ||
      assignmentError ||
      submissionError ||
      pointsError,
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
    data: { profiles: profiles  ??  [], admins: admins  ??  [] },
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
        "id, display_name, email, role, avatar_url, current_course_id, school_id, state, city, student_level, registration_code_id, updated_at, academy_registration_codes!academy_profiles_registration_code_id_fkey(registration_number, status), academy_courses!academy_profiles_current_course_id_fkey(title, slug), academy_schools!academy_profiles_school_id_fkey(id, name, code, state, city)",
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
  return { data: data  ??  [], error, configured: true };
}

export async function updateAcademyStudentProfile(studentId, updates) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  return supabase
    .from("academy_profiles")
    .update(updates)
    .eq("id", studentId)
    .select(
      "id, display_name, avatar_url, school_id, state, city, student_level, academy_schools!academy_profiles_school_id_fkey(id, name, code, state, city)",
    )
    .single();
}

export async function getAcademyTeacherCourses() {
  if (!supabase) return unavailable([]);
  return withAcademyCache("courses:teacher", 10 * 60 * 1000, async () => {
    const { data, error } = await supabase
      .from("academy_courses")
      .select(
        "id, slug, title, description, duration_weeks, published, subject_id, academy_subjects(name), course_family, is_programming_course",
      )
      .order("title");
    return { data: data ?? [], error, configured: true };
  });
}

export async function getAcademyCourseOptions() {
  if (!supabase) return unavailable({ levels: [], subjects: [] });
  return withAcademyCache("courses:options", 10 * 60 * 1000, async () => {
    const [
      { data: levels, error: levelError },
      { data: subjects, error: subjectError },
    ] = await Promise.all([
      supabase
        .from("academy_courses")
        .select("id, slug, title")
        .eq("is_active", true)
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
  });
}

export async function getAcademyAdminLevels() {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase
    .from("academy_levels")
    .select("id, slug, name, description, sort_order, active")
    .order("sort_order", { ascending: true })
    .order("name");
  return { data: data  ??  [], error, configured: true };
}

export async function saveAcademyLevel(level) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const payload = {
    slug: String(level.slug  ??  "").trim().toLowerCase(),
    name: String(level.name  ??  "").trim(),
    description: String(level.description  ??  "").trim(),
    sort_order: Number(level.sort_order  ??  0),
    active: Boolean(level.active),
  };
  if (!payload.slug || !payload.name) {
    return {
      data: null,
      error: new Error("Level name and slug are required."),
    };
  }
  const query = level.id
     ?  supabase.from("academy_levels").update(payload).eq("id", level.id)
    : supabase.from("academy_levels").insert(payload);
  const { data, error } = await query
    .select("id, slug, name, description, sort_order, active")
    .single();
  return { data, error };
}

export async function getAcademyAdminPractice() {
  if (!supabase) return unavailable({ lessons: [], exercises: [] });
  const [
    { data: lessons, error: lessonError },
    { data: exercises, error: exerciseError },
  ] = await Promise.all([
    supabase
      .from("academy_lessons")
      .select(
        "id, title, slug, lesson_number, sort_order, academy_weeks!inner(id, week_number, course_id)",
      )
      .order("academy_weeks(week_number)")
      .order("sort_order")
      .order("lesson_number"),
    supabase.rpc("academy_staff_exercise_list"),
  ]);
  const orderedLessons = (lessons ?? []).slice().sort(
    (left, right) =>
      (left.academy_weeks?.week_number ?? 0) -
        (right.academy_weeks?.week_number ?? 0) ||
      (left.sort_order ?? 0) - (right.sort_order ?? 0) ||
      (left.lesson_number ?? 0) - (right.lesson_number ?? 0) ||
      left.title.localeCompare(right.title),
  );
  const lessonOrder = new Map(
    orderedLessons.map((lesson, index) => [lesson.id, index]),
  );
  const unplaced = orderedLessons.length;
  const exercisesInOrder = (exercises ?? []).slice().sort((left, right) => {
    const leftOrder = lessonOrder.get(left.lesson_id) ?? unplaced;
    const rightOrder = lessonOrder.get(right.lesson_id) ?? unplaced;
    return (
      leftOrder - rightOrder ||
      (left.sort_order ?? 0) - (right.sort_order ?? 0) ||
      left.title.localeCompare(right.title)
    );
  });
  return {
    data: {
      lessons: orderedLessons,
      exercises: exercisesInOrder.map((exercise) => ({
        ...exercise,
        academy_lessons: exercise.lesson_id
          ? { id: exercise.lesson_id, title: exercise.lesson_title }
          : null,
      })),
    },
    error: lessonError || exerciseError,
    configured: true,
  };
}

export async function getAcademyCoursePreview(courseSlug) {
  if (!supabase) return unavailable(null);
  if (!courseSlug) {
    return {
      data: null,
      error: new Error("A course slug is required."),
      configured: true,
    };
  }

  return withAcademyCache(
    `admin-course-preview:${courseSlug}`,
    5 * 60 * 1000,
    async () => {
      const { data: course, error: courseError } = await supabase
        .from("academy_courses")
        .select("id, slug, title, description, duration_weeks, language")
        .eq("slug", courseSlug)
        .eq("published", true)
        .maybeSingle();
      if (courseError || !course) {
        return { data: null, error: courseError, configured: true };
      }

      const { data: weeks, error: weeksError } = await supabase
        .from("academy_weeks")
        .select(
          "id, week_number, title, description, published, academy_lessons(id, title, slug, lesson_number, sort_order, objectives, content, published, status, release_at)",
        )
        .eq("course_id", course.id)
        .eq("published", true)
        .order("week_number", { ascending: true });
      if (weeksError) {
        return { data: null, error: weeksError, configured: true };
      }

      const visibleWeeks = (weeks ?? [])
        .map((week) => ({
          ...week,
          lessons: (week.academy_lessons ?? [])
            .filter((lesson) => lesson.published && isReleased(lesson))
            .sort(
              (left, right) =>
                (left.sort_order ?? 0) - (right.sort_order ?? 0) ||
                (left.lesson_number ?? 0) - (right.lesson_number ?? 0),
            ),
        }))
        .filter((week) => week.lessons.length > 0);
      const lessonIds = visibleWeeks.flatMap((week) =>
        week.lessons.map((lesson) => lesson.id),
      );

      if (lessonIds.length === 0) {
        return {
          data: { ...course, weeks: visibleWeeks },
          error: null,
          configured: true,
        };
      }

      const [
        { data: exercises, error: exerciseError },
        { data: activities, error: activityError },
      ] = await Promise.all([
        supabase
          .from("academy_exercises")
          .select("id, lesson_id, title, instructions, difficulty, status, release_at")
          .in("lesson_id", lessonIds)
          .eq("published", true)
          .is("practice_session_id", null)
          .order("title", { ascending: true }),
        supabase
          .from("academy_lesson_activities")
          .select("id, lesson_id, ref_id, kind, status, release_at, sort_order")
          .in("lesson_id", lessonIds)
          .eq("kind", "assignment")
          .eq("status", "published")
          .order("sort_order", { ascending: true }),
      ]);
      if (exerciseError || activityError) {
        return {
          data: null,
          error: exerciseError || activityError,
          configured: true,
        };
      }

      const assignmentIds = [
        ...new Set(
          (activities ?? [])
            .map((activity) => activity.ref_id)
            .filter(Boolean),
        ),
      ];
      // ref_id is polymorphic and intentionally has no FK to assignments, so
      // PostgREST cannot embed academy_assignments through this relation.
      const { data: assignments, error: assignmentError } = assignmentIds.length
        ? await supabase
            .from("academy_assignments")
            .select(
              "id, title, instructions, points, due_at, published, is_draft, status, release_at",
            )
            .in("id", assignmentIds)
            .eq("published", true)
        : { data: [], error: null };
      if (assignmentError) {
        return {
          data: null,
          error: assignmentError,
          configured: true,
        };
      }

      const exercisesByLesson = new Map();
      (exercises ?? []).filter(isReleased).forEach((exercise) => {
        const list = exercisesByLesson.get(exercise.lesson_id) ?? [];
        list.push(exercise);
        exercisesByLesson.set(exercise.lesson_id, list);
      });
      const assignmentsById = new Map(
        (assignments ?? []).map((assignment) => [assignment.id, assignment]),
      );
      const assignmentsByLesson = new Map();
      (activities ?? [])
        .filter((activity) => isReleased(activity))
        .forEach((activity) => {
          const assignment = assignmentsById.get(activity.ref_id);
          if (
            !assignment?.published ||
            assignment.is_draft ||
            !isReleased(assignment)
          ) {
            return;
          }
          const list = assignmentsByLesson.get(activity.lesson_id) ?? [];
          list.push(assignment);
          assignmentsByLesson.set(activity.lesson_id, list);
        });

      return {
        data: {
          ...course,
          weeks: visibleWeeks.map((week) => ({
            ...week,
            lessons: week.lessons.map((lesson) => ({
              ...lesson,
              exercises: exercisesByLesson.get(lesson.id) ?? [],
              assignments: assignmentsByLesson.get(lesson.id) ?? [],
            })),
          })),
        },
        error: null,
        configured: true,
      };
    },
  );
}

export async function saveAcademyExercise(exercise) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const splitList = (value) =>
    String(value ?? "")
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  const payload = {
    lesson_id: exercise.lesson_id || null,
    title: String(exercise.title  ??  "").trim(),
    instructions: String(exercise.instructions  ??  "").trim(),
    starter_code: String(exercise.starter_code  ??  "").trim(),
    difficulty: exercise.difficulty || "beginner",
    expected_concepts: splitList(exercise.expected_concepts),
    hints: splitList(exercise.hints),
    explanation: String(exercise.explanation  ??  "").trim() || null,
    tests: exercise.tests  ?  JSON.parse(exercise.tests) : [],
    solution_code: String(exercise.solution_code  ??  "").trim() || null,
    published: Boolean(exercise.published),
  };
  if (!payload.lesson_id || !payload.title || !payload.instructions) {
    return {
      data: null,
      error: new Error("Lesson, title, and instructions are required."),
    };
  }
  const query = exercise.id
     ?  supabase.from("academy_exercises").update(payload).eq("id", exercise.id)
    : supabase.from("academy_exercises").insert(payload);
  const { data, error } = await query
    .select(
      "id, lesson_id, title, instructions, starter_code, difficulty, expected_concepts, hints, explanation",
    )
    .single();
  return { data, error };
}

export async function getAcademyAdminProjects() {
  if (!supabase) return unavailable({ courses: [], projects: [] });
  const [
    { data: courses, error: courseError },
    { data: projects, error: projectError },
  ] = await Promise.all([
    supabase.from("academy_courses").select("id, title").order("title"),
    supabase
      .from("academy_projects")
      .select(
        "id, course_id, title, description, created_at, academy_courses!academy_projects_course_id_fkey(id, title)",
      )
      .order("created_at", { ascending: false }),
  ]);
  return {
    data: { courses: courses  ??  [], projects: projects  ??  [] },
    error: courseError || projectError,
    configured: true,
  };
}

export async function saveAcademyProject(project) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const payload = {
    course_id: project.course_id || null,
    title: String(project.title  ??  "").trim(),
    description: String(project.description  ??  "").trim(),
  };
  if (!payload.course_id || !payload.title) {
    return {
      data: null,
      error: new Error("Course and project title are required."),
    };
  }
  const query = project.id
     ?  supabase.from("academy_projects").update(payload).eq("id", project.id)
    : supabase.from("academy_projects").insert(payload);
  const { data, error } = await query
    .select("id, course_id, title, description")
    .single();
  return { data, error };
}

export async function getAcademyAdminMaterials() {
  if (!supabase) return unavailable({ courses: [], lessons: [], materials: [] });
  const [
    { data: courses, error: courseError },
    { data: lessons, error: lessonError },
    { data: materials, error: materialError },
  ] = await Promise.all([
    supabase.from("academy_courses").select("id, title").order("title"),
    supabase
      .from("academy_lessons")
      .select("id, title, academy_weeks!inner(course_id)")
      .order("title"),
    supabase
      .from("academy_materials")
      .select(
        "id, course_id, lesson_id, title, storage_path, storage_kind, original_filename, mime_type, file_size_bytes, download_count, published, created_at, academy_courses!academy_materials_course_id_fkey(id, title), academy_lessons!academy_materials_lesson_id_fkey(id, title)",
      )
      .order("created_at", { ascending: false }),
  ]);
  return {
    data: { courses: courses  ??  [], lessons: lessons  ??  [], materials: materials  ??  [] },
    error: courseError || lessonError || materialError,
    configured: true,
  };
}

export async function getAcademyCourseMaterials(courseId) {
  if (!supabase) return unavailable([]);
  return withAcademyCache(`materials:${courseId ?? "all"}`, 10 * 60 * 1000, async () => {
    let query = supabase
      .from("academy_materials")
      .select(
        "id, course_id, lesson_id, title, storage_path, storage_kind, original_filename, mime_type, file_size_bytes, created_at, academy_courses!academy_materials_course_id_fkey(title)",
      )
      .eq("published", true)
      .order("created_at", { ascending: false });
    if (courseId) query = query.eq("course_id", courseId);
    const { data, error } = await query;
    return { data: data ?? [], error, configured: true };
  });
}

export async function saveAcademyMaterial(material) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data: authUser, error: userError } = await supabase.auth.getUser();
  if (userError || !authUser ?.user) {
    return {
      data: null,
      error: userError || new Error("Authentication required."),
    };
  }
  const payload = {
    course_id: material.course_id || null,
    lesson_id: material.lesson_id || null,
    title: String(material.title  ??  "").trim(),
    storage_path: String(material.storage_path  ??  "").trim(),
    mime_type: String(material.mime_type  ??  "application/pdf").trim() || "application/pdf",
    file_size_bytes: Number(material.file_size_bytes  ??  0),
    published: Boolean(material.published),
    created_by: authUser.user.id,
  };
  if (!payload.title || !payload.storage_path) {
    return {
      data: null,
      error: new Error("Material title and storage path are required."),
    };
  }
  const query = material.id
     ?  supabase.from("academy_materials").update(payload).eq("id", material.id)
    : supabase.from("academy_materials").insert(payload);
  const { data, error } = await query
    .select(
      "id, course_id, lesson_id, title, storage_path, mime_type, file_size_bytes, published",
    )
    .single();
  if (!error) invalidateAcademyCache("materials:");
  return { data, error };
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
    published: Boolean(course.published),
  };
  const query = course.id
     ?  supabase.from("academy_courses").update(payload).eq("id", course.id)
    : supabase.from("academy_courses").insert(payload);
  const { data, error } = await query
    .select(
      "id, slug, title, description, duration_weeks, published, subject_id",
    )
    .single();
  if (!error) invalidateAcademyCache("courses:", "active-course:", "lessons:", "progress:", "assignments:", "teacher-students");
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
      .select("id, title, duration_weeks, published")
      .order("title"),
    supabase
      .from("academy_weeks")
      .select("id, course_id, week_number, title, description, sort_order, published")
      .order("week_number"),
    supabase
      .from("academy_lessons")
      .select(
        "id, week_id, title, slug, lesson_number, objectives, content, published, sort_order, status, release_at, due_at, points, late_policy, unlock_after_id",
      )
      .order("lesson_number"),
  ]);
  return {
    data: {
      courses: courses  ??  [],
      weeks: weeks  ??  [],
      lessons: lessons  ??  [],
    },
    error: courseError || weekError || lessonError,
    configured: true,
  };
}

export async function saveAcademyWeek(week) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const payload = {
    course_id: week.course_id || null,
    week_number: Number(week.week_number),
    title: String(week.title ?? "").trim(),
    description: String(week.description ?? "").trim() || null,
    sort_order: Number(week.sort_order ?? 0),
    published: Boolean(week.published),
  };
  if (!payload.course_id || !payload.title || payload.week_number < 1) {
    return {
      data: null,
      error: new Error("Course, week number, and title are required."),
    };
  }
  const query = week.id
    ? supabase
        .from("academy_weeks")
        .update(payload)
        .eq("id", week.id)
    : supabase.from("academy_weeks").insert(payload);
  const { data, error } = await query
    .select("id, course_id, week_number, title, description, sort_order, published")
    .single();
  return { data, error };
}

export async function saveAcademyLesson(lesson) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const objectives = Array.isArray(lesson.objectives)
    ? lesson.objectives
    : String(lesson.objectives ?? "")
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean);
  let content = lesson.content;
  if (typeof content === "string") {
    content = content.trim();
    try {
      const parsed = JSON.parse(content);
      content = parsed && typeof parsed === "object" ? parsed : { explanation: content };
    } catch {
      content = { explanation: content };
    }
  }
  const payload = {
    week_id: lesson.week_id || null,
    title: String(lesson.title ?? "").trim(),
    slug: String(lesson.slug ?? "").trim().toLowerCase(),
    lesson_number: Number(lesson.lesson_number),
    objectives,
    content: content || {},
    published: Boolean(lesson.published),
    sort_order: Number(lesson.sort_order ?? 0),
  };
  if (!payload.week_id || !payload.title || !payload.slug) {
    return {
      data: null,
      error: new Error("Week, title, and slug are required."),
    };
  }
  const query = lesson.id
    ? supabase
        .from("academy_lessons")
        .update(payload)
        .eq("id", lesson.id)
    : supabase.from("academy_lessons").insert(payload);
  const { data, error } = await query
    .select("id, week_id, title, slug, lesson_number, published, sort_order")
    .single();
  if (!error) invalidateAcademyCache("lesson:", "lessons:", "progress:", "assignments:");
  return { data, error };
}

export async function publishAcademyWeek(weekId, published) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  if (!weekId) return { data: null, error: new Error("Week is required.") };
  const { data, error } = await supabase
    .from("academy_lessons")
    .update({ published: Boolean(published) })
    .eq("week_id", weekId)
    .select("id, week_id, published");
  if (!error) invalidateAcademyCache("lessons:", "progress:", "assignments:");
  return { data: data ?? [], error };
}

export async function scheduleAcademyLesson(schedule) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data: userResult } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("academy_schedules")
    .insert({
      course_id: schedule.course_id,
      lesson_id: schedule.lesson_id,
      activity_type: "lesson",
      title: schedule.title.trim(),
      description: schedule.description.trim(),
      starts_at: new Date(schedule.starts_at).toISOString(),
      ends_at: schedule.ends_at
         ?  new Date(schedule.ends_at).toISOString()
        : null,
      published: Boolean(schedule.published),
      created_by: userResult.user ?.id,
    })
    .select("id, title, starts_at, published")
    .single();
  return { data, error };
}

async function getAcademyRegistrationCodesDirect(searchText, status) {
  const { data: codes, error } = await supabase
    .from("academy_registration_codes")
    .select(
      "id, registration_number, status, claimed_by, registration_year, serial_number, created_at",
    )
    .order("registration_year", { ascending: false })
    .order("serial_number", { ascending: true });
  if (error) return { data: null, error };

  const claimedIds = [
    ...new Set((codes ?? []).map((code) => code.claimed_by).filter(Boolean)),
  ];
  const profiles = new Map();
  if (claimedIds.length) {
    const { data: profileRows } = await supabase
      .from("academy_profiles")
      .select("id, display_name, current_course_id")
      .in("id", claimedIds);
    (profileRows ?? []).forEach((row) => profiles.set(row.id, row));
  }
  const courseIds = [
    ...new Set(
      [...profiles.values()]
        .map((profile) => profile.current_course_id)
        .filter(Boolean),
    ),
  ];
  const courses = new Map();
  if (courseIds.length) {
    const { data: courseRows } = await supabase
      .from("academy_courses")
      .select("id, title")
      .in("id", courseIds);
    (courseRows ?? []).forEach((row) => courses.set(row.id, row));
  }

  const query = searchText.trim().toLowerCase();
  const rows = (codes ?? [])
    .map((code) => {
      const profile = code.claimed_by ? profiles.get(code.claimed_by) : null;
      return {
        registration_number: code.registration_number,
        status: code.status,
        student_id: code.claimed_by ?? null,
        student_name: profile?.display_name ?? null,
        student_email: null,
        course_title: profile?.current_course_id
          ? (courses.get(profile.current_course_id)?.title ?? null)
          : null,
        created_at: code.created_at,
      };
    })
    .filter((row) => !status || row.status === status)
    .filter(
      (row) =>
        !query ||
        `${row.registration_number} ${row.student_name ?? ""}`
          .toLowerCase()
          .includes(query),
    );
  return { data: rows, error: null };
}

export async function getAcademyRegistrationCodes(searchText = "", status = "") {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase.rpc("academy_admin_registration_list", {
    search_text: searchText.trim() || null,
    status_filter: status || null,
  });
  if (!error) return { data: data ?? [], error: null, configured: true };

  // PostgREST puts the real Postgres reason in `message` and wraps it in
  // `details`, `hint` and `code`. The wrapped form is longer than the friendly
  // error helper will show, so the administrator saw a generic sentence and the
  // actual cause never reached them. Keep the Postgres message.
  const pgMessage = typeof error.message === "string" && error.message.length < 200
    ? error.message
    : String(error?.details ?? error?.message ?? "").slice(0, 200);
  error.message = pgMessage || error.message;

  const message = String(error.message ?? "");
  if (/administrator/i.test(message)) {
    return {
      data: [],
      error: new Error(
        "Your account is not registered as an Academy administrator, so registration numbers cannot be shown. Ask the Academy owner to add your user ID to the administrators list.",
      ),
      configured: true,
    };
  }

  const fallback = await getAcademyRegistrationCodesDirect(searchText, status);
  if (fallback.data) return { ...fallback, configured: true };
  return { data: [], error, configured: true };
}

export async function generateAcademyRegistrationCodes(year, count) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc(
    "academy_generate_registration_codes",
    {
      target_year: Number(year),
      number_to_generate: Number(count),
    },
  );
  return { data: data ?? [], error };
}

export async function assignAcademyRegistrationCode(studentId, registrationNumber) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_assign_registration_code", {
    target_student_id: studentId,
    target_registration_number: registrationNumber.trim().toUpperCase(),
  });
  return { data, error };
}

export async function suspendAcademyRegistrationCode(
  registrationNumber,
  reason,
) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_suspend_registration_code", {
    target_registration_number: registrationNumber.trim().toUpperCase(),
    suspension_reason: reason.trim(),
  });
  return { data, error };
}

export async function reassignAcademyRegistrationCode({
  studentId,
  oldRegistrationNumber,
  newRegistrationNumber,
  reason,
}) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc(
    "academy_reassign_registration_code",
    {
      target_student_id: studentId,
      old_registration_number: oldRegistrationNumber.trim().toUpperCase(),
      new_registration_number: newRegistrationNumber.trim().toUpperCase(),
      reassignment_reason: reason.trim(),
    },
  );
  return { data, error };
}

export async function assignAcademyStudentLevel(studentId, courseId) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_assign_student_course", {
    target_student_id: studentId,
    target_course_id: courseId || null,
  });
  if (!error) {
    invalidateAcademyCache(
      `active-course:${studentId}`,
      `lessons:${studentId}`,
      `progress:${studentId}`,
      `assignments:${studentId}`,
      `overview:${studentId}`,
      "teacher-students",
    );
  }
  return { data, error };
}

export async function startAcademyLearningSession(route) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  return supabase.rpc("academy_start_learning_session", {
    target_route: route,
  });
}

export async function heartbeatAcademyLearningSession(
  sessionId,
  route,
  visibilityState = "visible",
  active = true,
) {
  if (!supabase) return { error: new Error("Academy is not configured.") };

  // A learning session outlives the access token, so the token can be expired by
  // the time a heartbeat fires. getSession refreshes it when it is close to
  // expiry, and lets us skip the call entirely once the user is signed out.
  // Without this the request goes out with a stale token and Supabase answers
  // 401, which the browser logs as a failed resource on every 30 second tick.
  const { data: authData } = await supabase.auth.getSession();
  if (!authData.session) return { data: null, error: null };

  const { data, error } = await supabase.rpc(
    "academy_heartbeat_learning_session",
    {
      p_session_id: sessionId,
      p_route: route,
      p_visibility_state: visibilityState,
      p_active: active,
    },
  );
  return { data, error };
}

export async function getAcademyLessons(studentId) {
  if (!supabase) return unavailable([]);
  return withAcademyCache(`lessons:${studentId}`, 5 * 60 * 1000, async () => {
    const activeCourse = await getActiveCourseForStudent(studentId);
    if (!activeCourse) return { data: [], error: null, configured: true };

    const { data, error } = await supabase
      .from("academy_lessons")
      .select(lessonSelect)
      .eq("published", true)
      .eq("academy_weeks.course_id", activeCourse.id)
      // Week, then the deliberate order within it. lesson_number was used on
      // its own, so anything an administrator reordered was discarded on the
      // next load, which is how a syllabus ends up looking shuffled.
      .order("academy_weeks(week_number)", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("lesson_number", { ascending: true });

    if (error || !studentId) {
      return { data: data ?? [], error, configured: true };
    }

    const { data: progress, error: progressError } = await supabase
      .from("academy_lesson_progress")
      .select("lesson_id, completed_at")
      .eq("student_id", studentId);
    const progressByLesson = new Map(
      (progress ?? []).map((item) => [item.lesson_id, item]),
    );
    const ordered = (data ?? [])
      .slice()
      .sort(
        (a, b) =>
          (a.academy_weeks?.week_number ?? 0) -
            (b.academy_weeks?.week_number ?? 0) ||
          (a.lesson_number ?? 0) - (b.lesson_number ?? 0),
      );
    return {
      data: ordered.map((lesson) => ({
        ...lesson,
        progress: progressByLesson.get(lesson.id) ?? null,
        status: progressByLesson.get(lesson.id)?.completed_at
          ? "completed"
          : progressByLesson.get(lesson.id)?.started_at
            ? "in-progress"
            : lesson.prerequisite_lesson_id &&
                !progressByLesson.get(lesson.prerequisite_lesson_id)?.completed_at
              ? "locked"
              : "available",
      })),
      error: progressError,
      configured: true,
    };
  });
}

export async function getNextAcademyLesson(studentId, completedLessonId) {
  const { data, error } = await getAcademyLessons(studentId);
  if (error) return { data: null, error };
  const currentIndex = (data ?? []).findIndex(
    (lesson) => lesson.id === completedLessonId,
  );
  const nextLesson = (data ?? [])
    .slice(currentIndex + 1)
    .find((lesson) => lesson.status === "available" || lesson.status === "in-progress");
  return { data: nextLesson ?? null, error: null };
}

export async function markLessonStarted(lessonId, studentId) {
  if (!supabase) return { error: new Error("Academy is not configured.") };
  if (!studentId) return { error: new Error("Authentication required.") };
  const { error } = await supabase.rpc("academy_start_lesson", {
    target_lesson_id: lessonId,
  });
  if (!error) invalidateAcademyCache(`lesson:${lessonId}:${studentId}`, `lessons:${studentId}`, `progress:${studentId}`);
  return { error };
}

// Whether the server considers this lesson available to this student right now.
// Asked before a lesson is rendered rather than inferred from the caller's own
// progress rows, because the chain is the server's decision and a client that
// reimplemented it would eventually disagree with it.
//
// On error it returns data: null rather than guessing. The caller decides what
// an unanswered question means; a caller that cannot tell "locked" from "could
// not ask" must not treat the two the same.
export async function isAcademyLessonUnlocked(lessonId, studentId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  if (!studentId) return { data: null, error: new Error("Authentication required.") };
  const { data, error } = await supabase.rpc("academy_lesson_is_unlocked_for_student", {
    p_student_id: studentId,
    p_lesson_id: lessonId,
  });
  if (error) return { data: null, error };
  return { data: Boolean(data), error: null };
}

export async function getAcademyLesson(id, studentId) {
  if (!supabase) return unavailable(null);
  return withAcademyCache(`lesson:${id}:${studentId ?? "anon"}`, 10 * 60 * 1000, async () => {
    const { data, error } = await supabase
      .from("academy_lessons")
      .select(lessonSelect)
      .eq("id", id)
      .eq("published", true)
      .maybeSingle();
    if (error || !data) return { data, error, configured: true };

    const [
      { data: exercises, error: exercisesError },
      { data: subtopics },
      { data: progress },
      { data: activities, error: activitiesError },
      { data: submissions, error: submissionsError },
      { data: exerciseAttempts, error: exerciseAttemptsError },
      { data: latestPracticeSession, error: practiceSessionError },
    ] = await Promise.all([
        supabase
          .from("academy_exercises")
          .select(
            "id, lesson_id, title, instructions, starter_code, difficulty, expected_concepts, hints, explanation, question_type, choices, attempt_limit",
          )
          .eq("lesson_id", id)
          .eq("published", true)
          .is("practice_session_id", null),
        supabase
          .from("academy_lesson_subtopics")
          .select("id, title, concept, explanation, example, ordering")
          .eq("lesson_id", id)
          .eq("published", true)
          .order("ordering"),
        studentId
          ? supabase
              .from("academy_lesson_progress")
              .select("lesson_id, completed_at")
              .eq("lesson_id", id)
              .eq("student_id", studentId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        // The task step of the topic, so the page can show what to submit
        // alongside the practice, and the student's own attempt at it.
        supabase
          .from("academy_lesson_activities")
          .select("id, kind, ref_id, title, points, status, release_at, due_at, sort_order")
          .eq("lesson_id", id)
          .eq("kind", "assignment")
          .eq("status", "published")
          .order("sort_order"),
        studentId
          ? supabase
              .from("academy_submissions")
              .select("id, assignment_id, attempt_number, status, submitted_at, academy_submission_results(final_score, max_score, objective_score, teacher_feedback, ai_feedback, reviewed_at)")
              .eq("student_id", studentId)
              .order("submitted_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        studentId
          ? supabase
              .from("academy_exercise_attempts")
              .select("exercise_id, passed, academy_exercises!inner(lesson_id)")
              .eq("student_id", studentId)
              .eq("academy_exercises.lesson_id", id)
          : Promise.resolve({ data: [] }),
        studentId
          ? supabase
              .from("academy_practice_sessions")
              .select("completed_at")
              .eq("lesson_id", id)
              .eq("student_id", studentId)
              .not("completed_at", "is", null)
              .order("completed_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

    if (
      exercisesError ||
      activitiesError ||
      submissionsError ||
      exerciseAttemptsError ||
      practiceSessionError
    ) {
      return {
        data: null,
        error:
          exercisesError ||
          activitiesError ||
          submissionsError ||
          exerciseAttemptsError ||
          practiceSessionError,
        configured: true,
      };
    }

    const assignmentIds = (activities ?? []).map((activity) => activity.ref_id);
    const { data: assignments, error: assignmentsError } = assignmentIds.length
      ? await supabase
          .from("academy_assignments")
          .select(
            "id, title, instructions, points, due_at, late_policy, retry_limit, allowed_submission_types, allowed_file_types, max_file_size_bytes, status, release_at, published, is_draft",
          )
          .in("id", assignmentIds)
          .eq("published", true)
          .eq("is_draft", false)
          .eq("status", "published")
          .or(`release_at.is.null,release_at.lte.${new Date().toISOString()}`)
      : { data: [], error: null };
    if (assignmentsError) {
      return { data: null, error: assignmentsError, configured: true };
    }

    const assignmentsById = new Map(
      (assignments ?? []).map((assignment) => [assignment.id, assignment]),
    );
    const passedExerciseIds = new Set(
      (exerciseAttempts ?? [])
        .filter((attempt) => attempt.passed > 0)
        .map((attempt) => attempt.exercise_id),
    );

    // Latest attempt per assignment, which is the one the student cares about.
    const latestByAssignment = new Map();
    for (const submission of submissions ?? []) {
      if (
        submission.assignment_id &&
        !latestByAssignment.has(submission.assignment_id)
      ) {
        latestByAssignment.set(submission.assignment_id, submission);
      }
    }

    const tasks = (activities ?? [])
      .map((activity) => {
        const assignment = assignmentsById.get(activity.ref_id);
        if (!assignment) return null;
        return {
          activityId: activity.id,
          assignmentId: assignment.id,
          title: assignment.title,
          instructions: assignment.instructions,
          points: assignment.points,
          dueAt: assignment.due_at,
          latePolicy: assignment.late_policy,
          retryLimit: assignment.retry_limit,
          allowedSubmissionTypes: assignment.allowed_submission_types,
          allowedFileTypes: assignment.allowed_file_types,
          maxFileSizeBytes: assignment.max_file_size_bytes,
          submission: latestByAssignment.get(assignment.id) ?? null,
        };
      })
      .filter(Boolean);

    return {
      data: {
        ...data,
        tasks,
        practiceSessionCompleted: Boolean(latestPracticeSession?.completed_at),
        exercises: (exercises ?? []).map((exercise) => ({
          ...exercise,
          completed: passedExerciseIds.has(exercise.id),
        })),
        subtopics: subtopics ?? [],
        progress: progress ?? null,
      },
      error,
      configured: true,
    };
  });
}

export async function markLessonComplete(lessonId, studentId) {
  if (!supabase) return { error: new Error("Academy is not configured.") };
  if (!studentId) return { error: new Error("Authentication required.") };
  const { error } = await supabase.rpc("academy_complete_lesson", {
    target_lesson_id: lessonId,
  });
  if (!error) {
    invalidateAcademyCache(
      `lesson:${lessonId}:${studentId}`,
      `lessons:${studentId}`,
      `progress:${studentId}`,
      `overview:${studentId}`,
      "leaderboard:",
    );
  }
  return { error };
}

export async function getAcademyAssignments(studentId) {
  if (!supabase) return unavailable([]);
  if (!studentId) return { data: [], error: null, configured: true };
  return withAcademyCache(`assignments:${studentId}`, 2 * 60 * 1000, async () => {
    const activeCourse = await getActiveCourseForStudent(studentId);
    if (!activeCourse) return { data: [], error: null, configured: true };
    const [
      { data: assignments, error: assignmentError },
      { data: submissions, error: submissionError },
    ] = await Promise.all([
      supabase
        .from("academy_assignments")
        .select(
          "id, course_id, lesson_id, title, due_at, points, retry_limit, published, created_at",
        )
        .eq("is_draft", false)
        .eq("published", true)
        .eq("course_id", activeCourse.id)
        .or(`release_at.is.null,release_at.lte.${new Date().toISOString()}`)
        .order("due_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("academy_submissions")
        .select("assignment_id")
        .eq("student_id", studentId),
    ]);
    const error = assignmentError || submissionError;
    if (error) return { data: [], error, configured: true };

    const submittedAssignmentIds = new Set(
      (submissions ?? []).map((submission) => submission.assignment_id),
    );
    return {
      data: (assignments ?? []).filter(
        (assignment) => !submittedAssignmentIds.has(assignment.id),
      ),
      error: null,
      configured: true,
    };
  });
}

export async function getAcademyExercises(studentId, practiceSessionId = null) {
  if (!supabase) return unavailable([]);
  if (!studentId) return { data: [], error: null, configured: true };
  const activeCourse = await getActiveCourseForStudent(studentId);
  if (!activeCourse) return { data: [], error: null, configured: true };
  let query = supabase
    .from("academy_exercises")
    .select(
      "id, lesson_id, title, instructions, starter_code, difficulty, expected_concepts, hints, explanation, question_type, choices, attempt_limit, practice_question_number, academy_lessons!inner(title, published, academy_weeks!inner(academy_courses!inner(id, slug, title, language)))",
    )
    .eq("published", true)
    .eq("academy_lessons.published", true)
    .eq("academy_lessons.academy_weeks.course_id", activeCourse.id);
  query = practiceSessionId
    ? query.eq("practice_session_id", practiceSessionId).order(
        "practice_question_number",
        { ascending: true },
      )
    : query.is("practice_session_id", null).order("title");
  const { data, error } = await query;
  return {
    // The runtime comes from academy_courses.language, not from comparing a
    // course slug, so adding a course in a new language needs no code change.
    data: (data ?? []).map((exercise) => ({
      ...exercise,
      language:
        exercise.academy_lessons?.academy_weeks?.academy_courses?.language ??
        "python",
    })),
    error,
    configured: true,
  };
}

export async function generateAcademyPracticeSession(lessonId, sessionId) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.functions.invoke(
    "academy-generate-practice",
    { body: { lesson_id: lessonId, session_id: sessionId } },
  );
  if (error) return { data: null, error: await friendlyFunctionError(error) };
  if (!data || data.session_id !== sessionId) {
    return {
      data: null,
      error: new Error("The generated practice session could not be verified."),
    };
  }
  return { data, error: null };
}

export async function submitObjectiveAnswer(
  exerciseId,
  answer,
  clientOperationId,
) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const args = {
    target_exercise_id: exerciseId,
    submitted_answer: answer,
    client_operation_key: clientOperationId,
  };
  const { data, error } = await supabase.rpc(
    "academy_submit_objective_answer",
    args,
  );
  if (!error) invalidateAcademyCache("leaderboard:", "lesson:");
  return { data, error };
}

export async function getAcademyAssignment(id, studentId = null) {
  if (!supabase) return unavailable(null);
  const activeCourse = studentId
    ? await getActiveCourseForStudent(studentId)
    : null;
  if (studentId && !activeCourse) {
    return { data: null, error: null, configured: true };
  }
  let query = supabase
    .from("academy_assignments")
    .select(
      // academy_courses!inner because the page has to know which language the
      // assignment is written in before it can offer the right editor, and a
      // half-fetched assignment must not silently fall back to Python.
      "id, course_id, lesson_id, title, instructions, due_at, points, allowed_submission_types, starter_code, hints, retry_limit, published, is_draft, created_at, academy_courses!academy_assignments_course_id_fkey!inner(id, slug, title, language)",
    )
    .eq("id", id)
    .eq("is_draft", false);
  if (activeCourse) query = query.eq("course_id", activeCourse.id);
  const { data, error } = await query.maybeSingle();
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
  return { count: count  ??  0, error };
}

export async function getAcademySubmissionHistory(assignmentId, studentId) {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase
    .from("academy_submissions")
    .select(
      "id, attempt_number, status, grading_error, submitted_at, original_filename, academy_submission_results(id, objective_score, objective_status, final_score, passed_tests, failed_tests, tests_total, ai_feedback_status, ai_feedback, rubric_feedback, teacher_feedback, updated_at)",
    )
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .order("attempt_number", { ascending: false });
  return { data: data  ??  [], error, configured: true };
}

export async function getAcademyTeacherSubmissions() {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase
    .from("academy_submissions")
    .select(
      "id, assignment_id, student_id, attempt_number, status, grading_error, original_filename, submitted_at, source_code, academy_assignments(title, points), academy_submission_results(objective_score, objective_status, final_score, passed_tests, failed_tests, tests_total, ai_feedback_status, ai_feedback, rubric_feedback, teacher_feedback)",
    )
    .order("submitted_at", { ascending: false });
  const rows = data ?? [];
  const names = await getAcademyProfileNames(
    rows.map((row) => row.student_id),
  );
  return {
    data: rows.map((row) => ({
      ...row,
      academy_profiles: names.has(row.student_id)
        ? { display_name: names.get(row.student_id) }
        : null,
    })),
    error,
    configured: true,
  };
}

export async function getAcademyTeacherAssignments() {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase
    .from("academy_assignments")
    .select(
      "id, course_id, week_id, lesson_id, title, instructions, due_at, points, retry_limit, published, is_draft, ai_feedback_enabled, academy_courses!academy_assignments_course_id_fkey(title)",
    )
    .order("course_id")
    .order("week_id", { ascending: true, nullsFirst: true })
    .order("due_at", { ascending: true, nullsFirst: true })
    .order("title");
  return { data: data ?? [], error, configured: true };
}

async function getAcademyProfileNames(userIds) {
  const ids = [...new Set((userIds ?? []).filter(Boolean))];
  if (!ids.length || !supabase) return new Map();
  const { data } = await supabase
    .from("academy_profiles")
    .select("id, display_name")
    .in("id", ids);
  return new Map((data ?? []).map((profile) => [profile.id, profile.display_name]));
}

export async function getAcademyTeacherClasses() {
  if (!supabase) return unavailable([]);
  const { data, error } = await supabase
    .from("academy_classes")
    .select(
      "id, name, description, course_id, academy_courses(title), academy_class_members(student_id, status)",
    )
    .order("name");
  const rows = data ?? [];
  const names = await getAcademyProfileNames(
    rows.flatMap((row) =>
      (row.academy_class_members ?? []).map((member) => member.student_id),
    ),
  );
  return {
    data: rows.map((row) => ({
      ...row,
      academy_class_members: (row.academy_class_members ?? []).map((member) => ({
        ...member,
        academy_profiles: names.has(member.student_id)
          ? { display_name: names.get(member.student_id) }
          : null,
      })),
    })),
    error,
    configured: true,
  };
}

export async function saveAcademyClass(classroom) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };

  const courseId = classroom.course_id;
  const name = String(classroom.name ?? "").replace(/\s+/g, " ").trim();
  const description = String(classroom.description ?? "").trim();
  if (!courseId || !name) {
    return {
      data: null,
      error: new Error("Course and class name are required."),
    };
  }

  const { data: existingClasses, error: duplicateError } = await supabase
    .from("academy_classes")
    .select("id, name")
    .eq("course_id", courseId);
  if (duplicateError) return { data: null, error: duplicateError };

  const duplicate = (existingClasses ?? []).some((row) => {
    const existingName = String(row.name ?? "").replace(/\s+/g, " ").trim();
    return (
      existingName.toLowerCase() === name.toLowerCase() &&
      (!classroom.id || row.id !== classroom.id)
    );
  });

  if (duplicate) {
    return {
      data: null,
      error: new Error("A class with this name already exists in this course."),
    };
  }

  const { data: userResult } = await supabase.auth.getUser();
  const payload = {
    course_id: courseId,
    name,
    description,
    created_by: userResult.user?.id,
  };
  const query = classroom.id
     ?  supabase.from("academy_classes").update(payload).eq("id", classroom.id)
    : supabase.from("academy_classes").insert(payload);
  return query.select("id, name, description, course_id").single();
}

export async function saveAcademyAssignment(assignment) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data: userResult } = await supabase.auth.getUser();
  let automatedTests = null;
  try {
    automatedTests =
      typeof assignment.automated_tests === "string"
         ?  JSON.parse(assignment.automated_tests)
        : assignment.automated_tests  ??  null;
  } catch {
    return { data: null, error: new Error("Deterministic tests must be valid JSON.") };
  }
  const payload = {
    course_id: assignment.course_id,
    title: assignment.title.trim(),
    instructions: assignment.instructions.trim(),
    points: Number(assignment.points),
    retry_limit: Number(assignment.retry_limit),
    published: Boolean(assignment.published),
    is_draft: !assignment.published,
    ai_feedback_enabled: Boolean(assignment.ai_feedback_enabled),
    automated_tests: automatedTests,
    created_by: userResult.user ?.id,
  };
  const query = assignment.id
     ?  supabase
        .from("academy_assignments")
        .update(payload)
        .eq("id", assignment.id)
    : supabase.from("academy_assignments").insert(payload);
  const { data, error } = await query
    .select("id, title, published, retry_limit, points")
    .single();
  return { data, error };
}

export async function gradeAcademySubmission({
  submissionId,
  objectiveScore,
  finalScore,
  teacherFeedback,
  aiFeedback,
  aiFeedbackStatus = "disabled",
}) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_grade_submission", {
    target_submission_id: submissionId,
    target_objective_score: objectiveScore,
    target_final_score: finalScore  ??  objectiveScore,
    target_teacher_feedback: teacherFeedback || null,
    target_ai_feedback: aiFeedback || null,
    target_ai_feedback_status: aiFeedbackStatus,
  });
  if (!error) invalidateAcademyCache("leaderboard:");
  return { data, error };
}

export async function requestAcademyAiFeedback(
  submissionId,
  deterministicFeedback = null,
) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.functions.invoke(
    "academy-ai-feedback",
    {
      body: {
        submission_id: submissionId,
        deterministic_feedback: deterministicFeedback,
      },
    },
  );
  return { data, error };
}

export async function submitAssignment({
  assignmentId,
  studentId,
  sourceCode = null,
  filePath = null,
  originalFilename = null,
  mimeType = null,
  fileSizeBytes = null,
  clientOperationId = null,
}) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const operationId = clientOperationId || createClientOperationId();
  // The database validates the size, the file type and the attempt count. The
  // browser check is a courtesy that saves the student a wasted upload, not a
  // control, so the same rules are enforced again on the way in.
  const { data, error } = await supabase.rpc("academy_register_submission", {
    p_assignment_id: assignmentId,
    p_source_code: sourceCode,
    p_file_path: filePath,
    p_original_filename: originalFilename,
    p_mime_type: mimeType,
    p_file_size_bytes: fileSizeBytes,
    p_client_operation_id: operationId,
  });
  if (!error) {
    invalidateAcademyCache(
      "lesson:",
      `progress:${studentId}`,
      `assignments:${studentId}`,
      `overview:${studentId}`,
      "leaderboard:",
    );
  }
  return { data, error };
}

export async function requestAcademyDeterministicGrading(submissionId) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.functions.invoke(
    "academy-grade-submission",
    { body: { submission_id: submissionId } },
  );
  return { data, error };
}

export async function getAcademyProgress(studentId) {
  if (!supabase) return { data: null, error: null, configured: false };
  if (!studentId) return { data: null, error: null, configured: true };
  return withAcademyCache(`progress:${studentId}`, 60 * 1000, async () => {
    const [activeCourse, lessonResult, submissionResult] = await Promise.all([
      getActiveCourseForStudent(studentId),
      getAcademyLessons(studentId),
      supabase
        .from("academy_submissions")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId),
    ]);
    const lessons = lessonResult.data ?? [];
    const completedLessonIds = new Set(
      lessons
        .filter((lesson) => lesson.progress?.completed_at)
        .map((lesson) => lesson.id),
    );
    const lessonCount = lessons.length;
    const completedLessons = completedLessonIds.size;
    const currentWeek = lessons.reduce(
      (week, lesson) =>
        completedLessonIds.has(lesson.id)
          ? Math.max(week, lesson.academy_weeks?.week_number ?? 0)
          : week,
      0,
    );

    return {
      data: {
        lessonCount,
        completedLessons,
        completionPercent: lessonCount
          ? Math.round((completedLessons / lessonCount) * 100)
          : 0,
        currentWeek: Math.min(
          currentWeek + 1,
          activeCourse?.duration_weeks ?? Number.POSITIVE_INFINITY,
        ),
        submissions: submissionResult.count ?? 0,
        activeCourse: activeCourse ?? null,
      },
      error: lessonResult.error ?? submissionResult.error,
      configured: true,
    };
  });
}


// Registration numbers are now issued automatically when a student signs up, as
// a provisional number an administrator then accepts. These are the actions for
// that lifecycle.

export async function acceptAcademyRegistration(studentId) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_accept_registration", {
    p_student_id: studentId,
  });
  return { data, error };
}

export async function withdrawAcademyRegistration(studentId) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_void_registration", {
    p_student_id: studentId,
  });
  return { data, error };
}

export async function editAcademyRegistrationNumber(
  registrationCodeId,
  newSerial,
) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc(
    "academy_edit_registration_number",
    {
      p_registration_code_id: registrationCodeId,
      p_new_serial: Number(newSerial),
    },
  );
  return { data, error };
}

// Only unused numbers can be deleted. An issued number must be withdrawn, which
// keeps its serial so it can never be reissued to another student.
export async function deleteUnusedAcademyRegistration(registrationCodeId) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc(
    "academy_delete_registration_code",
    { p_registration_code_id: registrationCodeId },
  );
  return { data, error };
}

export async function getMyAcademyRegistration() {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_my_registration");
  return { data, error };
}

// Course material files live in a private Supabase Storage bucket, so an
// administrator can upload or replace a PDF without a code edit and redeploy.
// Materials that are committed to the repository are served by the static host
// instead and are marked storage_kind 'static', so the two coexist.

const MATERIAL_BUCKET = "course-materials";
const MATERIAL_MAX_BYTES = 25 * 1024 * 1024;

function materialExtension(name) {
  return `.${String(name ?? "").split(".").pop()?.toLowerCase() ?? ""}`;
}

// Storage rejects anything outside the bucket's allow list, and it matches on
// the content type the request carries. The browser's own type for a PDF is not
// reliable: Windows and some Linux desktops report application/octet-stream, an
// empty string, or application/x-pdf, and all of those are refused. Deriving it
// from the extension the validation already approved means an upload succeeds
// whatever the operating system claims the file is.
const MATERIAL_CONTENT_TYPES = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".zip": "application/zip",
};

function materialContentType(extension) {
  return MATERIAL_CONTENT_TYPES[extension] ?? "application/octet-stream";
}

export function validateAcademyMaterialFile(file) {
  if (!file) return { valid: false, error: "Choose a file first." };
  const extension = materialExtension(file.name);
  const allowed = [
    ".pdf",
    ".docx",
    ".txt",
    ".md",
    ".png",
    ".jpg",
    ".jpeg",
    ".zip",
  ];
  if (!allowed.includes(extension))
    return {
      valid: false,
      error: "Course materials must be a PDF, Word document, text file, image or zip.",
    };
  if (file.size > MATERIAL_MAX_BYTES)
    return {
      valid: false,
      error: "Materials must be 25 MB or smaller.",
    };
  if (file.size === 0) return { valid: false, error: "That file is empty." };
  return { valid: true, extension };
}

function materialObjectPath(file, materialId) {
  // Random rather than derived from the title, so a signed URL cannot be
  // guessed from a lesson name.
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  const safeName = String(file.name).replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${materialId ?? "new"}/${random}-${safeName}`;
}

async function uploadMaterialObject(file, materialId) {
  const path = materialObjectPath(file, materialId);
  const { error } = await supabase.storage
    .from(MATERIAL_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      // Set explicitly rather than inferred from the File, because the bucket
      // enforces it and an OS that calls a PDF "octet-stream" would be refused.
      contentType: materialContentType(materialExtension(file.name)),
    });
  if (error) return { data: null, error };
  return { data: { path }, error: null };
}

export async function uploadAcademyMaterial({ file, ...details }) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const check = validateAcademyMaterialFile(file);
  if (!check.valid) return { data: null, error: new Error(check.error) };

  const uploaded = await uploadMaterialObject(file, null);
  if (uploaded.error) return { data: null, error: uploaded.error };

  const { data, error } = await supabase.rpc("academy_register_material_file", {
    p_course_id: details.course_id || null,
    p_lesson_id: details.lesson_id || null,
    p_title: String(details.title ?? "").trim(),
    p_storage_path: uploaded.data.path,
    p_mime_type: materialContentType(materialExtension(file.name)),
    p_file_size_bytes: file.size,
    p_published: Boolean(details.published),
    p_material_id: null,
  });

  // Do not leave an orphan in the bucket if the row could not be created.
  if (error) {
    await supabase.storage.from(MATERIAL_BUCKET).remove([uploaded.data.path]);
    return { data: null, error };
  }
  return { data, error: null };
}

// Replaces the file on an existing material and keeps the material id, so any
// link a student already has keeps working. The previous file is removed only
// after the new row has committed, so a failed upload leaves the old file in
// place and the material still readable.
export async function replaceAcademyMaterialFile(materialId, file) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const check = validateAcademyMaterialFile(file);
  if (!check.valid) return { data: null, error: new Error(check.error) };

  const { data: current, error: readError } = await supabase
    .from("academy_materials")
    .select("id, storage_path, storage_kind, title, course_id, lesson_id, published")
    .eq("id", materialId)
    .maybeSingle();
  if (readError) return { data: null, error: readError };
  if (!current)
    return { data: null, error: new Error("That material no longer exists.") };

  const uploaded = await uploadMaterialObject(file, materialId);
  if (uploaded.error) return { data: null, error: uploaded.error };

  const { data, error } = await supabase.rpc("academy_register_material_file", {
    p_course_id: current.course_id,
    p_lesson_id: current.lesson_id,
    p_title: current.title,
    p_storage_path: uploaded.data.path,
    p_mime_type: materialContentType(materialExtension(file.name)),
    p_file_size_bytes: file.size,
    p_published: current.published,
    p_material_id: materialId,
  });

  if (error) {
    await supabase.storage.from(MATERIAL_BUCKET).remove([uploaded.data.path]);
    return { data: null, error };
  }

  // Only now is the previous file unreferenced.
  if (current.storage_kind === "storage" && current.storage_path) {
    await supabase.storage
      .from(MATERIAL_BUCKET)
      .remove([current.storage_path]);
  }
  return { data, error: null };
}

export async function deleteAcademyMaterial(materialId) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data: current, error: readError } = await supabase
    .from("academy_materials")
    .select("id, storage_path, storage_kind")
    .eq("id", materialId)
    .maybeSingle();
  if (readError) return { data: null, error: readError };
  if (!current)
    return { data: null, error: new Error("That material no longer exists.") };

  const { data, error } = await supabase.rpc("academy_delete_material", {
    p_material_id: materialId,
  });
  if (error) return { data: null, error };

  if (current.storage_kind === "storage" && current.storage_path) {
    await supabase.storage
      .from(MATERIAL_BUCKET)
      .remove([current.storage_path]);
  }
  return { data, error: null };
}

// An hour is plenty for opening one file. A downloaded copy that is meant to
// work with no connection needs longer, because the URL is what was cached and
// it stops working when it expires. Seven days is a week of offline study, and
// the student is told to reconnect to refresh it rather than being surprised.
const MATERIAL_URL_TTL_SECONDS = 60 * 60;
const MATERIAL_OFFLINE_TTL_SECONDS = 60 * 60 * 24 * 7;

// Returns { url } for every kind of material, because two callers were reading
// `.url` and one of them got undefined.
//
// The important part is that an uploaded file must go through a signed URL. The
// course-materials bucket is private, and the object key is not a path on the
// app's origin, so building one and using it as a link hands the browser a URL
// that 404s into the single-page app's fallback. What a student downloaded in
// place of their multi-megabyte PDF was a few kilobytes of index.html. There is
// no size cap anywhere that could have produced that, and the upload itself was
// always fine.
export async function getAcademyMaterialUrl(material, { offline = false } = {}) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  if (material.storage_kind !== "storage") {
    // Committed to the repository and served from the app, so a plain path is
    // correct for these and needs no signature.
    return { data: { url: `/${String(material.storage_path).replace(/^\//, "")}` }, error: null };
  }
  const { data, error } = await supabase.storage
    .from(MATERIAL_BUCKET)
    .createSignedUrl(
      material.storage_path,
      offline ? MATERIAL_OFFLINE_TTL_SECONDS : MATERIAL_URL_TTL_SECONDS,
    );
  if (error) return { data: null, error };
  // Supabase calls it signedUrl. Returning the raw object is why the admin
  // Open button passed undefined to window.open and showed a blank tab.
  return { data: { url: data?.signedUrl ?? null, path: data?.path ?? null }, error: null };
}

export async function recordAcademyMaterialDownload(materialId) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  if (!materialId)
    return { data: null, error: new Error("A material is required.") };
  const { data, error } = await supabase.rpc(
    "academy_record_material_download",
    { p_material_id: materialId },
  );
  return { data, error };
}

// Administrator account management. Deleting or editing an account needs the
// service role, which must never reach the browser, so it goes through the
// academy-admin-manage-user Edge Function rather than a direct write.

export async function adminUpdateAcademyUser(targetUserId, changes) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.functions.invoke(
    "academy-admin-manage-user",
    { body: { action: "update", target_user_id: targetUserId, ...changes } },
  );
  if (error) return { data: null, error: await friendlyFunctionError(error) };
  return { data, error: null };
}

export async function adminDeleteAcademyUser(targetUserId, reason) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.functions.invoke(
    "academy-admin-manage-user",
    {
      body: {
        action: "delete",
        target_user_id: targetUserId,
        reason: String(reason ?? "").trim(),
      },
    },
  );
  if (error) return { data: null, error: await friendlyFunctionError(error) };
  return { data, error: null };
}

// A deleted account frees the address again, so a student who was removed can
// register afresh. Checked through the edge function because only the service
// role can read the auth table authoritatively.
export async function adminCheckAcademyEmail(email) {
  if (!supabase)
    return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.functions.invoke(
    "academy-admin-manage-user",
    { body: { action: "check_email", email: String(email ?? "").trim() } },
  );
  if (error) return { data: null, error: await friendlyFunctionError(error) };
  return { data, error: null };
}

async function friendlyFunctionError(error) {
  // Edge functions return their message inside the response context rather than
  // as the error, so surface the real reason instead of "Edge Function Error".
  if (!error) {
    return new Error("The request could not be completed.");
  }
  const context = error?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      return new Error(body?.error ?? "The request could not be completed.");
    } catch {
      return error instanceof Error ? error : new Error(String(error));
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}

// Course reviews and ratings. A student can write one review per course, edit
// their own, and take it back. Everyone else sees it appear without a reload,
// because the table is in the realtime publication and the RLS policies allow
// any signed in user to read.

export async function getAcademyCourseRatingSummaries() {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_course_rating_summary");
  return { data: data ?? [], error };
}

export async function getAcademyCourseReviews(courseId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase
    .from("academy_course_reviews")
    .select(
      "id, course_id, user_id, rating, body, created_at, updated_at, academy_profiles!academy_course_reviews_user_id_fkey(display_name)",
    )
    .eq("course_id", courseId)
    .order("updated_at", { ascending: false })
    .limit(100);
  return { data: data ?? [], error };
}

// Upsert rather than insert, so an edit and a retried offline write are the
// same call. The unique index on (course_id, user_id) is what makes that safe.
export async function saveAcademyCourseReview({ courseId, rating, body }) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult?.user)
    return { data: null, error: userError || new Error("Authentication required.") };

  const value = Number(rating);
  if (!Number.isInteger(value) || value < 1 || value > 5)
    return { data: null, error: new Error("Choose a rating from 1 to 5.") };

  const { data, error } = await supabase
    .from("academy_course_reviews")
    .upsert(
      {
        course_id: courseId,
        user_id: userResult.user.id,
        rating: value,
        body: String(body ?? "").trim().slice(0, 2000),
      },
      { onConflict: "course_id,user_id" },
    );
  return { data, error };
}

export async function deleteAcademyCourseReview(courseId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase
    .from("academy_course_reviews")
    .delete()
    .eq("course_id", courseId);
  return { data, error };
}

// ---------------------------------------------------------------------------
// Assessment engine: question bank
//
// The bank is staff only at the row level, so a student cannot read the answer
// key. These calls are therefore for teachers, and every one of them is a
// security definer function rather than a direct table read.
// ---------------------------------------------------------------------------

export async function getAcademyExamSubjects() {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase
    .from("academy_subjects")
    .select("id, slug, name, active")
    .eq("active", true)
    .order("name");
  return { data: data ?? [], error };
}

// Paginated rather than loading the whole bank, because the bank is only going
// to grow and a teacher does not need every question in the browser at once.
export async function getAcademyExamQuestions({
  subjectId = "",
  difficulty = "",
  questionType = "",
  search = "",
  page = 0,
  pageSize = 25,
} = {}) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  let query = supabase
    .from("academy_exam_questions")
    .select(
      "id, subject_id, topic, difficulty, question_type, prompt, options, correct_key, marks, status, created_at, academy_subjects(name)",
      { count: "exact" },
    )
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (subjectId) query = query.eq("subject_id", subjectId);
  if (difficulty) query = query.eq("difficulty", difficulty);
  if (questionType) query = query.eq("question_type", questionType);
  if (search.trim()) query = query.ilike("prompt", `%${search.trim()}%`);

  const { data, error, count } = await query;
  return { data: data ?? [], error, total: count ?? 0 };
}

export async function getAcademyExamQuestion(questionId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase
    .from("academy_exam_questions")
    .select("id, subject_id, topic, difficulty, question_type, prompt, options, correct_key, explanation, marks, status")
    .eq("id", questionId)
    .maybeSingle();
  return { data, error };
}

export async function saveAcademyExamQuestion(question) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const options = Array.isArray(question.options)
    ? question.options
        .filter((option) => option?.label)
        .map((option, index) => ({
          key: option.key || String.fromCharCode(65 + index),
          label: String(option.label).trim(),
        }))
    : [];

  const payload = {
    subject_id: question.subject_id,
    topic: String(question.topic ?? "").trim(),
    difficulty: question.difficulty,
    question_type: question.question_type,
    prompt: String(question.prompt ?? "").trim(),
    options,
    correct_key: question.correct_key,
    marks: Number(question.marks) || 1,
    status: question.status || "active",
  };
  if (question.id) {
    const { data, error } = await supabase
      .from("academy_exam_questions")
      .update(payload)
      .eq("id", question.id)
      .select()
      .single();
    return { data, error };
  }
  const { data, error } = await supabase
    .from("academy_exam_questions")
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

// Archived rather than deleted. A question that has already sat in an exam must
// not disappear from the record, and its fingerprint has to stay spent so it is
// not reimported as new.
export async function archiveAcademyExamQuestion(questionId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase
    .from("academy_exam_questions")
    .update({ status: "archived" })
    .eq("id", questionId)
    .select("id")
    .single();
  return { data, error };
}

// Dry run. The teacher sees every row, what is wrong with it, and imports
// nothing yet, which is section 3.
export async function previewAcademyExamCsvImport(csv, { subjectId = null, allowDuplicates = false } = {}) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_preview_csv", {
    p_csv: csv,
    p_default_subject_id: subjectId || null,
    p_allow_duplicates: allowDuplicates,
  });
  return { data: data ?? [], error };
}

export async function importAcademyExamCsv(
  csv,
  { subjectId = null, allowDuplicates = false, onlyValid = true } = {},
) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_import_csv", {
    p_csv: csv,
    p_default_subject_id: subjectId || null,
    p_allow_duplicates: allowDuplicates,
    p_import_only_valid: onlyValid,
  });
  const row = Array.isArray(data) ? data[0] : null;
  return {
    data: {
      imported: row?.imported ?? 0,
      skipped: row?.skipped ?? 0,
      problems: row?.problems ?? [],
    },
    error,
  };
}

// The template a teacher downloads, with the exact headers the importer expects
// and two worked examples, one of each type.
export function academyExamCsvTemplate() {
  const rows = [
    [
      "question",
      "type",
      "option_a",
      "option_b",
      "option_c",
      "option_d",
      "correct_answer",
      "marks",
      "subject",
      "topic",
      "difficulty",
    ],
    [
      "What is 2 + 2?",
      "mcq",
      "3",
      "4",
      "5",
      "6",
      "B",
      "1",
      "Python",
      "Arithmetic",
      "easy",
    ],
    [
      "Python lists are mutable.",
      "true_false",
      "True",
      "False",
      "",
      "",
      "True",
      "1",
      "Python",
      "Introduction",
      "easy",
    ],
  ];
  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

// ---------------------------------------------------------------------------
// Assessment engine: exam builder
//
// Every one of these is a security definer function, because the exam snapshot
// holds the correct answers and a teacher must not be able to read it with a
// plain select either.
// ---------------------------------------------------------------------------

export async function getAcademyExams() {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase
    .from("academy_exams")
    .select(
      "id, title, subject_id, class_id, level_id, instructions, duration_minutes, starts_at, ends_at, pass_mark, randomize_questions, randomize_options, allow_review, allow_early_submit, max_attempts, results_release_mode, results_published, status, academy_subjects(name), academy_classes(name)",
    )
    .order("starts_at", { ascending: false });
  return { data: data ?? [], error };
}

export async function createAcademyExam(details) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_create", {
    p_title: details.title,
    p_subject_id: details.subject_id || null,
    p_class_id: details.class_id || null,
    p_level_id: details.level_id || null,
    p_instructions: details.instructions ?? "",
    // Per exam, because a Python paper and a Robotics paper are not the same
    // length. Never a global default.
    p_duration_minutes: Number(details.duration_minutes) || 20,
    p_starts_at: details.starts_at
      ? new Date(details.starts_at).toISOString()
      : null,
    p_ends_at: details.ends_at
      ? new Date(details.ends_at).toISOString()
      : null,
    p_pass_mark: details.pass_mark === "" || details.pass_mark == null
      ? null
      : Number(details.pass_mark),
    p_randomize_questions: Boolean(details.randomize_questions),
    p_randomize_options: Boolean(details.randomize_options),
    p_allow_review: details.allow_allow_review ?? true,
    p_allow_early_submit: Boolean(details.allow_early_submit),
    p_max_attempts: Number(details.max_attempts) || 1,
    p_results_release_mode: details.results_release_mode || "manual",
  });
  return { data, error };
}

export async function getAcademyExamQuestionsInExam(examId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_paper_preview", {
    p_exam_id: examId,
  });
  return { data: data ?? [], error };
}

export async function addAcademyExamQuestion(examId, questionId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_add_question", {
    p_exam_id: examId,
    p_question_id: questionId,
  });
  return { data, error };
}

export async function removeAcademyExamQuestion(examId, questionId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_remove_question", {
    p_exam_id: examId,
    p_question_id: questionId,
  });
  return { data, error };
}

// The mix is a specification, not a single number: ask for five easy, four medium
// and one hard, or twenty five mcq and five true/false.
export async function fillAcademyExamFromMix(examId, mix) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_fill_from_mix", {
    p_exam_id: examId,
    p_difficulty_counts: mix.difficulties,
    p_type_counts: mix.types ?? null,
    p_subject_id: mix.subject_id || null,
    p_topic: mix.topic || null,
  });
  const row = Array.isArray(data) ? data[0] : null;
  return {
    data: { added: row?.added ?? 0, short_by: row?.short_by ?? null },
    error,
  };
}

export async function publishAcademyExam(examId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_publish", {
    p_exam_id: examId,
  });
  return { data, error };
}

export async function validateAcademyExam(examId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_validate", {
    p_exam_id: examId,
  });
  return { data: data ?? [], error };
}

// ---------------------------------------------------------------------------
// Assessment engine: the student runner
//
// The timer is never authoritative here. The server computes deadline_at when
// the attempt is created and hands it over, and this only counts down from it.
// A student changing their computer clock changes nothing, because the backend
// refuses an answer that arrives after the deadline regardless of what the
// browser believes.
// ---------------------------------------------------------------------------

export async function getAcademyAvailableExams() {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase
    .from("academy_exams")
    .select(
      "id, title, instructions, duration_minutes, starts_at, ends_at, max_attempts, status, academy_subjects(name), academy_classes(name)",
    )
    // Repeated on the client as well as in the row policy, so a draft can never
    // reach the list even if the policy is ever widened.
    .in("status", [
      "scheduled",
      "active",
      "closed",
      "graded",
      "results_published",
    ])
    .order("starts_at", { ascending: false });
  return { data: data ?? [], error };
}

// Whether the window is open right now, according to the server clock.
export async function getAcademyExamWindowState(examId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_window_is_open", {
    p_exam_id: examId,
  });
  return { data: { is_open: Boolean(data) }, error };
}

// An attempt in progress, if there is one. Lets a refresh or a reopened browser
// come back to the same paper rather than starting a second attempt.
export async function getAcademyExamLiveAttempt(examId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase
    .from("academy_exam_attempts")
    .select("id, attempt_number, started_at, deadline_at, status")
    .eq("exam_id", examId)
    .eq("status", "in_progress")
    .maybeSingle();
  return { data, error };
}

export async function startAcademyExamAttempt(examId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_start_attempt", {
    p_exam_id: examId,
  });
  return { data, error };
}

export async function getAcademyExamPaper(attemptId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_paper", {
    p_attempt_id: attemptId,
  });
  return { data: data ?? [], error };
}

// One request per answer change, not a poll. The server resolves the ordering
// itself: an answer that arrives carrying an older client timestamp is dropped
// rather than allowed to undo a newer one.
export async function saveAcademyExamAnswer(
  attemptId,
  questionId,
  selectedKey,
  clientAnsweredAt,
) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_save_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_selected_key: selectedKey,
    p_client_answered_at: clientAnsweredAt || null,
  });
  return { data, error };
}

export async function submitAcademyExamAttempt(
  attemptId,
  reason = "student",
  clientSubmittedAt = null,
) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_submit_attempt", {
    p_attempt_id: attemptId,
    p_reason: reason,
    p_client_submitted_at: clientSubmittedAt || null,
  });
  return { data, error };
}

export async function getAcademyExamResult(attemptId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_student_result", {
    p_attempt_id: attemptId,
  });
  return { data, error };
}

// One student's own exam history, scores included only where the teacher has
// released them. The publication check is the function's job, not the caller's,
// so there is no client that could be trusted to hide a number it did not want.
export async function getAcademyExamHistory() {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_student_history");
  return { data: data ?? [], error };
}

// The audit trail behind a disputed mark, for staff.
export async function getAcademyExamEvents(examId, limit = 100) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_event_log", {
    p_exam_id: examId,
    p_limit: limit,
  });
  return { data: data ?? [], error };
}

// ---------------------------------------------------------------------------
// Assessment engine: the teacher side
//
// This is what closes the loop the student runner waits on. A runner that says
// "results appear once published" needs someone able to actually publish them.

// Releases or withholds an exam's results. Separate from publishAcademyExam,
// which puts the paper in front of students in the first place; conflating the
// two would mean a teacher cannot hold marks back without un-sitting the exam.
export async function publishAcademyExamResults(examId, publish = true) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_publish_results", {
    p_exam_id: examId,
    p_publish: publish,
  });
  return { data, error };
}

// Every attempt on an exam, for the teacher's mark sheet. Scores are already
// computed by the submit function, so this is a read, not a re-grade.
//
// This goes through a staff-only function rather than selecting the table. The
// score columns are deliberately absent from the student column grant on
// academy_exam_attempts, so a direct select is refused, and granting them is not
// an option because a student may read their own row and would then see a
// released score early. The function also resolves the student's name, which a
// table select could not do in one query anyway.
export async function getAcademyExamAttempts(examId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_attempt_sheet", {
    p_exam_id: examId,
  });
  const rows = (Array.isArray(data) ? data : []).map((row) => ({
    ...row,
    id: row.attempt_id,
  }));
  return { data: rows, error };
}

// One student's paper as the teacher sees it, for reviewing a mark. Staff only
// by the function's own check, and it is the one place the marking is shown
// alongside what the student chose.
export async function getAcademyExamAttemptAnswers(attemptId) {
  if (!supabase) return { data: null, error: new Error("Academy is not configured.") };
  const { data, error } = await supabase.rpc("academy_exam_paper_review", {
    p_attempt_id: attemptId,
  });
  return { data: data ?? [], error };
}
