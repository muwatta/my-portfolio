import { useEffect, useState } from "react";
import {
  getAcademyTeacherCurriculum,
  saveAcademyLesson,
  saveAcademyWeek,
  scheduleAcademyLesson,
} from "../lib/academy";

const initialWeek = { course_id: "", week_number: 1, title: "" };
const initialLesson = {
  week_id: "",
  title: "",
  slug: "",
  lesson_number: 1,
  objectives: "",
  content: "",
  published: false,
};
const initialSchedule = {
  course_id: "",
  lesson_id: "",
  level_id: "",
  title: "",
  description: "",
  starts_at: "",
  ends_at: "",
  published: false,
};

export default function AcademyTeacherLessons() {
  const [data, setData] = useState({ courses: [], weeks: [], lessons: [] });
  const [week, setWeek] = useState(initialWeek);
  const [lesson, setLesson] = useState(initialLesson);
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
    if (error) setMessage(error.message || "Could not save this item.");
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

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Teacher control center
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
            submit(saveAcademyWeek, week, () => setWeek(initialWeek));
          }}
        >
          <h2 className="text-lg font-bold">Add week</h2>
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
          <button className="button-primary" type="submit">
            Save week
          </button>
        </form>
        <form
          className="space-y-4 border-l-4 border-cyan-400 bg-white p-5 shadow-sm dark:bg-slate-900"
          onSubmit={(event) => {
            event.preventDefault();
            submit(saveAcademyLesson, lesson, () => setLesson(initialLesson));
          }}
        >
          <h2 className="text-lg font-bold">Add lesson</h2>
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
            Content
            <textarea
              className="field min-h-24"
              name="content"
              value={lesson.content}
              onChange={update(setLesson)}
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
    </div>
  );
}
