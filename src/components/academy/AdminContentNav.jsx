import { NavLink } from "react-router-dom";

const CONTENT_SECTIONS = [
  { label: "Overview", to: "/academy/admin/content", end: true },
  { label: "Courses", to: "/academy/admin/courses" },
  { label: "Lessons", to: "/academy/admin/lessons" },
  { label: "Practice", to: "/academy/admin/practice" },
  { label: "Assignments", to: "/academy/admin/assignments" },
  { label: "Projects", to: "/academy/admin/projects" },
  { label: "Materials", to: "/academy/admin/materials" },
  { label: "Levels", to: "/academy/admin/levels" },
];

export default function AdminContentNav({ active }) {
  return (
    <nav
      aria-label="Academy content sections"
      className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800"
    >
      {CONTENT_SECTIONS.map((section) => (
        <NavLink
          key={section.to}
          to={section.to}
          end={section.end}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              isActive || active === section.to
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            }`
          }
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}
