// End-to-end check of the assessment engine against the live database.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/e2e-exam.mjs
//
// This exists because four production faults in this feature were invisible to
// unit tests. Every one of them was a privilege or constraint that only exists in
// the real database, and every test here had passed because the Supabase client
// was mocked. A mocked client will happily select a column nobody is granted.
//
// Two rules this script keeps, because breaking either would make it prove
// nothing: the service role is used only to seed and to clean up, never to take
// part in the flow under test, and the flow is driven with real signed-in tokens
// over HTTP exactly as the browser does.
//
// This is not a unit test. It creates a real teacher and a real student, signs
// both in for real, and drives the published RPCs over HTTP exactly as the app
// does. Service role is used only to seed and to clean up, never to take part
// in the flow being tested, because service role bypasses RLS and would prove
// nothing about what a signed-in student can actually do.
//
// Everything it creates is removed at the end.

import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i < 0) continue;
  env[line.slice(0, i).trim()] = line
    .slice(i + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
}

const URL_BASE = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
// Read from the environment on purpose. The key is never written into this file
// or into .env.local, and the script fails loudly rather than running half-blind.
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is not set. Nothing was run and nothing was changed.\n" +
      "Export the project's own service_role key, then run this again.\n" +
      "The script creates a teacher, a student and one exam, and deletes all of\n" +
      "them again when it finishes.",
  );
  process.exit(2);
}

const stamp = Date.now();
const teacherEmail = `e2e-teacher-${stamp}@example.test`;
const studentEmail = `e2e-student-${stamp}@example.test`;
const PASSWORD = "e2e-only-not-a-real-password";

// Every exam this script creates is recorded, not just the one under test. The
// first version tracked a single exam and forgot the draft it also made, and
// because academy_exams.class_id is on delete set null, deleting the class
// orphaned the draft rather than removing it. The draft then held a
// created_by reference to the test teacher, and academy_exams_created_by_fkey is
// on delete restrict, so the user delete failed and the script left a real
// account behind in a live database. Tracking the list, and checking every
// delete, is what stops that.
const created = { users: [], course: null, klass: null, subject: null, exams: [] };
const results = [];

function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` :: ${detail}` : ""}`);
}

// apikey identifies the project key, Authorization carries who is asking. Passing
// a user JWT as apikey is rejected outright, so the two are kept separate here.
async function api(auth, path, { method = "GET", body, headers = {} } = {}) {
  const { apikey, token } = auth;
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey,
      Authorization: `Bearer ${token ?? apikey}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, data: parsed };
}

// PostgREST returns a null body on insert unless asked for the row back, which
// is a silent null rather than an error and cost one debugging round.
const rest = (path, opts = {}) => {
  const method = opts.method ?? "GET";
  const prefer = method === "POST" || method === "PATCH"
    ? { Prefer: "return=representation" }
    : {};
  return api({ apikey: SERVICE }, path, {
    ...opts,
    headers: { ...prefer, ...(opts.headers ?? {}) },
  });
};

