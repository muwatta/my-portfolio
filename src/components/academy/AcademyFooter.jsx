import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const WHATSAPP_NUMBER = "2348142797233";
const WHATSAPP_DISPLAY = "+234 814 279 7233";
const EMAIL = "abdullahimusliudeen@gmail.com";

const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hello Algorise Tech Explorers, I need help with my learning account.",
)}`;
const EMAIL_HREF = `mailto:${EMAIL}?subject=${encodeURIComponent(
  "Help with my learning account",
)}`;

// Short answers to what students ask most. The full list lives at /academy/faq.
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

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950";

function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}

function scrollToTop() {
  const reduce = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-6 w-6 shrink-0 fill-current"
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
      className="h-6 w-6 shrink-0"
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
      className="h-4 w-4 shrink-0 fill-none stroke-current text-slate-400 transition-transform duration-200 motion-reduce:transition-none group-open:rotate-180 dark:text-slate-500"
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

function ArrowUpIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="h-4 w-4 fill-none stroke-current"
    >
      <path
        d="m5 12.5 5-5 5 5"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// One tappable contact row: icon, label, and the real number or address
// shown in text so nobody has to long-press to find out what it is.
function ContactCard({ href, external, icon, label, detail, tone, ariaLabel }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      aria-label={ariaLabel}
      className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors ${tone} ${FOCUS_RING}`}
    >
      {icon}
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block truncate text-xs opacity-80">{detail}</span>
      </span>
    </a>
  );
}

export default function AcademyFooter({ isPublic = false }) {
  const year = new Date().getFullYear();
  const online = useOnlineStatus();
  // Leave room for the bottom tab bar on phones inside the app, and for the
  // home indicator on notched devices.
  const bodyPadding = isPublic
    ? "pb-[max(2rem,env(safe-area-inset-bottom))]"
    : "pb-24 lg:pb-10";

  return (
    <footer
      className={`relative border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 ${
        isPublic ? "mt-8 sm:mt-12" : "mt-auto"
      }`}
      aria-labelledby="academy-footer-heading"
    >
      {/* Thin brand accent along the top edge */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"
      />

      <h2 id="academy-footer-heading" className="sr-only">
        Algorise Tech Explorers Academy footer
      </h2>

      <div
        className={`mx-auto max-w-2xl px-4 pt-8 sm:px-6 sm:pt-12 ${bodyPadding}`}
      >
        {/* Identity */}
        <div className="flex items-center gap-3">
          <img
            src="/images/ate-icon-192.png"
            alt=""
            width="48"
            height="48"
            className="h-12 w-12 shrink-0 rounded-xl"
          />
          <div className="min-w-0">
            <p className="text-base font-bold text-slate-900 dark:text-slate-50">
              Algorise Tech Explorers
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Learning platform
            </p>
          </div>
        </div>

        {/* Contact */}
        <section className="mt-6" aria-labelledby="academy-footer-help-heading">
          <h3
            id="academy-footer-help-heading"
            className="text-sm font-bold text-slate-900 dark:text-slate-50"
          >
            Need help with your account?
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Message us and we will get back to you.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ContactCard
              href={WHATSAPP_HREF}
              external
              icon={<WhatsAppIcon />}
              label="Chat on WhatsApp"
              detail={WHATSAPP_DISPLAY}
              ariaLabel={`Chat with us on WhatsApp at ${WHATSAPP_DISPLAY}`}
              tone="border-emerald-600 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100 focus-visible:ring-emerald-600 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
            />
            <ContactCard
              href={EMAIL_HREF}
              icon={<MailIcon />}
              label="Send an email"
              detail={EMAIL}
              ariaLabel={`Email us at ${EMAIL}`}
              tone="border-slate-300 text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            />
          </div>
        </section>

        {/* Short answers. Only one open at a time to keep the page short. */}
        <section
          className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800"
          aria-labelledby="academy-footer-faq-heading"
        >
          <h3
            id="academy-footer-faq-heading"
            className="text-sm font-bold text-slate-900 dark:text-slate-50"
          >
            Common questions
          </h3>
          <div className="mt-3 space-y-2">
            {QUICK_QUESTIONS.map((item) => (
              <details
                key={item.q}
                name="academy-footer-faq"
                className="group rounded-xl border border-slate-200 bg-slate-50/60 transition-colors open:border-cyan-400 open:bg-cyan-50/50 dark:border-slate-800 dark:bg-slate-900/60 dark:open:border-cyan-600 dark:open:bg-cyan-950/20"
              >
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-slate-800 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950 [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <Chevron />
                </summary>
                <p className="px-4 pb-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
          <Link
            to="/academy/faq"
            className={`mt-2 inline-flex min-h-11 items-center rounded-lg px-1 text-sm font-semibold text-cyan-700 hover:underline focus-visible:ring-cyan-500 dark:text-cyan-300 ${FOCUS_RING}`}
          >
            See all questions and answers
          </Link>
        </section>
      </div>

      {/* Status and legal */}
      <div className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              role="status"
              aria-live="polite"
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                online
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  online ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {online
                ? "Online. Your progress is syncing."
                : "Offline. Your work will sync when you reconnect."}
            </p>

            <button
              type="button"
              onClick={scrollToTop}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:ring-cyan-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 ${FOCUS_RING}`}
            >
              <ArrowUpIcon />
              Back to top
            </button>
          </div>

          <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            <p>
              Algorise Tech Explorers &middot; RC No. RC-8665201 &middot;
              Registered in Nigeria
            </p>
            <p>&copy; {year} Algorise Tech Explorers. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
