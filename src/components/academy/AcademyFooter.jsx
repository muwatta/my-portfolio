import { Link } from "react-router-dom";

const WHATSAPP_NUMBER = "2348142797233";
const WHATSAPP_DISPLAY = "+234 814 279 7233";
const EMAIL = "abdullahimusliudeen@gmail.com";

const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hello Algorise Tech Explorers, I need help with my learning account.",
)}`;
const EMAIL_HREF = `mailto:${EMAIL}`;

// Short answers to what students ask most. The full list lives at /academy/faq,
// so this stays deliberately small rather than repeating the whole page.
const QUICK_QUESTIONS = [
  {
    q: "How do I sign in?",
    a: "Use the email and password from your instructor. Forgotten it? Request a reset link from the sign-in page, then choose a new password.",
  },
  {
    q: "Can I learn without internet?",
    a: "Yes. Download a week from its overview page and its lessons, exercises and materials are stored on your device. Work is queued and synced when you reconnect.",
  },
  {
    q: "How is my code checked?",
    a: "You submit your code and the Academy runs it against hidden test cases on the server, then shows which tests passed and which failed.",
  },
  {
    q: "Where do I see my marks?",
    a: "Open Progress for your completion and scores, and Leaderboard for your standing. Both read from the server, so they match on every device.",
  },
];

// Only links that the app's own navigation does not already cover, so the
// footer adds something rather than repeating the tab bar.
const QUICK_LINKS = {
  id: "quick",
  title: "Quick links",
  links: [
    { label: "Lessons", to: "/academy/lessons" },
    { label: "Assignments", to: "/academy/assignments" },
    { label: "Projects", to: "/academy/projects" },
    { label: "Materials", to: "/academy/materials" },
    { label: "Leaderboard", to: "/academy/leaderboard" },
  ],
};

const PUBLIC_QUICK_LINKS = {
  id: "public-quick",
  title: "Quick links",
  links: [
    { label: "Academy login", to: "/academy/login" },
    { label: "Create an account", to: "/academy/signup" },
    { label: "Help and FAQ", to: "/academy/faq" },
  ],
};

const SUPPORT_LINKS = {
  id: "support",
  title: "Support",
  links: [
    { label: "Live classroom", to: "/academy/live" },
    { label: "Notifications", to: "/academy/notifications" },
  ],
};

const PUBLIC_SUPPORT_LINKS = {
  id: "public-support",
  title: "Support",
  links: [{ label: "Back to the portfolio", to: "/" }],
};

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950";

const contactLinkClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors";

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

function Chevron() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 fill-none stroke-current text-slate-400 transition-transform duration-200 group-open:rotate-180 dark:text-slate-500"
    >
      <path
        d="m5 7.5 5 5 5-5"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AcademyFooter({ isPublic = false }) {
  const year = new Date().getFullYear();
  const groups = [
    isPublic ? PUBLIC_QUICK_LINKS : QUICK_LINKS,
    isPublic ? PUBLIC_SUPPORT_LINKS : SUPPORT_LINKS,
  ];
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

      <div
        className={`mx-auto max-w-5xl px-4 py-12 sm:px-6 ${bodyPadding}`}
      >
        {/* Identity */}
        <div className="text-center">
          <img
            src="/images/ate-icon-192.png"
            alt=""
            width="56"
            height="56"
            className="mx-auto h-14 w-14"
          />
          <p className="mt-4 text-base font-bold tracking-wide text-slate-900 dark:text-slate-50">
            Algorise Tech Explorers
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Learning platform
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Practical, project based learning in Python for AI and machine
            learning, and C++ for embedded systems and robotics. Download a course
            to keep learning without a connection.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
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

        {/* Grouped navigation */}
        <div className="mt-10 grid gap-8 border-t border-slate-200 pt-8 sm:grid-cols-2 dark:border-slate-800">
          {groups.map((group) => (
            <nav key={group.id} aria-label={group.title}>
              <h3 className="text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-500 sm:text-left dark:text-slate-400">
                {group.title}
              </h3>
              <ul className="mt-3 flex flex-wrap justify-center gap-x-1 sm:justify-start">
                {group.links.map((link) => (
                  <li key={`${group.id}-${link.to}-${link.label}`}>
                    <Link
                      to={link.to}
                      className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:text-cyan-700 focus-visible:ring-cyan-500 dark:text-slate-400 dark:hover:text-cyan-300 ${FOCUS_RING}`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Short answers, expandable so they do not take over the page */}
        <section
          className="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800"
          aria-labelledby="academy-footer-faq-heading"
        >
          <h3
            id="academy-footer-faq-heading"
            className="text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"
          >
            Common questions
          </h3>
          <div className="mx-auto mt-4 max-w-2xl space-y-2">
            {QUICK_QUESTIONS.map((item) => (
              <details
                key={item.q}
                className="group rounded-lg border border-slate-200 bg-slate-50/60 transition-colors open:border-cyan-400 open:bg-cyan-50/50 dark:border-slate-800 dark:bg-slate-900/60 dark:open:border-cyan-600 dark:open:bg-cyan-950/20"
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-left text-sm font-semibold text-slate-800 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950">
                  <span>{item.q}</span>
                  <Chevron />
                </summary>
                <p className="px-4 pb-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
          <p className="mt-4 text-center">
            <Link
              to="/academy/faq"
              className={`inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-cyan-700 hover:underline focus-visible:ring-cyan-500 dark:text-cyan-300 ${FOCUS_RING}`}
            >
              See all questions and answers
            </Link>
          </p>
        </section>
      </div>

      {/* Legal and status */}
      <div className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-5xl px-4 py-6 text-center sm:px-6">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Algorise Tech Explorers &middot; RC No. RC-8665201 &middot; Registered
            in Nigeria
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Learn anywhere. Progress syncs automatically when you reconnect.
          </p>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            &copy; {year} Algorise Tech Explorers. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
