import { NavLink } from "react-router-dom";

const SECTIONS = [
  {
    id: "learn",
    label: "Learn",
    to: "/academy/lessons",
    links: [
      { label: "Lessons", to: "/academy/lessons" },
      { label: "Materials", to: "/academy/materials" },
      { label: "Course", to: "/academy/courses" },
    ],
  },
  {
    id: "work",
    label: "My work",
    to: "/academy/assignments",
    links: [
      { label: "Assignments", to: "/academy/assignments" },
      { label: "Projects", to: "/academy/projects" },
    ],
  },
  {
    id: "progress",
    label: "Progress",
    to: "/academy/progress",
    // The first link is the section's own primary destination and is rendered
    // as the section button itself, so Examinations sits after it to actually
    // appear in the row.
    links: [
      { label: "My progress", to: "/academy/progress" },
      { label: "Examinations", to: "/academy/exams" },
      { label: "Leaderboard", to: "/academy/leaderboard" },
    ],
  },
];

export default function StudentSectionNav() {
  return (
    <nav
      aria-label="Academy sections"
      className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800"
    >
      {SECTIONS.flatMap((section) => [
        <NavLink
          key={`${section.id}-primary`}
          to={section.to}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            }`
          }
        >
          {section.label}
        </NavLink>,
        ...section.links.slice(1).map((link) => (
          <NavLink
            key={`${section.id}-${link.to}`}
            to={link.to}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-100"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`
            }
          >
            {link.label}
          </NavLink>
        )),
      ])}
    </nav>
  );
}
