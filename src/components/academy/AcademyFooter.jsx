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

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950";

// No link columns. Navigation already lives in the tab bar and the student nav,
// so repeating it here made the footer taller for no benefit. The only route the
// footer offers is help, which is what a footer is actually for.

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
      className="h-4 w-4 shrink-0 fill-current"
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
      className="h-4 w-4 shrink-0 fill-none stroke-current"
      strokeWidth="1.8"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6 8.5-6" strokeLinecap="round" strokeLinejoin="round" />
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

function ContactLink({ href, external, icon, children, ariaLabel }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      aria-label={ariaLabel}
      className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm text-slate-600 transition-colors motion-reduce:transition-none hover:text-cyan-700 dark:text-slate-400 dark:hover:text-cyan-300 ${FOCUS_RING}`}
    >
      {icon}
      {children}
    </a>
  );
}

export default function AcademyFooter({ isPublic = false }) {
  const year = new Date().getFullYear();
  const online = useOnlineStatus();
  // Leave room for the bottom tab bar on phones inside the app, and for the
  // home indicator on notched devices.
  const bodyPadding = isPublic
    ? "pb-[max(1.5rem,env(safe-area-inset-bottom))]"
    : "pb-24 lg:pb-8";

  return (
    <footer
      className={`relative mt-auto border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 ${
        isPublic ? "mt-8 sm:mt-12" : ""
      }`}
      aria-labelledby="academy-footer-heading"
    >
      <h2 id="academy-footer-heading" className="sr-only">
        Algorise Tech Explorers Academy footer
      </h2>

      <div
        className={`mx-auto max-w-6xl px-4 py-8 sm:px-6 ${bodyPadding}`}
      >
        {/* Brand, link columns and contact share one row on a desktop, so the
            footer is roughly two screens tall at worst instead of a page. */}
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)] sm:items-start">
          <div>
            <div className="flex items-center gap-2.5">
              <img
                src="/images/ate-icon-192.png"
                alt=""
                width="32"
                height="32"
                className="h-8 w-8 shrink-0 rounded-lg"
              />
              <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
                Algorise Tech Explorers
              </p>
            </div>
            <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500 dark:text-slate-400">
              RC No. RC-8665201 &middot; Registered in Nigeria
            </p>
            <p
              role="status"
              aria-live="polite"
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                online
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${
                  online ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {online ? "Online" : "Offline, work will sync"}
            </p>
          </div>


          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-900 dark:text-slate-100">
              Need help?
            </h3>
            <ul className="mt-2 space-y-0.5">
              <li>
                <ContactLink
                  href={WHATSAPP_HREF}
                  external
                  icon={<WhatsAppIcon />}
                  ariaLabel={`Chat with us on WhatsApp at ${WHATSAPP_DISPLAY}`}
                >
                  WhatsApp {WHATSAPP_DISPLAY}
                </ContactLink>
              </li>
              <li>
                <ContactLink
                  href={EMAIL_HREF}
                  icon={<MailIcon />}
                  ariaLabel={`Email us at ${EMAIL}`}
                >
                  {EMAIL}
                </ContactLink>
              </li>
              <li>
                <Link
                  to="/academy/faq"
                  className={`inline-flex min-h-11 items-center rounded-lg px-1 text-sm text-slate-600 transition-colors motion-reduce:transition-none hover:text-cyan-700 dark:text-slate-400 dark:hover:text-cyan-300 ${FOCUS_RING}`}
                >
                  Read the FAQ
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <p>&copy; {year} Algorise Tech Explorers. All rights reserved.</p>
          <button
            type="button"
            onClick={scrollToTop}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 font-semibold text-slate-600 transition-colors motion-reduce:transition-none hover:text-cyan-700 dark:text-slate-400 dark:hover:text-cyan-300 ${FOCUS_RING}`}
          >
            <ArrowUpIcon />
            Back to top
          </button>
        </div>
      </div>
    </footer>
  );
}
