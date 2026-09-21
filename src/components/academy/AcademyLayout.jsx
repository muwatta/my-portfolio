import { NavLink, Outlet, Link } from "react-router-dom";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";
import { useTheme } from "../../context/useTheme";

const links = [
  { label: "Dashboard", to: "/academy/dashboard" },
  { label: "Lessons", to: "/academy/lessons" },
  { label: "Practice", to: "/academy/practice" },
  { label: "Assignments", to: "/academy/assignments" },
  { label: "Progress", to: "/academy/progress" },
  { label: "Projects", to: "/academy/projects" },
];

export default function AcademyLayout() {
  const { profile, user, signOut } = useAcademyAuth();
  const { theme, toggle } = useTheme();
  const displayName =
    profile?.display_name || user?.email?.split("@")[0] || "Student";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            to="/academy/dashboard"
            className="flex items-center gap-3"
            aria-label="Academy dashboard"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              A
            </span>
            <span>
              <span className="block text-sm font-bold tracking-wide">
                Academy
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Python to AI/ML
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="button-secondary min-h-9 px-3 py-1.5"
              onClick={toggle}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <span className="hidden text-sm text-slate-600 dark:text-slate-300 sm:inline">
              {displayName}
            </span>
            <button
              type="button"
              className="button-secondary min-h-9 px-3 py-1.5"
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
          className="flex gap-2 overflow-x-auto pb-1 lg:w-52 lg:flex-col lg:overflow-visible"
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
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
    </div>
  );
}
