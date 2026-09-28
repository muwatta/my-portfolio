import { useEffect, useState } from "react";
import {
  getClassOptions,
  getCourseOptions,
  sendAnnouncement,
} from "../../lib/academyTeacher";
import { getGradingFilters } from "../../lib/academyGrading";
import { friendlyError } from "../../lib/utils";

const AUDIENCES = [
  { value: "course", label: "A whole course" },
  { value: "class", label: "One class" },
  { value: "student", label: "One student" },
];

export default function AnnouncementComposer({ onSent }) {
  const [audience, setAudience] = useState("course");
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({
    courseId: "",
    classId: "",
    studentId: "",
    title: "",
    message: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCourseOptions().then((result) => {
      setCourses(result.data ?? []);
      setForm((value) => ({ ...value, courseId: value.courseId || result.data?.[0]?.id || "" }));
    });
    getClassOptions().then((result) => setClasses(result.data ?? []));
    getGradingFilters().then((result) =>
      setStudents(result.data?.students ?? []),
    );
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");

    const { data, error: failure } = await sendAnnouncement({
      title: form.title,
      message: form.message,
      courseId: audience === "course" ? form.courseId : "",
      classId: audience === "class" ? form.classId : "",
      studentId: audience === "student" ? form.studentId : "",
    });
    setBusy(false);

    if (failure) {
      setError(friendlyError(failure, "Could not send that announcement."));
      return;
    }
    setStatus(
      data
        ? `Sent to ${data} student${data === 1 ? "" : "s"}.`
        : "Sent, but nobody matched that audience.",
    );
    setForm((value) => ({ ...value, title: "", message: "" }));
    onSent?.();
  }

  const audienceReady =
    (audience === "course" && form.courseId) ||
    (audience === "class" && form.classId) ||
    (audience === "student" && form.studentId);

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <fieldset>
        <legend className="text-sm font-semibold">Who is this for?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {AUDIENCES.map((option) => (
            <label
              key={option.value}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-3 text-sm font-medium ${
                audience === option.value
                  ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/40"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <input
                type="radio"
                name="announcement-audience"
                className="sr-only"
                value={option.value}
                checked={audience === option.value}
                onChange={() => setAudience(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {audience === "course" ? (
        <label className="label">
          Course
          <select
            className="field"
            value={form.courseId}
            onChange={(event) =>
              setForm((value) => ({ ...value, courseId: event.target.value }))
            }
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {audience === "class" ? (
        <label className="label">
          Class
          <select
            className="field"
            value={form.classId}
            onChange={(event) =>
              setForm((value) => ({ ...value, classId: event.target.value }))
            }
          >
            <option value="">Choose a class</option>
            {classes.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {audience === "student" ? (
        <label className="label">
          Student
          <select
            className="field"
            value={form.studentId}
            onChange={(event) =>
              setForm((value) => ({ ...value, studentId: event.target.value }))
            }
          >
            <option value="">Choose a student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.display_name || student.id}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="label">
        Title
        <input
          className="field"
          value={form.title}
          onChange={(event) =>
            setForm((value) => ({ ...value, title: event.target.value }))
          }
          required
          maxLength={120}
        />
      </label>

      <label className="label">
        Message
        <textarea
          className="field min-h-28"
          value={form.message}
          onChange={(event) =>
            setForm((value) => ({ ...value, message: event.target.value }))
          }
          required
          maxLength={1000}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {status}
        </p>
      ) : null}

      <button
        className="button-primary"
        type="submit"
        disabled={busy || !audienceReady}
      >
        {busy ? "Sending" : "Send announcement"}
      </button>
    </form>
  );
}
