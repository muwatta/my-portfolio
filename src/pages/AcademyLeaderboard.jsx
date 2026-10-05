import { useEffect, useState } from "react";
import {
  getAcademyWeeklyLeaderboard,
  invalidateAcademyCache,
} from "../lib/academy";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { FiActivity, FiAward, FiBookOpen } from "react-icons/fi";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { supabase } from "../lib/supabase";
import { fetchWithOfflineFallback } from "../lib/academyOffline";
import { OFFLINE_STORES } from "../lib/offlineStore";

const PODIUM_STYLES = {
  1: {
    label: "Champion",
    card: "border-amber-300 bg-gradient-to-br from-amber-50 via-white to-yellow-100 dark:border-amber-700 dark:from-amber-950/60 dark:via-slate-900 dark:to-yellow-950/40",
    badge: "bg-amber-300 text-amber-950",
    icon: "text-amber-600 dark:text-amber-300",
  },
  2: {
    label: "Runner-up",
    card: "border-slate-300 bg-gradient-to-br from-slate-100 via-white to-slate-200 dark:border-slate-600 dark:from-slate-800 dark:via-slate-900 dark:to-slate-700/40",
    badge: "bg-slate-300 text-slate-900 dark:bg-slate-600 dark:text-white",
    icon: "text-slate-500 dark:text-slate-300",
  },
  3: {
    label: "On the podium",
    card: "border-orange-300 bg-gradient-to-br from-orange-50 via-white to-orange-100 dark:border-orange-800 dark:from-orange-950/50 dark:via-slate-900 dark:to-orange-950/30",
    badge: "bg-orange-200 text-orange-950 dark:bg-orange-900 dark:text-orange-100",
    icon: "text-orange-600 dark:text-orange-300",
  },
};