// A call made as a signed-in user: the project key identifies the project, the
// user's own token decides what RLS lets them see.
const asUser = (token, path, opts) => api({ apikey: ANON, token }, path, opts);
const signIn = async (email) => {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: ANON,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.json();
  if (!body.access_token) {
    throw new Error(`sign-in failed for ${email}: ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body.access_token;
};
const rpc = (token, name, args) =>
  asUser(token, `rpc/${name}`, { method: "POST", body: args });

async function makeUser(email, displayName, role) {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    }),
  });
  const user = await res.json();
  if (!user.id) throw new Error(`user create failed: ${JSON.stringify(user).slice(0, 300)}`);
  created.users.push(user.id);
  // A trigger creates the profile row on signup, so this updates rather than
  // inserts. Inserting here failed with a duplicate key, which is the useful
  // evidence that the trigger exists and works.
  const profile = await rest(`academy_profiles?id=eq.${user.id}`, {
    method: "PATCH",
    body: { display_name: displayName, role },
  });
  if (profile.status >= 300) {
    throw new Error(`profile update failed: ${JSON.stringify(profile.data)}`);
  }
  return user.id;
}

async function main() {
  console.log(`\nSeeding e2e fixtures (stamp ${stamp})\n`);

  const teacherId = await makeUser(teacherEmail, "E2E Teacher", "teacher");
  const studentId = await makeUser(studentEmail, "E2E Student", "student");
  // The allow list is what academy_is_teacher() actually reads.
  await rest("academy_admins", {
    method: "POST",
    body: { user_id: teacherId },
  });

  const course = await rest("academy_courses", {
    method: "POST",
    body: {
      slug: `e2e-course-${stamp}`,
      title: "E2E Course",
      published: true,
    },
  });
  created.course = course.data[0]?.id ?? course.data?.id;

  const klass = await rest("academy_classes", {
    method: "POST",
    body: {
      course_id: created.course,
      name: "E2E Class",
      created_by: teacherId,
    },
  });
  created.klass = klass.data[0]?.id ?? klass.data?.id;

  await rest("academy_class_members", {
    method: "POST",
    body: { class_id: created.klass, student_id: studentId, status: "active" },
  });

  const subject = await rest("academy_subjects", {
    method: "POST",
    body: { slug: `e2e-subject-${stamp}`, name: `E2E Subject ${stamp}` },
  });
  created.subject = subject.data[0]?.id ?? subject.data?.id;

  const teacherToken = await signIn(teacherEmail);
  const studentToken = await signIn(studentEmail);

  // ---------------------------------------------------------------- the build
  const question = await asUser(teacherToken, "academy_exam_questions", {
    method: "POST",
    body: {
      subject_id: created.subject,
      topic: "e2e",
      question_type: "mcq",
      difficulty: "easy",
      prompt: "Which keyword declares a class in C++?",
      // Authored with numeric keys on purpose, to prove the paper re-letters them.
      options: [{ key: "1", label: "class" }, { key: "2", label: "struct" }],
      correct_key: "1",
      marks: 2,
      status: "active",
    },
    headers: { Prefer: "return=representation" },
  });
  const questionId = question.data?.[0]?.id;
  check("teacher can create a question", Boolean(questionId), JSON.stringify(question.data).slice(0, 200));
  if (!questionId) return finish();

  const exam = await rpc(teacherToken, "academy_exam_create", {
    p_title: `E2E Exam ${stamp}`,
    p_subject_id: created.subject,
    p_class_id: created.klass,
    p_duration_minutes: 20,
    p_pass_mark: 50,
    p_starts_at: new Date(Date.now() - 60000).toISOString(),
    p_ends_at: new Date(Date.now() + 3600000).toISOString(),
    p_max_attempts: 1,
  });
  created.exam = exam.data?.id ?? exam.data?.[0]?.id;
  if (created.exam) created.exams.push(created.exam);
  check("teacher can create an exam", Boolean(created.exam), JSON.stringify(exam.data).slice(0, 120));
  if (!created.exam) return finish();

  const added = await rpc(teacherToken, "academy_exam_add_question", {
    p_exam_id: created.exam,
    p_question_id: questionId,
  });
  check("question can be added to the paper", added.status < 300, JSON.stringify(added.data).slice(0, 120));

  // The re-lettering claim: authored with keys 1/2, must arrive as A/B.
  const beforePublish = await rest(
    `academy_exam_question_links?exam_id=eq.${created.exam}&select=snapshot`,
  );
  const link = Array.isArray(beforePublish.data) ? beforePublish.data[0] : null;
  const snap = link?.snapshot;
  const snapKeys = (snap?.options ?? []).map((o) => o.key).join("");
  const snapKey = snap?.correct_key ?? snap?.answer_key;
  check(
    "options are re-lettered to A/B on the paper",
    snapKeys === "AB" && snapKey === "A",
    `keys=${snapKeys} answer=${snapKey} snapshotFields=${Object.keys(snap ?? {}).join(",")}`,
  );

  const published = await rpc(teacherToken, "academy_exam_publish", {
    p_exam_id: created.exam,
  });
  check("exam publishes", published.status < 300, JSON.stringify(published.data).slice(0, 120));

  // ---------------------------------- the draft-paper leak, with a real token
  // This policy was tightened after a review found a class member could read a
  // draft's title, duration and instructions even though starting one was
  // refused. It was only ever proven by a test and by the DDL applying cleanly.
  const draft = await rpc(teacherToken, "academy_exam_create", {
    p_title: `E2E Draft ${stamp}`,
    p_subject_id: created.subject,
    p_class_id: created.klass,
    p_duration_minutes: 20,
    p_starts_at: new Date(Date.now() - 60000).toISOString(),
    p_ends_at: new Date(Date.now() + 3600000).toISOString(),
  });
  const draftId = draft.data?.id ?? draft.data?.[0]?.id;
  if (draftId) created.exams.push(draftId);
  check("a draft exam can be created", Boolean(draftId), JSON.stringify(draft.data).slice(0, 140));

  if (draftId) {
    const studentDraft = await asUser(
      studentToken,
      `academy_exams?id=eq.${draftId}&select=id,title,instructions,duration_minutes`,
    );
    check(
      "a class member cannot read a draft exam",
      (Array.isArray(studentDraft.data) ? studentDraft.data.length : 0) === 0
        || studentDraft.status >= 300,
      `status=${studentDraft.status} rows=${Array.isArray(studentDraft.data) ? studentDraft.data.length : "n/a"}`,
    );

    const draftAsStudentList = await asUser(
      studentToken,
      "academy_exams?select=id,title,status",
    );
    const leaked = (Array.isArray(draftAsStudentList.data) ? draftAsStudentList.data : [])
      .filter((row) => row.id === draftId);
    check(
      "and it does not appear in the student's own exam list",
      leaked.length === 0,
      `saw=${JSON.stringify(leaked).slice(0, 140)}`,
    );

    const teacherDraft = await asUser(
      teacherToken,
      `academy_exams?id=eq.${draftId}&select=id,title,status`,
    );
    check(
      "a teacher can still read the same draft",
      Array.isArray(teacherDraft.data) && teacherDraft.data.length === 1,
      `status=${teacherDraft.status}`,
    );

    const startDraft = await rpc(studentToken, "academy_exam_start_attempt", {
      p_exam_id: draftId,
    });
    check(
      "a student still cannot start a draft",
      startDraft.status >= 300,
      `status=${startDraft.status}`,
    );
  }

  // ------------------------------------------------------ the student refuses
  const draftPeek = await api({ apikey: ANON }, `academy_exams?select=id&id=eq.${created.exam}`);
  check("anon cannot read the exam table", (draftPeek.data?.length ?? 0) === 0);

  // ------------------------------------------------------------ the student runs
  const started = await rpc(studentToken, "academy_exam_start_attempt", {
    p_exam_id: created.exam,
  });
  const attemptId = started.data?.id ?? started.data?.[0]?.id;
  check("student can start an attempt", Boolean(attemptId), JSON.stringify(started.data).slice(0, 200));
  if (!attemptId) return finish();
  check(
    "server set a deadline and the browser did not",
    Boolean(started.data?.deadline_at || started.data?.[0]?.deadline_at),
  );

  const secondAttempt = await rpc(studentToken, "academy_exam_start_attempt", {
    p_exam_id: created.exam,
  });
  const secondId = secondAttempt.data?.id ?? secondAttempt.data?.[0]?.id;
  check(
    "a second start does not mint another attempt",
    secondId === attemptId,
    `first=${String(attemptId).slice(0, 8)} second=${String(secondId).slice(0, 8)}`,
  );

  const paper = await rpc(studentToken, "academy_exam_paper", { p_attempt_id: attemptId });
  const paperRows = Array.isArray(paper.data) ? paper.data : [];
  check("paper is returned to the student", paperRows.length === 1, `rows=${paperRows.length}`);
  const paperText = JSON.stringify(paperRows);
  check(
    "paper carries no answer key",
    !paperText.includes("correct_key") && !/correctKey/.test(paperText),
  );
  check(
    "paper options arrived as A/B",
    (paperRows[0]?.options ?? []).map((o) => o.key).join("") === "AB",
    `keys=${(paperRows[0]?.options ?? []).map((o) => o.key).join("")}`,
  );

  // A student reading their own attempt row must not see the score.
  const ownRow = await asUser(
    studentToken,
    `academy_exam_attempts?id=eq.${attemptId}&select=id,score,percentage,status`,
  );
  check(
    "selecting a score column on an own row is refused",
    ownRow.status >= 300,
    `status=${ownRow.status} body=${JSON.stringify(ownRow.data).slice(0, 120)}`,
  );
  const safeRow = await asUser(
    studentToken,
    `academy_exam_attempts?id=eq.${attemptId}&select=id,status,submitted_at`,
  );
  const row = Array.isArray(safeRow.data) ? safeRow.data[0] : null;
  check(
    "the same row is readable for its non-score columns",
    Boolean(row) && row.score === undefined,
    `keys=${row ? Object.keys(row).join(",") : "none"}`,
  );

  const wrong = await rpc(studentToken, "academy_exam_save_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_selected_key: "B",
    p_client_answered_at: new Date().toISOString(),
  });
  check("an answer saves", wrong.status < 300, JSON.stringify(wrong.data).slice(0, 120));

  const fixed = await rpc(studentToken, "academy_exam_save_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_selected_key: "A",
    p_client_answered_at: new Date(Date.now() + 1000).toISOString(),
  });
  check("a later answer overwrites an earlier one", fixed.status < 300);

  const stale = await rpc(studentToken, "academy_exam_save_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_selected_key: "B",
    p_client_answered_at: new Date(Date.now() - 60000).toISOString(),
  });
  const graded = await rpc(studentToken, "academy_exam_submit_attempt", {
    p_attempt_id: attemptId,
    p_reason: "student",
    p_client_submitted_at: new Date().toISOString(),
  });
  check("attempt submits", graded.status < 300, JSON.stringify(graded.data).slice(0, 150));

  // ------------------------------------------------------- the result is hidden
  const hidden = await rpc(studentToken, "academy_exam_student_result", {
    p_attempt_id: attemptId,
  });
  check(
    "no score is visible before publication",
    hidden.data?.results_published === false && hidden.data?.score === undefined,
    JSON.stringify(hidden.data).slice(0, 200),
  );

  const history = await rpc(studentToken, "academy_exam_student_history");
  const historyRows = Array.isArray(history.data) ? history.data : [];
  const mine = historyRows.find((r) => r.attempt_id === attemptId);
  check(
    "history hides the score of an unreleased exam",
    Boolean(mine) && mine.score === null && mine.percentage === null,
    JSON.stringify(mine).slice(0, 200),
  );

  // ------------------------------------------------------------- the teacher
  const scoreProbe = await asUser(
    studentToken,
    `academy_exam_attempts?id=eq.${attemptId}&select=score`,
  );
  check(
    "a bare score select is refused for a student",
    scoreProbe.status >= 300,
    `status=${scoreProbe.status}`,
  );

  const released = await rpc(teacherToken, "academy_exam_publish_results", {
    p_exam_id: created.exam,
    p_publish: true,
  });
  check("teacher releases the results", released.status < 300, JSON.stringify(released.data).slice(0, 120));

  const shown = await rpc(studentToken, "academy_exam_student_result", {
    p_attempt_id: attemptId,
  });
  check(
    "student now sees the released score",
    shown.data?.results_published === true && Number(shown.data?.percentage) === 100,
    JSON.stringify(shown.data).slice(0, 250),
  );

  const historyAfter = await rpc(studentToken, "academy_exam_student_history");
  const mineAfter = (Array.isArray(historyAfter.data) ? historyAfter.data : []).find(
    (r) => r.attempt_id === attemptId,
  );
  check(
    "history now carries the released score",
    mineAfter && Number(mineAfter.percentage) === 100,
    JSON.stringify(mineAfter).slice(0, 200),
  );

  const events = await rpc(teacherToken, "academy_exam_event_log", {
    p_exam_id: created.exam,
    p_limit: 50,
  });
  const eventRows = Array.isArray(events.data) ? events.data : [];
  check("the activity log records the run", eventRows.length > 0, `events=${eventRows.length}`);
  check(
    "the log includes a publication event",
    eventRows.some((e) => e.action === "results_published"),
    eventRows.map((e) => e.action).join(","),
  );

  // ------------------------------- the two staff reads that were broken outright
  const sheet = await rpc(teacherToken, "academy_exam_attempt_sheet", {
    p_exam_id: created.exam,
  });
  const sheetRows = Array.isArray(sheet.data) ? sheet.data : [];
  check(
    "teacher mark sheet returns the score",
    sheetRows.length === 1 && Number(sheetRows[0]?.percentage) === 100,
    JSON.stringify(sheetRows).slice(0, 200),
  );
  check(
    "mark sheet resolves the student name",
    sheetRows[0]?.student_name === "E2E Student",
    `name=${sheetRows[0]?.student_name}`,
  );

  const sheetAsStudent = await rpc(studentToken, "academy_exam_attempt_sheet", {
    p_exam_id: created.exam,
  });
  check(
    "a student cannot read the mark sheet",
    (Array.isArray(sheetAsStudent.data) ? sheetAsStudent.data.length : 0) === 0
      || sheetAsStudent.status >= 300,
    `status=${sheetAsStudent.status} rows=${Array.isArray(sheetAsStudent.data) ? sheetAsStudent.data.length : "n/a"}`,
  );

  const review = await rpc(teacherToken, "academy_exam_paper_review", {
    p_attempt_id: attemptId,
  });
  const reviewRows = Array.isArray(review.data) ? review.data : [];
  check(
    "teacher review returns the marking",
    reviewRows.length === 1 && reviewRows[0]?.is_correct === true,
    JSON.stringify(reviewRows).slice(0, 200),
  );
  check(
    "review carries no answer key",
    !JSON.stringify(reviewRows).includes("correct_key"),
  );

  const reviewAsStudent = await rpc(studentToken, "academy_exam_paper_review", {
    p_attempt_id: attemptId,
  });
  check(
    "a student cannot read the review",
    (Array.isArray(reviewAsStudent.data) ? reviewAsStudent.data.length : 0) === 0
      || reviewAsStudent.status >= 300,
    `status=${reviewAsStudent.status}`,
  );

  // ---------------------------------- the question bank write paths, which the
  // missing table grant had made impossible for the whole admin UI
  const edited = await asUser(teacherToken, `academy_exam_questions?id=eq.${questionId}`, {
    method: "PATCH",
    body: { marks: 3 },
    headers: { Prefer: "return=representation" },
  });
  check(
    "a teacher can edit a question in the bank",
    edited.status < 300 && Number(edited.data?.[0]?.marks) === 3,
    `status=${edited.status} marks=${edited.data?.[0]?.marks}`,
  );

  const archived = await asUser(teacherToken, `academy_exam_questions?id=eq.${questionId}`, {
    method: "PATCH",
    body: { status: "archived" },
    headers: { Prefer: "return=representation" },
  });
  check(
    "a teacher can archive a question in the bank",
    archived.status < 300 && archived.data?.[0]?.status === "archived",
    `status=${archived.status} state=${archived.data?.[0]?.status}`,
  );

  const bankAsStudent = await asUser(
    studentToken,
    "academy_exam_questions?select=id,correct_key",
  );
  check(
    "a student still cannot read the question bank",
    (Array.isArray(bankAsStudent.data) ? bankAsStudent.data.length : 0) === 0
      || bankAsStudent.status >= 300,
    `status=${bankAsStudent.status} rows=${Array.isArray(bankAsStudent.data) ? bankAsStudent.data.length : "n/a"}`,
  );

  // ------------------------------- the exam has to reach progress and the board
  const pointsAfter = await asUser(
    studentToken,
    `academy_leaderboard_points?source_type=eq.exam&select=points,verification_status`,
  );
  const examPoints = Array.isArray(pointsAfter.data) ? pointsAfter.data : [];
  check(
    "releasing results puts the exam on the leaderboard",
    examPoints.length === 1 && examPoints[0].points === 20,
    JSON.stringify(examPoints).slice(0, 200),
  );
  check(
    "the leaderboard entry is verified, not pending",
    examPoints[0]?.verification_status === "verified",
  );

  const withdrawn = await rpc(teacherToken, "academy_exam_publish_results", {
    p_exam_id: created.exam,
    p_publish: false,
  });
  check("results can be withheld again", withdrawn.status < 300);

  const pointsWithheld = await asUser(
    studentToken,
    `academy_leaderboard_points?source_type=eq.exam&select=points`,
  );
  check(
    "withholding takes the exam back off the leaderboard",
    (Array.isArray(pointsWithheld.data) ? pointsWithheld.data.length : 0) === 0,
    JSON.stringify(pointsWithheld.data).slice(0, 200),
  );

  const hiddenAgain = await rpc(studentToken, "academy_exam_student_result", {
    p_attempt_id: attemptId,
  });
  check(
    "withholding hides the score again",
    hiddenAgain.data?.results_published === false,
    JSON.stringify(hiddenAgain.data).slice(0, 160),
  );

  // Put it back so the log assertions below see the publication.
  await rpc(teacherToken, "academy_exam_publish_results", {
    p_exam_id: created.exam,
    p_publish: true,
  });

  const eventsAsStudent = await rpc(studentToken, "academy_exam_event_log", {
    p_exam_id: created.exam,
    p_limit: 50,
  });
  check(
    "a student cannot read the activity log",
    eventsAsStudent.status >= 300 || (Array.isArray(eventsAsStudent.data) && eventsAsStudent.data.length === 0),
    `status=${eventsAsStudent.status} rows=${Array.isArray(eventsAsStudent.data) ? eventsAsStudent.data.length : "n/a"}`,
  );

  finish();
}

async function finish() {
  console.log("\nCleaning up");
  const problems = [];
  // Order matters. academy_exams_created_by_fkey is on delete restrict, so every
  // exam has to go before the user that made it, or the user delete is refused.
  for (const id of created.exams) {
    const res = await rest(`academy_exams?id=eq.${id}`, { method: "DELETE" });
    if (res.status >= 300) {
      problems.push(`exam ${id}: ${res.status} ${JSON.stringify(res.data).slice(0, 120)}`);
    }
  }
  if (created.klass) {
    const res = await rest(`academy_classes?id=eq.${created.klass}`, { method: "DELETE" });
    if (res.status >= 300) problems.push(`class: ${res.status}`);
  }
  if (created.course) {
    const res = await rest(`academy_courses?id=eq.${created.course}`, { method: "DELETE" });
    if (res.status >= 300) problems.push(`course: ${res.status}`);
  }
  if (created.subject) {
    const res = await rest(`academy_subjects?id=eq.${created.subject}`, { method: "DELETE" });
    if (res.status >= 300) problems.push(`subject: ${res.status}`);
  }
  for (const id of created.users) {
    const res = await fetch(`${URL_BASE}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
    if (!res.ok) {
      problems.push(`user ${id}: ${res.status} ${(await res.text()).slice(0, 120)}`);
    }
  }

  // Verified rather than assumed. A cleanup that reports success while leaving
  // rows behind is worse than one that fails loudly.
  const residue = await rest(
    "academy_exams?select=id&title=like.*E2E*",
  );
  const leftExams = Array.isArray(residue.data) ? residue.data.length : 0;
  if (leftExams > 0) problems.push(`${leftExams} e2e exam(s) still present`);

  // The accounts matter more than the rows. A leftover test teacher in a live
  // database is an account somebody could sign in to, so this is checked too
  // rather than assumed from the delete calls returning 2xx.
  const users = await fetch(`${URL_BASE}/auth/v1/admin/users?per_page=100`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  const leftUsers = ((await users.json()).users ?? []).filter((user) =>
    /^e2e-/.test(user.email ?? ""),
  );
  if (leftUsers.length > 0) {
    problems.push(
      `${leftUsers.length} e2e account(s) still exist: ${leftUsers
        .map((user) => user.email)
        .join(", ")}`,
    );
  }

  console.log(problems.length ? `CLEANUP PROBLEMS:\n - ${problems.join("\n - ")}` : "clean");
  console.log("done\n");

  const failed = results.filter((r) => !r.passed);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("\nFAILED:");
    for (const f of failed) console.log(` - ${f.name} :: ${f.detail}`);
  }
  // Cleanup trouble is a failure of this script, so it fails the run.
  process.exit(failed.length || problems.length ? 1 : 0);
}

main().catch(async (error) => {
  console.error("\nE2E aborted:", error.message);
  await finish();
});
