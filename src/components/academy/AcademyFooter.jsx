import { Link } from "react-router-dom";

const WHATSAPP_NUMBER = "2348142797233";
const WHATSAPP_DISPLAY = "+234 814 279 7233";
const EMAIL = "abdullahimusliudeen@gmail.com";

const WHATSAPP_MESSAGE = encodeURIComponent(
  "Hello Algorise Tech Explorers, I need help with my learning account.",
);
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;
const EMAIL_HREF = `mailto:${EMAIL}`;

const LINK_GROUPS = [
  {
    id: "learn",
    title: "Learn",
    links: [
      { label: "Dashboard", to: "/academy/dashboard" },
      { label: "Lessons", to: "/academy/lessons" },
      { label: "Practice", to: "/academy/practice" },
      { label: "Assignments", to: "/academy/assignments" },
      { label: "Projects", to: "/academy/projects" },
      { label: "Materials", to: "/academy/materials" },
    ],
  },
  {
    id: "record",
    title: "My record",
    links: [
      { label: "Live classroom", to: "/academy/live" },
      { label: "Progress", to: "/academy/progress" },
      { label: "Leaderboard", to: "/academy/leaderboard" },
      { label: "Notifications", to: "/academy/notifications" },
      { label: "Profile", to: "/academy/profile" },
    ],
  },
];

const PUBLIC_LINK_GROUPS = [
  {
    id: "start",
    title: "Start learning",
    links: [
      { label: "Academy login", to: "/academy/login" },
      { label: "Create an account", to: "/academy/signup" },
    ],
  },
  {
    id: "elsewhere",
    title: "Algorise Tech Explorers",
    links: [{ label: "Back to the portfolio", to: "/" }],
  },
];

// Shared focus-ring treatment so every interactive element in the footer
// gets the same, single definition of its focus style.
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950";

const linkClass = `inline-flex min-h-11 items-center rounded-lg px-1 text-sm font-medium text-slate-600 transition-colors hover:text-blue-700 dark:text-slate-400 dark:hover:text-cyan-300 focus-visible:ring-cyan-500 ${FOCUS_RING}`;

const contactLinkClass =
  "inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors";

function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 fill-current"
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.8-.23-.09-.39-.13-.56.12-.16.25-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.09-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path
        d="m3.5 6.5 8.5 6 8.5-6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AcademyFooter({ isPublic = false }) {
  const year = new Date().getFullYear();
  const groups = isPublic ? PUBLIC_LINK_GROUPS : LINK_GROUPS;
  const bodyPadding = isPublic ? "" : "pb-24 lg:pb-10";

  return (
    <footer
      className={`border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 ${
        isPublic ? "mt-12" : "mt-auto"
      }`}
      aria-labelledby="academy-footer-heading"
    >
      <h2 id="academy-footer-heading" className="sr-only">
        Algorise Tech Explorers Academy footer
      </h2>

      <div className={`mx-auto max-w-7xl px-4 py-10 sm:px-6 ${bodyPadding}`}>
        <div className="grid gap-10 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <div className="flex items-center gap-3">
              <img
                src="/images/ate-icon-192.png"
                alt=""
                width="44"
                height="44"
                className="h-11 w-11"
              />
              <div>
                <p className="text-sm font-bold tracking-wide text-slate-900 dark:text-slate-50">
                  Algorise Tech Explorers
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Learning platform
                </p>
              </div>
            </div>

            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-400">
              Practical, project based learning in Python for AI and machine
              learning, and C++ for embedded systems and robotics. Download a
              course to keep learning without a connection.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Chat with us on WhatsApp at ${WHATSAPP_DISPLAY}`}
                title={WHATSAPP_DISPLAY}
                className={`${contactLinkClass} border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40 focus-visible:ring-emerald-600 ${FOCUS_RING}`}
              >
                <WhatsAppIcon />
                <span>Chat on WhatsApp</span>
              </a>

              <a
                href={EMAIL_HREF}
                aria-label={`Email us at ${EMAIL}`}
                title={EMAIL}
                className={`${contactLinkClass} border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 focus-visible:ring-slate-500 ${FOCUS_RING}`}
              >
                <MailIcon />
                <span>Email us</span>
              </a>
            </div>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            {groups.map((group) => (
              <nav key={group.id} aria-label={`${group.title} links`}>
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {group.title}
                </h3>
                <ul className="mt-3 space-y-1">
                  {group.links.map((link) => (
                    <li key={`${group.id}-${link.to}-${link.label}`}>
                      <Link to={link.to} className={linkClass}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-slate-400">
          <p>&copy; {year} Algorise Tech Explorers. All rights reserved.</p>
          <p>
            Learn anywhere. Progress syncs automatically when you reconnect.
          </p>
        </div>
      </div>
    </footer>
  );
}
