import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/seo/Seo";
import { ACADEMY } from "../data/academy";


const WHATSAPP_NUMBER = "2348142797233";
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hello Algorise Tech Explorers, I have a question about the Academy.",
)}`;

const SECTIONS = [
  {
    id: "getting-started",
    title: "Getting started",
    blurb: "Your account, signing in, and the courses you can see.",
    items: [
      {
        q: "How do I get an Academy account?",
        a: "Ask your instructor for your registration number, then choose Create an account on the Academy login screen. Registration numbers look like ATE-26-001 and are tied to your cohort and course.",
      },
      {
        q: "I forgot my password. What should I do?",
        a: "Use Forgot password on the login screen. We email a reset link, and the link opens the reset page where you choose a new password. The link expires, so request a fresh one if it has been sitting in your inbox.",
      },
      {
        q: "Why can I only see one course?",
        a: "Your account is linked to one active course at a time, so the Academy only shows the lessons and exercises that belong to it. If the wrong course appears, contact support and we will correct the link on your account.",
      },
      {
        q: "The page will not load and asks me to sign in again.",
        a: "Sessions expire after a period of inactivity. Sign in again and your progress is restored, because progress is stored on the server rather than only on your device.",
      },
    ],
  },
  {
    id: "lessons",
    title: "Lessons and practice",
    blurb: "Working through content and testing yourself.",
    items: [
      {
        q: "How do I open a lesson?",
        a: "Open Learn, then pick a week and a lesson from the overview. Lessons unlock in order, so a lesson stays locked until you complete the one before it. Instructors and admins can see every lesson, published or not.",
      },
      {
        q: "What is a lesson session, and where do live sessions happen?",
        a: "A lesson named Session 1 is a self-paced lesson in your course. Open it from Learn and follow its Learn, Practice and Task steps. A scheduled live class is separate; open Live from the Academy and choose the class your instructor shared.",
      },
      {
        q: "What is the difference between Practice and Assignments?",
        a: "Practice is for quick, low stakes checks on a single topic, and you can retry freely. Assignments are graded work with a due date and a limit on how many attempts you get.",
      },
      {
        q: "How is my code checked?",
        a: "You submit your code and the Academy runs it against hidden test cases on the server. You get feedback on which tests passed and which failed. The test cases themselves are never sent to your browser.",
      },
      {
        q: "Where do I write Python and C++?",
        a: "Both have a browser based editor with a terminal, so you do not need to install anything. Lessons mention which language they use, and the editor is set to match.",
      },
      {
        q: "Do I get an answer or a walkthrough?",
        a: "Yes. Once you have submitted an exercise, the explanation panel opens so you can see why the answer works and which concept it was testing.",
      },
    ],
  },
  {
    id: "submitting",
    title: "Assignments and submissions",
    blurb: "Handing in work and understanding your score.",
    items: [
      {
        q: "How do I submit an assignment?",
        a: "Open the assignment, paste or write your code, and choose Submit. The page shows a running status so you can tell whether your work is still being graded.",
      },
      {
        q: "How are scores calculated?",
        a: "Automated test cases produce an objective score. Your instructor can then add rubric feedback and adjust the final mark, so the score you see is the final one once feedback is applied.",
      },
      {
        q: "What if I lose connection while submitting?",
        a: "Your work is saved on your device and queued. The Academy retries automatically and tells you when it has synced, so a dropped connection does not lose your submission.",
      },
      {
        q: "Can I submit after the deadline?",
        a: "Only if your instructor has left the assignment open. Otherwise the submit button is disabled and the due date is shown on the assignment.",
      },
    ],
  },
  {
    id: "offline",
    title: "Working offline",
    blurb: "Downloading courses and learning without a connection.",
    items: [
      {
        q: "Can I learn without internet?",
        a: "Yes. Download a week from its overview page and its lessons, exercises and materials are stored on your device. Progress and submissions are queued and synced when you reconnect.",
      },
      {
        q: "What does the connection banner mean?",
        a: "It shows when you are offline, when a request is slow, and when queued work is waiting to sync. A slow connection is not the same as being offline, and neither one means your progress is lost.",
      },
      {
        q: "Will my work from two devices clash?",
        a: "No. The server is the source of truth. When a device reconnects, its queued work is sent up and the server decides what is newest, so the same lesson opened on a phone and a laptop stays consistent.",
      },
    ],
  },
  {
    id: "account-help",
    title: "Account and getting help",
    blurb: "Your profile, progress, and reaching a human.",
    items: [
      {
        q: "Where do I see my progress?",
        a: "Open Progress for your completion by week, your scores, and your standing on the leaderboard. Progress syncs from the server, so it is the same on every device you sign in from.",
      },
      {
        q: "How do I change my details?",
        a: "Open Profile. You can update your name and your notification preferences there. Your registration number is fixed, because it is what links your account to your course.",
      },
      {
        q: "Something is broken and I need a person.",
        a: "Use the WhatsApp button in the footer, or email us. Include the lesson or exercise name and what you expected to happen, and we can usually help the same day.",
      },
    ],
  },
];

function FaqItem({ question, answer }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white transition-colors open:border-cyan-400 open:bg-cyan-50/40 dark:border-slate-800 dark:bg-slate-900 dark:open:border-cyan-600 dark:open:bg-cyan-950/20">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950">
        <span>{question}</span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="h-5 w-5 shrink-0 fill-none stroke-current text-slate-400 transition-transform duration-200 group-open:rotate-180 dark:text-slate-500"
        >
          <path
            d="m5 7.5 5 5 5-5"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <p className="px-4 pb-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
        {answer}
      </p>
    </details>
  );
}

export default function AcademyFaq() {
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const needle = query.trim().toLowerCase();
  // Match the section heading too, so searching a topic word such as "offline"
  // surfaces every answer under that section.
  const sections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        needle === "" ||
        section.title.toLowerCase().includes(needle) ||
        section.blurb.toLowerCase().includes(needle) ||
        item.q.toLowerCase().includes(needle) ||
        item.a.toLowerCase().includes(needle),
    ),
  })).filter((section) => section.items.length > 0);

  const total = sections.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Same reason as the academy home page: a bot that runs JavaScript reads
          the live DOM, and without this it sees the portfolio's title and
          canonical. */}
      <Seo
        title={`Frequently Asked Questions | ${ACADEMY.name}`}
        description={`Answers about ${ACADEMY.name} courses, weekly structure, exercises, grading, hardware requirements, and how to get started.`}
        path={`${ACADEMY.path}/faq`}
      />
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Link
            to="/academy"
            className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <img
              src="/images/ate-icon-192.png"
              alt=""
              width="32"
              height="32"
              className="h-8 w-8"
            />
            <span className="text-sm font-bold text-slate-900 dark:text-slate-50">
              Algorise Tech Explorers
            </span>
          </Link>
          <Link
            to="/academy/login"
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-slate-600 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-slate-300 dark:hover:text-cyan-300"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-50">
          How to use the Academy
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-6 text-slate-600 dark:text-slate-400">
          Follow the steps below to find your course and lessons. Search or
          open a question if you need more help.
        </p>

        <section
          aria-labelledby="navigation-guide"
          className="mt-8 rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-5 dark:border-cyan-900 dark:from-cyan-950/40 dark:to-slate-900 sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2
                id="navigation-guide"
                className="text-lg font-extrabold text-slate-900 dark:text-slate-50"
              >
                Find your way around
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Course → week → lesson → practice or task.
              </p>
            </div>
            <Link
              to="/academy/dashboard"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold text-cyan-800 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 dark:text-cyan-200 dark:hover:bg-slate-800"
            >
              Resume from Home
            </Link>
          </div>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2">
            <li className="rounded-xl border border-cyan-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">
                1 · Choose your course
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Open Courses to see your learning path.
              </p>
              <Link
                to="/academy/courses"
                className="mt-3 inline-flex min-h-11 items-center font-bold text-cyan-800 underline decoration-cyan-300 underline-offset-4 hover:text-cyan-950 dark:text-cyan-200 dark:hover:text-white"
              >
                Go to Courses
              </Link>
            </li>
            <li className="rounded-xl border border-cyan-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">
                2 · Pick a week and lesson
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                In Learn, open a week, then choose an available lesson. Finish
                earlier lessons to unlock the next ones.
              </p>
              <Link
                to="/academy/lessons"
                className="mt-3 inline-flex min-h-11 items-center font-bold text-cyan-800 underline decoration-cyan-300 underline-offset-4 hover:text-cyan-950 dark:text-cyan-200 dark:hover:text-white"
              >
                Go to Learn
              </Link>
            </li>
            <li className="rounded-xl border border-cyan-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">
                3 · Follow the lesson steps
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Inside a lesson, use Learn for the material, Practice to try
                ideas, and Task to see work to hand in.
              </p>
              <Link
                to="/academy/lessons"
                className="mt-3 inline-flex min-h-11 items-center font-bold text-cyan-800 underline decoration-cyan-300 underline-offset-4 hover:text-cyan-950 dark:text-cyan-200 dark:hover:text-white"
              >
                Find a lesson
              </Link>
            </li>
            <li className="rounded-xl border border-cyan-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">
                4 · Join a live class
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Live classes are separate from self-paced lessons. Open Live
                when your instructor has scheduled or shared a session.
              </p>
              <Link
                to="/academy/live"
                className="mt-3 inline-flex min-h-11 items-center font-bold text-cyan-800 underline decoration-cyan-300 underline-offset-4 hover:text-cyan-950 dark:text-cyan-200 dark:hover:text-white"
              >
                Go to Live
              </Link>
            </li>
          </ol>
        </section>

        <div className="mt-8">
          <label htmlFor="faq-search" className="sr-only">
            Search the help topics
          </label>
          <input
            id="faq-search"
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search, for example: offline, password, grading"
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        {total === 0 ? (
          <p className="mt-10 text-center text-sm text-slate-600 dark:text-slate-400">
            No answers match that search. Try a shorter word, or ask us on
            WhatsApp and we will help.
          </p>
        ) : (
          <div className="mt-10 space-y-10">
            {sections.map((section) => (
              <section key={section.id} aria-labelledby={`faq-${section.id}`}>
                <h2
                  id={`faq-${section.id}`}
                  className="text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"
                >
                  {section.title}
                </h2>
                <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
                  {section.blurb}
                </p>
                <div className="mt-4 space-y-2">
                  {section.items.map((item) => (
                    <FaqItem key={item.q} question={item.q} answer={item.a} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
            Still stuck?
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Send us the lesson or exercise name and what you expected to happen.
          </p>
          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:text-emerald-400 dark:hover:bg-emerald-950/40 dark:focus-visible:ring-offset-slate-950"
          >
            Chat on WhatsApp
          </a>
        </div>
      </main>
    </div>
  );
}
