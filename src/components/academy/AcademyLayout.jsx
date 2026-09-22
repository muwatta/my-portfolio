import { useEffect, useRef, useState } from "react";
import { FiMenu, FiX } from "react-icons/fi";
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
  const [navigationOpen, setNavigationOpen] = useState(false);
  const learningSession = useRef(null);
  const lastActivity = useRef(Date.now());
  const displayName =
    profile?.display_name || user?.email?.split("@")[0] || "Student";
  const accessLabel = isAdmin ? "Admin" : isTeacher ? "Teacher" : "Student";
  const navigationLinks = isAdmin
    ? adminLinks
    : isTeacher
      ? teacherLinks
      : isStudent
        ? links
        : [];

  useEffect(() => {
    setNavigationOpen(false);
  }, [pathname]);

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
        <div className="mx-auto flex min-h-20 max-w-7xl items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6">
          <button
            type="button"
            className="order-first grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-600 lg:hidden dark:border-slate-700 dark:text-slate-200"
            onClick={() => setNavigationOpen((open) => !open)}
            aria-label={navigationOpen ? "Close Academy navigation" : "Open Academy navigation"}
            aria-expanded={navigationOpen}
            aria-controls="academy-navigation"
          >
            {navigationOpen ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}
          </button>
          <Link
            to={isAdmin ? "/academy/admin" : "/academy/dashboard"}
            className="order-2 flex min-w-0 shrink-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 sm:order-none"
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
          <div className="order-3 ml-auto grid grid-cols-[auto_auto] items-center gap-2 sm:order-none sm:flex sm:min-w-0 sm:items-center sm:gap-3">
            <button
              type="button"
              className="button-secondary min-h-9 justify-center px-2 py-1.5 text-xs sm:px-3 sm:text-sm"
              onClick={toggle}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <span className="hidden min-w-0 max-w-[12rem] text-right sm:block sm:max-w-[14rem]">
              <span className="hidden truncate text-sm text-slate-600 dark:text-slate-300 sm:block">
                {displayName}
              </span>
              <span className="block truncate rounded-full bg-cyan-50 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300">
                {accessLabel}
              </span>
            </span>
            <button
              type="button"
              className="button-secondary min-h-9 shrink-0 justify-center px-2 py-1.5 text-xs sm:px-3 sm:text-sm"
              onClick={signOut}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      {navigationOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          aria-label="Close Academy navigation"
          onClick={() => setNavigationOpen(false)}
        />
      )}
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <nav
          id="academy-navigation"
          aria-label="Academy navigation"
          className={`${navigationOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 w-72 overflow-y-auto bg-white px-4 pb-6 pt-28 shadow-2xl transition-transform dark:bg-slate-950 lg:static lg:z-auto lg:block lg:w-52 lg:translate-x-0 lg:overflow-visible lg:bg-transparent lg:p-0 lg:shadow-none lg:transition-none`}
        >
          <div className="mb-4 border-b border-slate-200 pb-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-800 dark:text-slate-400 lg:hidden">
            Academy menu
          </div>
          <div className="flex flex-col gap-2">
          {navigationLinks.map((link) => (
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
          </div>
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
      <footer className="mt-10 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-[1fr_auto] sm:items-end sm:px-6">
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              ATE Academy
            </p>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
              Practical learning in Python for AI/ML and C++ for embedded systems.
            </p>
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              Algorise Tech Explorers (ATE) · RC No. RC-8665201
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <Link to="/academy/dashboard" className="hover:text-blue-600">Dashboard</Link>
            <Link to="/academy/assignments" className="hover:text-blue-600">Assignments</Link>
            <Link to="/" className="hover:text-blue-600">Portfolio</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