export default function AcademyLeaderboard() {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState("loading");
  const [offline, setOffline] = useState(false);
  const { user, isAdmin, isTeacher } = useAcademyAuth();
  const isStaff = Boolean(isAdmin || isTeacher);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let mounted = true;
    let refreshTimer;
    let refreshInFlight = false;
    const refresh = (delay = 0) => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(async () => {
        if (refreshInFlight) {
          refresh(250);
          return;
        }
        refreshInFlight = true;
        invalidateAcademyCache("leaderboard:weekly");
        const result = await fetchWithOfflineFallback({
          userId: user?.id,
          store: OFFLINE_STORES.leaderboard,
          fetcher: () => getAcademyWeeklyLeaderboard(),
        });
        refreshInFlight = false;
        if (!mounted) return;
        setOffline(Boolean(result.offline));
        setRows(result.data ?? []);
        setState(result.error ? "error" : result.configured ? "ready" : "unconfigured");
      }, delay);
    };

    refresh();
    if (!supabase || !navigator.onLine) {
      return () => {
        mounted = false;
        window.clearTimeout(refreshTimer);
      };
    }
    const channel = supabase
      .channel("academy-weekly-leaderboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "academy_leaderboard_standings" },
        () => refresh(400),
      )
      .subscribe();
    return () => {
      mounted = false;
      window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);
  const currentUserRow = rows.find((row) => row.student_id === user?.id);
  const rankedRows = [...rows].sort(
    (left, right) =>
      (left.rank ?? Number.MAX_SAFE_INTEGER) -
        (right.rank ?? Number.MAX_SAFE_INTEGER) ||
      right.points - left.points,
  );
  const podium = rankedRows.filter(
    (row) => row.rank != null && row.rank <= 3,
  );
  const remainingRows = rankedRows.filter(
    (row) => row.rank == null || row.rank > 3,
  );
  const highestPoints = Math.max(1, ...rankedRows.map((row) => row.points ?? 0));

  return (
    <div className="space-y-6 sm:space-y-8">
      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
        className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-950 p-5 text-white shadow-xl sm:p-8"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-20 -z-10 h-64 w-64 rounded-full border-[28px] border-cyan-200/10"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">
              <FiActivity aria-hidden="true" />
              Verified activity · this week
            </p>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Leaderboard
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              {isStaff
                ? "See how students are progressing through verified learning activity."
                : "Every lesson and practice win moves you up. Keep learning, keep earning, and celebrate your progress."}
            </p>
          </div>
          {currentUserRow ? (
            <div className="rounded-2xl border border-cyan-100/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-cyan-100">
                Your rank
              </p>
              <p className="mt-1 text-2xl font-extrabold">
                #{currentUserRow.rank}
                <span className="ml-2 text-sm font-semibold text-cyan-100">
                  · {currentUserRow.points} pts
                </span>
              </p>
            </div>
          ) : isStaff && rows.length > 0 ? (
            <div className="rounded-2xl border border-cyan-100/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-cyan-100">
                This week
              </p>
              <p className="mt-1 text-2xl font-extrabold">
                {rows.length} student{rows.length === 1 ? "" : "s"} ranked
              </p>
            </div>
          ) : null}
        </div>
      </motion.header>

      {offline && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Last synchronized leaderboard snapshot. New positions require a connection.
        </p>
      )}
      {state === "loading" && (
        <div
          role="status"
          className="grid gap-3 sm:grid-cols-3"
          aria-label="Loading leaderboard"
        >
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none dark:bg-slate-800"
            />
          ))}
          <span className="sr-only">Loading leaderboard...</span>
        </div>
      )}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          Leaderboard could not be loaded. Check your connection and try again.
        </p>
      )}
      {state === "ready" && rows.length === 0 && (
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
          className="rounded-3xl border border-dashed border-cyan-300 bg-cyan-50/70 p-7 text-center dark:border-cyan-900 dark:bg-cyan-950/20 sm:p-10"
        >
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-2xl text-cyan-700 shadow-sm dark:bg-slate-900 dark:text-cyan-300">
            <FiAward aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-xl font-extrabold">
            {isStaff ? "No student points yet" : "Your first win is waiting"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
            {isStaff
              ? "No verified activity yet. Student points from completed lessons, assignments, and practice will appear here."
              : "No verified activity yet. Complete a lesson or try some practice to earn your first points and appear here."}
          </p>
          {!isStaff && (
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link to="/academy/lessons" className="button-primary inline-flex">
                <FiBookOpen aria-hidden="true" className="mr-2" />
                Go to lessons
              </Link>
              <Link
                to="/academy/practice"
                className="button-secondary inline-flex"
              >
                Start practice
              </Link>
            </div>
          )}
        </motion.section>
      )}

      {state === "ready" && podium.length > 0 && (
        <motion.section
          aria-labelledby="weekly-podium-heading"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: {
              transition: {
                staggerChildren: reduceMotion ? 0 : 0.08,
              },
            },
          }}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">
                The weekly podium
              </p>
              <h2
                id="weekly-podium-heading"
                className="mt-1 text-xl font-extrabold tracking-tight"
              >
                Top explorers
              </h2>
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Points are earned through verified learning
            </p>
          </div>
          <ol
            aria-label="Top three students this week"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            {podium.map((row) => {
              const rank = row.rank;
              const style = PODIUM_STYLES[rank];
              const isCurrentUser = row.student_id === user?.id;
              const hoverMotion = reduceMotion ? "" : "hover:-translate-y-1";
              return (
                <motion.li
                  key={row.student_id}
                  initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.3,
                    ease: "easeOut",
                  }}
                  className={rank === 1 ? "sm:col-span-2 xl:col-span-1" : ""}
                >
                  <article
                    className={`relative h-full overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:shadow-lg ${hoverMotion} ${
                      style.card
                    } ${rank === 1 ? "ring-2 ring-amber-300/70 dark:ring-amber-700/70" : ""} ${
                      isCurrentUser ? "outline outline-2 outline-cyan-500 outline-offset-2" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-extrabold uppercase tracking-wide ${style.badge}`}
                        >
                          #{rank}
                          {isCurrentUser ? " · you" : ""}
                        </span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          {style.label}
                        </span>
                      </div>
                      <FiAward
                        aria-hidden="true"
                        className={`text-2xl ${style.icon}`}
                      />
                    </div>
                    <h3 className="mt-5 truncate text-xl font-extrabold">
                      {row.display_name || "Student"}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {row.points ?? 0}
                      </span>{" "}
                      pts this week
                    </p>
                    <div
                      className="mt-4 h-2 overflow-hidden rounded-full bg-white/80 dark:bg-slate-950/60"
                      role="progressbar"
                      aria-label={`${row.display_name || "Student"} points compared with the weekly leader`}
                      aria-valuemin={0}
                      aria-valuemax={highestPoints}
                      aria-valuenow={row.points ?? 0}
                    >
                      <motion.div
                        initial={reduceMotion ? false : { width: 0 }}
                        animate={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              ((row.points ?? 0) / highestPoints) * 100,
                            ),
                          )}%`,
                        }}
                        transition={{
                          duration: reduceMotion ? 0 : 0.7,
                          delay: reduceMotion ? 0 : 0.12,
                          ease: "easeOut",
                        }}
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500"
                      />
                    </div>
                  </article>
                </motion.li>
              );
            })}
          </ol>
        </motion.section>
      )}

      {state === "ready" && remainingRows.length > 0 && (
        <motion.section
          aria-labelledby="weekly-rankings-heading"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">
                Keep climbing
              </p>
              <h2 id="weekly-rankings-heading" className="mt-1 text-lg font-bold">
                Weekly rankings
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {rows.length} ranked
            </span>
          </div>
          <ol className="divide-y divide-slate-100 dark:divide-slate-800">
            {remainingRows.map((row, index) => {
              const rank = row.rank ?? index + podium.length + 1;
              const isCurrentUser = row.student_id === user?.id;
              return (
                <motion.li
                  key={row.student_id}
                  initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.22,
                    delay: reduceMotion ? 0 : Math.min(index * 0.035, 0.28),
                  }}
                  className={`grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[4rem_minmax(0,1fr)_8rem] sm:px-5 ${
                    isCurrentUser
                      ? "bg-cyan-50 dark:bg-cyan-950/40"
                      : "bg-white dark:bg-slate-900"
                  }`}
                >
                  <span
                    className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-sm font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    #{rank}
                  </span>
                  <span className="min-w-0 truncate font-semibold">
                    {row.display_name || "Student"}
                    {isCurrentUser && (
                      <span className="ml-2 text-xs font-bold text-cyan-800 dark:text-cyan-200">
                        · you
                      </span>
                    )}
                  </span>
                  <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap font-extrabold tabular-nums text-slate-800 dark:text-slate-100">
                    <FiAward
                      aria-hidden="true"
                      className="text-amber-500"
                    />
                    {row.points ?? 0}
                    <span className="hidden text-xs font-semibold text-slate-500 sm:inline">
                      pts
                    </span>
                  </span>
                </motion.li>
              );
            })}
          </ol>
        </motion.section>
      )}
      {state === "ready" && rows.length > 0 && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Lesson and practice points are verified automatically. Keep showing
          up and your next win is one step away.
        </p>
      )}
    </div>
  );
}
