import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getTeacherDashboard } from "../lib/academyTeacher";
import { friendlyError } from "../lib/utils";
import ProgressBar from "../components/academy/ProgressBar";
import AnnouncementComposer from "../components/academy/AnnouncementComposer";
import Gradebook from "../components/academy/Gradebook";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import RefreshControl from "../components/academy/RefreshControl";

const TABS = [
  { id: "today", label: "Today" },
  { id: "gradebook", label: "Gradebook" },
  { id: "announce", label: "Announce" },
];

export default function AcademyTeacherDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("today");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (background = false) => {
    if (background) setBusy(true);
    const { data: result, error: failure } = await getTeacherDashboard();
    setBusy(false);
    if (failure) {
      // A failed background poll should not replace what the teacher is reading.
      if (!background) {
        setError(friendlyError(failure, "Could not load the dashboard."));
      }
      return;
    }
    setData(result);
    setUpdatedAt(Date.now());
    setError("");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Polls slowly, and deliberately does not refresh when the teacher comes back
  // to the tab. Grading moves fast, but so does getting distracted, and
  // replacing the page the moment they alt-tab is worse than being a minute
  // behind. RefreshControl gives them the choice.
  useAutoRefresh(load, { interval: 120000, refreshOnFocus: true });

  const totals = data?.totals ?? {};
  const grading = data?.needsGrading ?? [];
  const due = data?.dueThisWeek ?? [];
  const inactive = data?.inactiveStudents ?? [];
  const completion = data?.completion ?? [];

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
            Teacher workspace
          </p>
          <RefreshControl onRefresh={() => load(false)} busy={busy} updatedAt={updatedAt} />
        </div>
        <h1 className="mt-2 text-3xl font-bold">What needs you today</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Grading, deadlines, and who has gone quiet, resolved in one call so
          the page is useful on a phone straight away.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Students" value={totals.students} />
        <Stat label="Courses" value={totals.courses} />
        <Stat label="Topics" value={totals.lessons} />
        <Stat label="Submissions" value={totals.submissions} />
      </dl>

      <nav aria-label="Teacher dashboard sections" className="flex flex-wrap gap-2">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            aria-current={tab === entry.id ? "page" : undefined}
            className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${
              tab === entry.id
                ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/40"
                : "border-slate-200 dark:border-slate-800"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {tab === "today" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="Waiting to be graded"
            action={
              grading.length ? (
                <Link className="text-sm font-semibold" to="/academy/admin/submissions">
                  Open the inbox
                </Link>
              ) : null
            }
          >
            {!grading.length ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Nothing waiting. Good place to be.
              </p>
            ) : (
              <ul className="space-y-2">
                {grading.map((item) => (
                  <li
                    key={item.submission_id}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                  >
                    <span className="font-semibold">{item.assignment_title}</span>
                    <span className="block text-slate-600 dark:text-slate-300">
                      {item.student_name} · {reviewLabel(item.review_state)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Due in the next seven days">
            {!due.length ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                No deadlines this week.
              </p>
            ) : (
              <ul className="space-y-2">
                {due.map((item) => (
                  <li
                    key={item.assignment_id}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                  >
                    <span className="font-semibold">{item.title}</span>
                    <span className="block text-slate-600 dark:text-slate-300">
                      due {new Date(item.due_at).toLocaleString()} ·{" "}
                      {item.submissions} submitted
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Gone quiet">
            {!inactive.length ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Everyone has been active recently.
              </p>
            ) : (
              <ul className="space-y-2">
                {inactive.map((item) => (
                  <li
                    key={item.student_id}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                  >
                    <span className="font-semibold">{item.name}</span>
                    <span className="block text-slate-600 dark:text-slate-300">
                      {item.course_title} · quiet for {item.days_quiet} days
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Completion by course">
            <ul className="space-y-3">
              {completion.map((item) => (
                <li key={item.course_id}>
                  <p className="text-sm font-semibold">
                    {item.course_title}{" "}
                    <span className="font-normal text-slate-500">
                      {item.completed} of {item.total} topics, {item.students}{" "}
                      students
                    </span>
                  </p>
                  <ProgressBar
                    value={item.total ? (item.completed / item.total) * 100 : 0}
                    label={`${item.course_title} completion`}
                  />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}

      {tab === "gradebook" ? <Gradebook /> : null}
      {tab === "announce" ? <AnnouncementComposer onSent={load} /> : null}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-bold">{value ?? 0}</dd>
    </div>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function reviewLabel(state) {
  if (state === "reviewed") return "reviewed, not published";
  if (state === "in_review") return "being reviewed";
  return "waiting";
}
