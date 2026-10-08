import { NavLink } from "react-router-dom";

const CONTENT_SECTIONS = [
  { label: "Overview", to: "/academy/admin/content", end: true },
  { label: "Courses", to: "/academy/admin/courses" },
  { label: "Lessons", to: "/academy/admin/lessons" },
  { label: "Question bank", to: "/academy/admin/question-bank" },
  { label: "Exam builder", to: "/academy/admin/exams" },
  { label: "Exam results", to: "/academy/admin/exam-results" },
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
                ? "bg-amber-400 text-slate-950"
                : "bg-white text-slate-700 hover:bg-amber-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            }`
          }
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}
