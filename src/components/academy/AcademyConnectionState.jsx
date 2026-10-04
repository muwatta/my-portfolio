import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Skeleton } from "../ui/Skeleton";

const CHALLENGES = [
  {
    prompt: "While the network catches up, solve this: a sensor reads a value every 2 seconds. How many readings fit in 30 seconds?",
    answer: "15 readings, because 30 divided by 2 is 15.",
  },
  {
    prompt: "Warm up: a loop prints 1 to 5. What is printed after the loop finishes?",
    answer: "Nothing. A loop ends without printing unless you ask it to.",
  },
  {
    prompt: "Quick one: if a list has 8 items and you remove the first 3, how many are left?",
    answer: "5 items are left.",
  },
  {
    prompt: "Try this: 12 divided by 4, then subtract 1. What do you get?",
    answer: "2, because 12 divided by 4 is 3, and 3 minus 1 is 2.",
  },
  {
    prompt: "Puzzle: a program runs 5 steps, each taking 2 seconds. How long in total?",
    answer: "10 seconds, because 5 times 2 is 10.",
  },
];

const TIPS = [
  "Lessons you download stay on this device, so you can keep learning without a connection.",
  "Anything you write offline is saved here and sent to your teacher when you reconnect.",
  "Your downloaded course is not using data, so you can study even on a weak signal.",
  "Practice you run in the browser works offline once the Python runtime is cached.",
];

function pickIndex(length, seed) {
  if (length <= 0) return 0;
  return Math.abs(seed) % length;
}

export default function AcademyConnectionState({
  online = true,
  slow = false,
  loading = false,
  onRetry,
  children,
  title,
  description,
  showChallenge = true,
}) {
  const [revealed, setRevealed] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);

  const seed = useMemo(() => {
    if (typeof Date === "undefined") return 0;
    return Math.floor(Date.now() / 60000);
  }, []);

  const challenge = CHALLENGES[pickIndex(CHALLENGES.length, seed)];
  const tip = TIPS[(pickIndex(TIPS.length, seed) + tipIndex) % TIPS.length];

  useEffect(() => {
    setRevealed(false);
  }, [online, slow]);

  useEffect(() => {
    if (online && !slow) return undefined;
    const timer = window.setInterval(
      () => setTipIndex((value) => (value + 1) % TIPS.length),
      9000,
    );
    return () => window.clearInterval(timer);
  }, [online, slow]);

  if (loading) {
    return (
      <div
        className="space-y-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">{title || "Loading your content"}</span>
        <div className="rounded-xl border border-slate-200 p-6 dark:border-slate-800" aria-hidden="true">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-3 w-2/3" rounded="rounded-full" />
          <Skeleton className="mt-2 h-3 w-1/2" rounded="rounded-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  const heading = title ?? (online ? "Connection is slow" : "You're offline");
  const body =
    description ??
    (online
      ? "We are fetching your content. This can take a moment on a weak signal."
      : "This part has not been downloaded for offline use yet.");

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/20"
      aria-live="polite"
    >
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          {online ? (slow ? "Slow connection" : "Online") : "Offline"}
        </p>
        <h2 className="mt-1 text-lg font-bold text-amber-950 dark:text-amber-100">
          {heading}
        </h2>
        <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
          {body}
        </p>
      </div>

      {onRetry && (
        <button
          type="button"
          className="button-secondary mt-4"
          onClick={onRetry}
        >
          {online ? "Check again" : "Try reconnecting"}
        </button>
      )}

      {children}

      {showChallenge && (
        <div className="mt-4 rounded-xl border border-amber-300/70 bg-white/70 p-3 dark:border-amber-800/70 dark:bg-slate-900/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            While you wait
          </p>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            {challenge.prompt}
          </p>
          {revealed ? (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"
            >
              {challenge.answer}
            </motion.p>
          ) : (
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-600 dark:text-cyan-300"
              onClick={() => setRevealed(true)}
            >
              Show the answer
            </button>
          )}
        </div>
      )}

      {showChallenge && (
        <motion.p
          key={tipIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200"
        >
          <span aria-hidden="true">Tip</span>
          <span>{tip}</span>
        </motion.p>
      )}
    </motion.section>
  );
}
