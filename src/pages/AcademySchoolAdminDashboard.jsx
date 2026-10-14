import { useCallback, useState } from "react";
import { FiActivity, FiAward, FiBookOpen, FiClock, FiUsers } from "react-icons/fi";
import AcademyLayout from "../components/academy/AcademyLayout";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import {
  assignAcademyStudentLevel,
  getAcademySchoolAdminDashboard,
} from "../lib/academy";
import { friendlyError } from "../lib/utils";

const formatActivity = (value) => {
  if (!value) return "No activity recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No activity recorded" : date.toLocaleString();
};

export default function AcademySchoolAdminDashboard() {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");
  const [busyStudent, setBusyStudent] = useState(null);

  const load = useCallback(async (background = false) => {
    const result = await getAcademySchoolAdminDashboard();
    if (background && result.error) return;
    setData(result.data);
    setState(result.error ? "error" : "ready");
  }, []);
  useAutoRefresh(load, { interval: 60000 });

  async function changeCourse(studentId, courseId) {
    setBusyStudent(studentId);
    setMessage("");
    const { error } = await assignAcademyStudentLevel(studentId, courseId);
    setBusyStudent(null);
    setMessage(
      friendlyError(
        error,
        "Student course updated. Their progress and achievements are unchanged.",
      ),
    );
    if (!error) await load();
  }

  const students = data?.students ?? [];
  const courses = data?.courses ?? [];
  const activeLearners = students.filter((student) => {
    if (!student.last_active_at) return false;
    return Date.now() - new Date(student.last_active_at).getTime() < 15 * 60 * 1000;
  }).length;
  const totalLessons = students.reduce(
    (total, student) => total + Number(student.completed_lessons ?? 0),
    0,
  );
  const totalLearningHours = Math.round(
    students.reduce(
      (total, student) => total + Number(student.learning_seconds ?? 0),
      0,
    ) / 3600,
  );
  const totalPoints = students.reduce(
    (total, student) => total + Number(student.verified_points ?? 0),
    0,
  );
  const stats = [
    { label: "Students", value: students.length, Icon: FiUsers },
    { label: "Active learners", value: activeLearners, Icon: FiActivity },
    { label: "Lessons completed", value: totalLessons, Icon: FiBookOpen },
    { label: "Learning time", value: `${totalLearningHours}h`, Icon: FiClock },
    { label: "Verified points", value: totalPoints, Icon: FiAward },
  ];

  return (
    <AcademyLayout workspace="school-admin">
      <div className="space-y-8">
        <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-950 p-6 text-white shadow-xl sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
            School administrator dashboard
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
            {data?.school?.name || "Your school"}
          </h1>
          {data?.school && (
            <p className="mt-2 text-slate-300">
              {data.school.city}, {data.school.state}
            </p>
          )}
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            Student records and progress shown here are limited to your assigned
            school. You can change a student’s course without removing their
            achievements.
          </p>
        </header>

        {message && (
          <p role="status" className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-950">
            {message}
          </p>
        )}
        {state === "loading" && (
          <p role="status" aria-live="polite">
            Loading your school’s students and progress...
          </p>
        )}
        {state === "error" && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            Your school dashboard could not be loaded. Please refresh or contact
            the primary administrator if the problem continues.
          </p>
        )}
        {state === "ready" && (
          <>
            <section
              aria-label="School progress summary"
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
            >
              {stats.map(({ label, value, Icon }) => (
                <article
                  key={label}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      {label}
                    </p>
                    <Icon aria-hidden="true" className="text-cyan-700 dark:text-cyan-300" />
                  </div>
                  <p className="mt-3 text-2xl font-extrabold tabular-nums">{value}</p>
                </article>
              ))}
            </section>

            <section aria-labelledby="school-students-heading" className="space-y-4">
              <div>
                <h2 id="school-students-heading" className="text-2xl font-bold">
                  Your students
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Review learning progress and assign a different active course.
                </p>
              </div>
              {!students.length ? (
                <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm dark:border-slate-700">
                  No students are currently registered to this school.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Student</th>
                        <th className="px-4 py-3">Progress</th>
                        <th className="px-4 py-3">Achievements</th>
                        <th className="px-4 py-3">Last active</th>
                        <th className="px-4 py-3">Course</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {students.map((student) => (
                        <tr key={student.id}>
                          <td className="min-w-56 px-4 py-4">
                            <p className="font-semibold">
                              {student.display_name || "Unnamed student"}
                            </p>
                            <p className="mt-1 break-all text-xs text-slate-500">
                              {student.email || "No email on file"}
                            </p>
                            {student.registration_number && (
                              <p className="mt-1 text-xs text-cyan-800 dark:text-cyan-300">
                                {student.registration_number}
                              </p>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            <p>{Number(student.completed_lessons ?? 0)} lessons</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {Math.round(Number(student.learning_seconds ?? 0) / 3600)}h learning
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 font-semibold">
                            {Number(student.verified_points ?? 0)} points
                          </td>
                          <td className="min-w-40 px-4 py-4 text-xs text-slate-600 dark:text-slate-300">
                            {formatActivity(student.last_active_at)}
                          </td>
                          <td className="min-w-64 px-4 py-4">
                            <select
                              className="field"
                              value={student.current_course_id || ""}
                              aria-label={`Course for ${student.display_name || "student"}`}
                              disabled={busyStudent === student.id}
                              onChange={(event) =>
                                changeCourse(student.id, event.target.value)
                              }
                            >
                              <option value="">No active course</option>
                              {courses.map((course) => (
                                <option key={course.id} value={course.id}>
                                  {course.title}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AcademyLayout>
  );
}
