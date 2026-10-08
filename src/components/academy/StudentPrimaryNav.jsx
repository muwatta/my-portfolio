import { NavLink } from "react-router-dom";
import { STUDENT_NAVIGATION } from "./studentNavigation";

export default function StudentPrimaryNav() {
  return (
    <nav
      aria-label="Student navigation"
      className="mb-5 hidden flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex"
    >
      {STUDENT_NAVIGATION.map(({ label, to, icon: Icon, end = false }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
              isActive
                ? "bg-amber-100 text-amber-950 dark:bg-amber-400/20 dark:text-amber-200"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            }`
          }
        >
          <Icon aria-hidden="true" className="shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
