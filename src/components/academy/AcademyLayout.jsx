import { useEffect, useRef } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";
import { useTheme } from "../../context/useTheme";
import {
  heartbeatAcademyLearningSession,
  startAcademyLearningSession,
} from "../../lib/academy";

const links = [
  { label: "Dashboard", to: "/academy/dashboard" },
  { label: "Courses", to: "/academy/courses" },
  { label: "Lessons", to: "/academy/lessons" },
  { label: "Practice", to: "/academy/practice" },
  { label: "Assignments", to: "/academy/assignments" },
  { label: "Progress", to: "/academy/progress" },
  { label: "Projects", to: "/academy/projects" },
  { label: "Leaderboard", to: "/academy/leaderboard" },
  { label: "Notifications", to: "/academy/notifications" },
  { label: "Live classroom", to: "/academy/live" },
];

const teacherLinks = [
  { label: "Teacher dashboard", to: "/academy/teacher" },
  { label: "Students", to: "/academy/teacher/students" },
  { label: "Courses", to: "/academy/teacher/courses" },
  { label: "Lessons", to: "/academy/teacher/lessons" },
  { label: "Analytics", to: "/academy/teacher/analytics" },
  { label: "Classes", to: "/academy/teacher/classes" },
  { label: "Assignments", to: "/academy/teacher/assignments" },
  { label: "Submissions", to: "/academy/teacher/submissions" },
];

const adminLinks = [
  { label: "Admin overview", to: "/academy/admin" },
  { label: "Students", to: "/academy/admin/students" },
  { label: "Access", to: "/academy/admin/access" },
  { label: "Manage courses", to: "/academy/teacher/courses" },
  { label: "Manage lessons", to: "/academy/teacher/lessons" },
  { label: "Student analytics", to: "/academy/teacher/analytics" },
  { label: "Assignments", to: "/academy/teacher/assignments" },
  { label: "Submissions", to: "/academy/teacher/submissions" },
  { label: "Live classroom", to: "/academy/live" },
];

export default function AcademyLayout() {
  const { profile, user, signOut, isAdmin, isTeacher, isStudent } =
    useAcademyAuth();
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const learningSession = useRef(null);
  const lastActivity = useRef(Date.now());
  const displayName =
    profile?.display_name || user?.email?.split("@")[0] || "Student";
  const accessLabel = isAdmin ? "Admin" : isTeacher ? "Teacher" : "Student";

  useEffect(() => {
    if (!isStudent) return undefined;
    let cancelled = false;
    startAcademyLearningSession(pathname).then(({ data }) => {
      if (!cancelled) learningSession.current = data;
    });

    const markActivity = () => {
      lastActivity.current = Date.now();
    };
    const activityEvents = ["pointerdown", "keydown", "scroll", "mousemove"];
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, markActivity, { passive: true }),
    );
    const heartbeat = window.setInterval(() => {
      const activeRecently = Date.now() - lastActivity.current <= 60000;
      if (
        document.visibilityState === "visible" &&
        activeRecently &&
        learningSession.current
      ) {
        heartbeatAcademyLearningSession(learningSession.current.id, pathname);
      }
    }, 30000);
    const recordVisibleTime = () => {
      if (document.visibilityState === "visible" && learningSession.current) {
        lastActivity.current = Date.now();
        return;
      }
      if (learningSession.current) {
        heartbeatAcademyLearningSession(learningSession.current.id, pathname);
      }
    };
    document.addEventListener("visibilitychange", recordVisibleTime);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", recordVisibleTime);
      if (learningSession.current) {
        heartbeatAcademyLearningSession(learningSession.current.id, pathname);
      }
      activityEvents.forEach((eventName) =>
        window.removeEventListener(eventName, markActivity),
      );
      learningSession.current = null;
    };
  }, [isStudent, pathname, user.id]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:gap-4 sm:px-6">
          <Link
            to={isAdmin ? "/academy/admin" : "/academy/dashboard"}
            className="flex min-w-0 shrink-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
            aria-label="Academy dashboard"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              A
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-wide">
                {isAdmin ? "ATE Academy Admin" : "ATE Academy"}
              </span>
              <span className="block max-w-[13rem] truncate text-xs text-slate-500 dark:text-slate-400">
                Software, embedded, and AI/ML
              </span>
            </span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none sm:gap-3">
            <button
              type="button"
              className="button-secondary min-h-9 px-2 py-1.5 text-xs sm:px-3 sm:text-sm"
              onClick={toggle}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <span className="min-w-0 max-w-[9rem] text-right sm:max-w-[14rem]">
              <span className="hidden truncate text-sm text-slate-600 dark:text-slate-300 sm:block">
                {displayName}
              </span>
              <span className="block truncate rounded-full bg-cyan-50 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300">
                {accessLabel}
              </span>
            </span>
            <button
              type="button"
              className="button-secondary min-h-9 shrink-0 px-2 py-1.5 text-xs sm:px-3 sm:text-sm"
              onClick={signOut}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <nav
          aria-label="Academy navigation"
          className="flex snap-x gap-1 overflow-x-auto pb-1 lg:w-52 lg:flex-col lg:gap-2 lg:overflow-visible"
        >
          {(isAdmin
            ? adminLinks
            : isTeacher
              ? teacherLinks
              : isStudent
                ? links
                : []
          ).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `snap-start whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 sm:px-3 sm:text-sm ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
      <footer className="mt-10 w-full border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-500 dark:text-slate-400 sm:px-6">
          Algorise Tech Explorers (ATE) · ATE Academy · RC No. RC-8665201
        </div>
      </footer>
    </div>
  );
}
