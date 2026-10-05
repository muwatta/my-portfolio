import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiAward, FiBookOpen, FiClock, FiTarget, FiZap } from "react-icons/fi";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import {
  getAcademyAssignments,
  getAcademyProgress,
  getAcademyStudentHome,
  getAcademyStudentOverview,
} from "../lib/academy";
import ProgressBar from "../components/academy/ProgressBar";
import NetworkRescue from "../components/academy/NetworkRescue";
import PasswordPolicyNotice from "../components/academy/PasswordPolicyNotice";
import { fetchWithOfflineFallback } from "../lib/academyOffline";
import { OFFLINE_STORES } from "../lib/offlineStore";

export default function AcademyDashboard() {
  const { profile, user } = useAcademyAuth();
  const name = profile?.display_name || user?.email?.split("@")[0] || "Student";
  const [progress, setProgress] = useState(null);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [assignments, setAssignments] = useState([]);
  const [overview, setOverview] = useState(null);
  const [home, setHome] = useState(null);
  const [homeOffline, setHomeOffline] = useState(false);
  const [reload, setReload] = useState(0);
  const [sectionState, setSectionState] = useState({
    progress: "loading",
    assignments: "loading",
    overview: "loading",
    home: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    const loadSection = (key, request, onData, store, id) => {
      fetchWithOfflineFallback({
        userId: user.id,
        store,
        id,
        fetcher: request,
      })
        .then((result) => {
          if (cancelled) return;
          onData(result.data ?? null);
          setSectionState((current) => ({
            ...current,
            [key]: result.error ? "error" : "ready",
          }));
        })
        .catch(() => {
          if (!cancelled) {
            setSectionState((current) => ({ ...current, [key]: "error" }));
          }
        });
    };
    loadSection(
      "progress",
      () => getAcademyProgress(user.id),
      setProgress,
      OFFLINE_STORES.progress,
      "summary",
    );
    loadSection(
      "assignments",
      () => getAcademyAssignments(user.id),
      (data) => {
        setAssignments(data ?? []);
        setAssignmentCount(data?.length ?? 0);
      },
      OFFLINE_STORES.assignments,
    );
    loadSection(
      "overview",
      () => getAcademyStudentOverview(user.id),
      setOverview,
      OFFLINE_STORES.progress,
      "overview",
    );
    getAcademyStudentHome(user.id)
      .then((result) => {
        if (cancelled) return;
        setHome(result.data ?? null);
        setHomeOffline(Boolean(result.offline));
        setSectionState((current) => ({
          ...current,
          home: result.error ? "error" : "ready",
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setSectionState((current) => ({ ...current, home: "error" }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, reload]);

  // A failed section is usually the network, not a broken app. Say so plainly
  // and offer something to do, rather than showing an empty dashboard.
  const anyFailed = Object.values(sectionState).some(
    (value) => value === "error",
  );

  // The database decides what comes next, because only it knows the unlock chain
  // and which topics have actually been released.
  const resumeLesson = home?.continueLesson ?? home?.nextLesson ?? null;
  const dueSoon = home?.dueSoon ?? [];
  const course = home?.course ?? overview?.enrollment?.academy_courses;
  const learningMinutes = Math.floor((overview?.learningSeconds ?? 0) / 60);
  const hasCourse = Boolean(course);
  const dueSoonIds = new Set(dueSoon.map((task) => task.assignment_id));
  const dashboardAssignments = [
    ...dueSoon,
    ...assignments.filter((assignment) => !dueSoonIds.has(assignment.id)),
  ].slice(0, 4);

  return (
    <div className="space-y-8">
      {anyFailed && (
        <NetworkRescue onRetry={() => setReload((value) => value + 1)} />
      )}
      {homeOffline && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          You’re viewing your saved learning snapshot. Work queued on this
          device will sync when you reconnect.
        </p>
      )}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-xl sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[28px] border-cyan-300/10" />
        <div className="pointer-events-none absolute -bottom-20 right-32 h-44 w-44 rounded-full bg-indigo-400/10 blur-2xl" />
        <div className="relative">
          <p className="inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
            Your learning journey
          </p>
          <p className="mt-4 text-sm font-semibold text-indigo-200">
            {course?.title || "Academy learning path"}
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl">
            Good to see you, {name}.
          </h1>
          {profile?.academy_registration_codes?.registration_number && (
            <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Academy Registration No.{" "}
              {profile.academy_registration_codes.registration_number}
            </p>
          )}
          <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
            {course?.title
              ? "Your learning path is ready. Pick up where you left off, one step at a time."
              : "Choose the learning path you want to explore. Once you pick a course, it becomes your current path."}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 sm:mt-6">
            <Link
              to={
                resumeLesson
                  ? `/academy/lessons/${resumeLesson.lesson_id}`
                  : hasCourse
                    ? "/academy/lessons"
                    : "/academy/courses"
              }
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-2 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:-translate-y-0.5 hover:bg-cyan-200 sm:w-auto"
            >
              <FiZap aria-hidden="true" />
              {resumeLesson
                ? home?.continueLesson
                  ? "Continue your quest"
                  : "Start next quest"
                : hasCourse
                  ? "Explore lessons"
                  : "Choose a learning path"}
            </Link>
          </div>
        </div>
      </section>
      {[
        sectionState.progress,
        sectionState.assignments,
        sectionState.overview,
        sectionState.home,
      ].includes("error") && (
        <p
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          Some dashboard sections are temporarily unavailable. The rest of your
          Academy remains usable.
        </p>
      )}
      <PasswordPolicyNotice userId={user.id} />
      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-5">
        {[
          {
            label: "Completed lessons",
            icon: FiBookOpen,
            value:
              progress == null ? "Loading" : (progress.completedLessons ?? 0),
            detail:
              progress == null
                ? "Progress is unavailable."
                : `${progress.lessonCount ?? 0} lessons in this course`,
          },
          {
            label: "Pending assignments",
            icon: FiTarget,
            value:
              sectionState.assignments === "error"
                ? "Unavailable"
                : assignmentCount,
            detail:
              sectionState.assignments === "error"
                ? "Assignments are unavailable."
                : assignmentCount
                  ? "Keep your next deadline in sight."
                  : "No assignments yet.",
          },
          {
            label: "Current week",
            icon: FiZap,
            value:
              progress?.currentWeek == null || course?.duration_weeks == null
                ? "Loading"
                : `${progress.currentWeek} / ${course.duration_weeks}`,
            detail:
              progress == null
                ? "Course position is unavailable."
                : "Calculated from completed lessons.",
          },
          {
            label: "Learning time",
            icon: FiClock,
            value: overview == null ? "Loading" : `${learningMinutes} min`,
            detail:
              overview == null
                ? "Learning time is unavailable."
                : "Server-recorded active Academy time.",
          },
          {
            label: "Recent badges",
            icon: FiAward,
            value:
              overview == null ? "Loading" : (overview.badges?.length ?? 0),
            detail:
              overview == null
                ? "Achievements are unavailable."
                : "Latest milestones from your learning journey.",
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="group rounded-2xl border border-t-2 border-t-cyan-400 border-slate-200 bg-white p-3 shadow-sm transition hover:border-cyan-300 hover:shadow-md sm:p-4 dark:border-slate-800 dark:border-t-cyan-500 dark:bg-slate-900 dark:hover:border-cyan-800"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                  <Icon aria-hidden="true" />
                </span>
                <p className="text-xs font-semibold leading-tight text-slate-600 sm:text-sm dark:text-slate-400">
                  {card.label}
                </p>
              </div>
              <p className="mt-3 text-xl font-extrabold tracking-tight tabular-nums sm:text-2xl">
                {card.value}
              </p>
              <p className="mt-1 hidden text-sm text-slate-600 sm:block dark:text-slate-300">
                {card.detail}
              </p>
            </div>
          );
        })}
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Your learning path
              </p>

              <h2 className="mt-2 text-xl font-bold">
                {course?.title || "Path pending"}
              </h2>

              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {course?.title
                  ? course.duration_weeks
                    ? `A ${course.duration_weeks}-week hands-on path. This is your current path. Switching requires your teacher.`
                    : "A hands-on path. This is your current path. Switching requires your teacher."
                  : "Choose your first path to start learning with hands-on lessons and projects."}
              </p>
            </div>
          </div>

          {hasCourse ? (
            <div className="mt-5">
              <ProgressBar
                value={progress?.completionPercent ?? 0}
                label="Course progress"
              />
            </div>
          ) : (
            <Link
              to="/academy/courses"
              className="button-primary mt-5 inline-flex w-full justify-center sm:w-auto"
            >
              Choose a learning path
            </Link>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Upcoming
          </p>

          {overview?.schedules?.[0] ? (
            <>
              <p className="mt-2 font-bold">{overview.schedules[0].title}</p>

              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {new Date(overview.schedules[0].starts_at).toLocaleString()}
              </p>

              {overview.schedules[0].activity_type === "live_class" &&
                overview.schedules[0].description?.startsWith(
                  "https://meet.google.com/",
                ) && (
                  <a
                    className="mt-4 inline-flex font-semibold text-blue-600"
                    href={overview.schedules[0].description}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Join live class
                  </a>
                )}
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              No scheduled activities yet.
            </p>
          )}

          <Link
            to="/academy/live"
            className="mt-4 inline-flex text-sm font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-300"
          >
            Open live classroom
          </Link>
        </div>
      </section>
      {hasCourse && (
        <section className="rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-indigo-50 p-6 shadow-sm dark:border-cyan-900 dark:from-cyan-950/50 dark:via-slate-900 dark:to-indigo-950/40">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
            {resumeLesson ? "Next step in your journey" : "Your next milestone"}
          </p>

          {resumeLesson ? (
            <>
              <h2 className="mt-2 text-xl font-bold">{resumeLesson.title}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Week {resumeLesson.week_number}
                {home?.totalCount
                  ? ` · ${home.completedCount} of ${home.totalCount} topics complete`
                  : ""}
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {home?.continueLesson
                  ? "You had already started this one. Pick it up where you left off."
                  : "This is the next topic unlocked for you."}
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-2 text-xl font-bold">
                {home?.totalCount
                  ? "You have completed every released topic"
                  : "Nothing is unlocked yet"}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {home?.totalCount
                  ? `All ${home.totalCount} topics are done. New topics appear here as soon as your teacher publishes them.`
                  : "Your teacher has not released any topics for this course yet."}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  className="button-secondary inline-flex"
                  to="/academy/notifications"
                >
                  Check notifications
                </Link>
              </div>
            </>
          )}
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">
              Your quest board
            </p>
            <h2 className="mt-1 text-xl font-bold">Tasks to tackle</h2>
          </div>
          <Link
            className="inline-flex min-h-11 items-center rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-amber-100 hover:text-amber-900 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-amber-950 dark:hover:text-amber-200"
            to="/academy/assignments"
          >
            Quest board
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {dashboardAssignments.map((assignment) => {
            const assignmentId = assignment.assignment_id ?? assignment.id;
            const dueSoonTask = dueSoonIds.has(assignmentId);
            return (
              <Link
                key={assignmentId}
                to={`/academy/assignments/${assignmentId}`}
                className="group rounded-2xl border border-slate-200 p-4 transition hover:border-amber-400 hover:bg-amber-50/60 dark:border-slate-800 dark:hover:bg-amber-950/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{assignment.title}</p>
                  {dueSoonTask && (
                    <span className="shrink-0 rounded-full bg-amber-200 px-2.5 py-1 text-xs font-bold text-amber-950 dark:bg-amber-900 dark:text-amber-100">
                      Due soon
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {assignment.due_at
                    ? `Due ${new Date(assignment.due_at).toLocaleDateString()}`
                    : "No due date"}
                </p>
              </Link>
            );
          })}
          {!dashboardAssignments.length && (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No tasks waiting. You’re all caught up!
            </p>
          )}
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Achievements
            </p>
            <h2 className="mt-1 text-xl font-bold">Earned badges</h2>
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {overview?.badges?.length ?? 0} earned
          </span>
        </div>
        {overview?.badges?.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overview.badges.map((badge) => (
              <div
                key={`${badge.academy_badges?.name}-${badge.awarded_at}`}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <p className="font-semibold">{badge.academy_badges?.name}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {badge.academy_badges?.description}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            Complete meaningful learning activities to earn your first badge.
          </p>
        )}
      </section>
    </div>
  );
}
