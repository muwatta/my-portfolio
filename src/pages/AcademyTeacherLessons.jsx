import { useEffect, useState } from "react";
import {
  getAcademyTeacherCurriculum,
  saveAcademyLesson,
  saveAcademyWeek,
  publishAcademyWeek,
  scheduleAcademyLesson,
} from "../lib/academy";
import { friendlyError } from "../lib/utils";

const emptyWeek = { id: "", course_id: "", week_number: 0, title: "", description: "" };
const emptyLesson = {
  id: "",
  week_id: "",
  title: "",
  slug: "",
  lesson_number: 1,
  objectives: "",
  content: "{}",
  published: false,
};
const initialSchedule = {
  course_id: "",
  lesson_id: "",
  title: "",
  description: "",
  starts_at: "",
  ends_at: "",
  published: false,
};

export default function AcademyTeacherLessons() {
  const [data, setData] = useState({ courses: [], weeks: [], lessons: [] });
  const [week, setWeek] = useState(emptyWeek);
  const [lesson, setLesson] = useState(emptyLesson);
  const [schedule, setSchedule] = useState(initialSchedule);
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("");

  async function load() {
    const result = await getAcademyTeacherCurriculum();
    setData(result.data ?? { courses: [], weeks: [], lessons: [] });
    setState(result.error ? "error" : "ready");
  }
  useEffect(() => {
    load();
  }, []);

  async function submit(action, value, reset) {
    setMessage("");
    const { error } = await action(value);
    if (error)
      setMessage(friendlyError(error, "Could not save this item."));
    else {
      setMessage("Saved successfully.");
      reset();
      await load();
    }
  }

  const update = (setter) => (event) => {
    const { name, value, type, checked } = event.target;
    setter((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  function editWeek(weekRow) {
    setWeek({
      id: weekRow.id,
      course_id: weekRow.course_id,
      week_number: weekRow.week_number,
      title: weekRow.title,
      description: weekRow.description ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editLesson(lessonRow) {
    const objectives = Array.isArray(lessonRow.objectives)
      ? lessonRow.objectives.join("\n")
      : lessonRow.objectives ?? "";
    setLesson({
      id: lessonRow.id,
      week_id: lessonRow.week_id,
      title: lessonRow.title,
      slug: lessonRow.slug,
      lesson_number: lessonRow.lesson_number,
      objectives,
      content: JSON.stringify(lessonRow.content ?? {}, null, 2),
      published: lessonRow.published,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleLessonPublish(lessonRow) {
    setMessage("");
    const { error } = await saveAcademyLesson({
      ...lessonRow,
      published: !lessonRow.published,
    });
    if (error)
      setMessage(
        friendlyError(error, "Publish state could not be changed."),
      );
    else {
      setMessage(`Lesson ${lessonRow.published ? "unpublished" : "published"}.`);
      await load();
    }
  }

  async function toggleWeekPublish(weekRow) {
    setMessage("");
    const { data, error } = await publishAcademyWeek(weekRow.id, !weekRow.published);
    if (error)
      setMessage(
        friendlyError(error, "Week publish state could not be changed."),
      );
    else {
      setMessage(
        `Published ${data.length} lesson${data.length === 1 ? "" : "s"} for week ${weekRow.week_number}.`,
      );
      await load();
    }
  }

  const lessonsByWeek = (data.lessons ?? []).reduce((groups, item) => {
    if (!groups[item.week_id]) groups[item.week_id] = [];
    groups[item.week_id].push(item);
    return groups;
  }, {});
  const weeksByCourse = (data.weeks ?? []).reduce((groups, item) => {
    if (!groups[item.course_id]) groups[item.course_id] = [];
    groups[item.course_id].push(item);
    return groups;
  }, {});

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Admin control center
        </p>
        <h1 className="mt-2 text-3xl font-bold">Lessons and schedule</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Build the course → week → lesson path and publish only when content is
          ready.
        </p>
      </header>
      {message && (
        <p
          role="status"
          className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100"
        >
          {message}
        </p>
      )}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          Curriculum could not be loaded. Confirm the Academy migrations are
          applied.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <form
          className="space-y-4 border-l-4 border-cyan-400 bg-white p-5 shadow-sm dark:bg-slate-900"
          onSubmit={(event) => {
            event.preventDefault();
            submit(saveAcademyWeek, week, () => setWeek(emptyWeek));
          }}
        >
          <h2 className="text-lg font-bold">
            {week.id ? `Edit week ${week.week_number}` : "Add week"}
          </h2>
          <label className="label">
            Course
            <select
              className="field"
              name="course_id"
              value={week.course_id}
              onChange={update(setWeek)}
              required
            >
              <option value="">Select course</option>
              {data.courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Week number
            <input
              className="field"
              name="week_number"
              type="number"
              min="1"
              max="52"
              value={week.week_number}
              onChange={update(setWeek)}
              required
            />
          </label>
          <label className="label">
            Title
            <input
              className="field"
              name="title"
              value={week.title}
              onChange={update(setWeek)}
              required
            />
          </label>
          <label className="label">
            Description
            <textarea
              className="field min-h-20"
              name="description"
              value={week.description}
              onChange={update(setWeek)}
            />
          </label>
          <button className="button-primary" type="submit">
            Save week
          </button>
          {week.id && (
            <button
              className="button-ghost"
              type="button"
              onClick={() => setWeek(emptyWeek)}
            >
              Cancel edit
            </button>
          )}
        </form>
        <form
          className="space-y-4 border-l-4 border-cyan-400 bg-white p-5 shadow-sm dark:bg-slate-900"
          onSubmit={(event) => {
            event.preventDefault();
            submit(saveAcademyLesson, lesson, () => setLesson(emptyLesson));
          }}
        >
          <h2 className="text-lg font-bold">
            {lesson.id ? "Edit lesson" : "Add lesson"}
          </h2>
          <label className="label">
            Week
            <select
              className="field"
              name="week_id"
              value={lesson.week_id}
              onChange={update(setLesson)}
              required
            >
              <option value="">Select week</option>
              {data.weeks.map((item) => (
                <option key={item.id} value={item.id}>
                  Week {item.week_number}: {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Title
            <input
              className="field"
              name="title"
              value={lesson.title}
              onChange={update(setLesson)}
              required
            />
          </label>
          <label className="label">
            Slug
            <input
              className="field"
              name="slug"
              pattern="[a-z0-9-]+"
              value={lesson.slug}
              onChange={update(setLesson)}
              required
            />
          </label>
          <label className="label">
            Lesson number
            <input
              className="field"
              name="lesson_number"
              type="number"
              min="1"
              value={lesson.lesson_number}
              onChange={update(setLesson)}
              required
            />
          </label>
          <label className="label">
            Objectives
            <textarea
              className="field"
              name="objectives"
              value={lesson.objectives}
              onChange={update(setLesson)}
              placeholder="One objective per line"
              required
            />
          </label>
          <label className="label">
            Content (JSON)
            <textarea
              className="field min-h-48 font-mono text-xs"
              name="content"
              value={lesson.content}
              onChange={update(setLesson)}
              placeholder='{"explanation": "Plain text is also accepted."}'
              required
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              name="published"
              type="checkbox"
              checked={lesson.published}
              onChange={update(setLesson)}
            />{" "}
            Publish lesson
          </label>
          <button className="button-primary" type="submit">
            Save lesson
          </button>
          {lesson.id && (
            <button
              className="button-ghost"
              type="button"
              onClick={() => setLesson(emptyLesson)}
            >
              Cancel edit
            </button>
          )}
        </form>
        <form
          className="space-y-4 border-l-4 border-cyan-400 bg-white p-5 shadow-sm dark:bg-slate-900"
          onSubmit={(event) => {
            event.preventDefault();
            submit(scheduleAcademyLesson, schedule, () =>
              setSchedule(initialSchedule),
            );
          }}
        >
          <h2 className="text-lg font-bold">Schedule lesson</h2>
          <label className="label">
            Course
            <select
              className="field"
              name="course_id"
              value={schedule.course_id}
              onChange={update(setSchedule)}
              required
            >
              <option value="">Select course</option>
              {data.courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Lesson
            <select
              className="field"
              name="lesson_id"
              value={schedule.lesson_id}
              onChange={update(setSchedule)}
              required
            >
              <option value="">Select lesson</option>
              {data.lessons.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Title
            <input
              className="field"
              name="title"
              value={schedule.title}
              onChange={update(setSchedule)}
              required
            />
          </label>
          <label className="label">
            Starts at
            <input
              className="field"
              name="starts_at"
              type="datetime-local"
              value={schedule.starts_at}
              onChange={update(setSchedule)}
              required
            />
          </label>
          <label className="label">
            Ends at
            <input
              className="field"
              name="ends_at"
              type="datetime-local"
              value={schedule.ends_at}
              onChange={update(setSchedule)}
            />
          </label>
          <label className="label">
            Description
            <textarea
              className="field"
              name="description"
              value={schedule.description}
              onChange={update(setSchedule)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              name="published"
              type="checkbox"
              checked={schedule.published}
              onChange={update(setSchedule)}
            />{" "}
            Publish schedule
          </label>
          <button className="button-primary" type="submit">
            Save schedule
          </button>
        </form>
      </div>
      <section className="space-y-4">
        <h2 className="text-xl font-bold">Published curriculum</h2>
        {state === "ready" && data.courses.length === 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No courses have been created yet.
          </p>
        )}
        {data.courses.map((course) => (
          <article
            key={course.id}
            className="border-l-4 border-cyan-400 bg-white p-5 shadow-sm dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <p className="text-lg font-bold">{course.title}</p>
                <p className="text-sm text-slate-500">
                  {weeksByCourse[course.id]?.length ?? 0} weeks
                </p>
              </div>
              <span className="text-sm font-semibold">
                {course.published ? "Course published" : "Course draft"}
              </span>
            </div>
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {(weeksByCourse[course.id] ?? []).map((weekRow) => (
                <li key={weekRow.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      Week {weekRow.week_number}: {weekRow.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="button-ghost text-xs"
                        type="button"
                        onClick={() => editWeek(weekRow)}
                      >
                        Edit
                      </button>
                      <button
                        className="button-ghost text-xs"
                        type="button"
                        onClick={() => toggleWeekPublish(weekRow)}
                      >
                        {weekRow.published ? "Unpublish week" : "Publish week"}
                      </button>
                    </div>
                  </div>
                  {(lessonsByWeek[weekRow.id] ?? []).map((lessonRow) => (
                    <div
                      key={lessonRow.id}
                      className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50"
                    >
                      <p>
                        {lessonRow.lesson_number}. {lessonRow.title}
                        <span
                          className={`ml-2 text-xs font-semibold ${
                            lessonRow.published
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {lessonRow.published ? "published" : "draft"}
                        </span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          className="button-ghost text-xs"
                          type="button"
                          onClick={() => editLesson(lessonRow)}
                        >
                          Edit
                        </button>
                        <button
                          className="button-ghost text-xs"
                          type="button"
                          onClick={() => toggleLessonPublish(lessonRow)}
                        >
                          {lessonRow.published ? "Unpublish" : "Publish"}
                        </button>
                      </div>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}