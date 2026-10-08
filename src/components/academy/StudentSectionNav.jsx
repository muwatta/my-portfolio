import { NavLink } from "react-router-dom";
import {
  FiAward,
  FiBookOpen,
  FiBriefcase,
  FiFileText,
  FiLayers,
} from "react-icons/fi";

const SECTIONS = [
  { label: "Courses", to: "/academy/courses", icon: FiLayers },
  { label: "Materials", to: "/academy/materials", icon: FiBookOpen },
  { label: "Projects", to: "/academy/projects", icon: FiBriefcase },
  { label: "Tests", to: "/academy/exams", icon: FiFileText },
  { label: "Leaderboard", to: "/academy/leaderboard", icon: FiAward },
];

export default function StudentSectionNav() {
  return (
    <nav
      aria-label="More student sections"
      className="mb-4 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2.5 dark:border-slate-800"
    >
      {SECTIONS.map(({ label, to, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors ${
              isActive
                ? "border-amber-400 bg-amber-300 text-slate-950 shadow-sm shadow-amber-900/15"
                : "border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            }`
          }
        >
          <Icon aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
