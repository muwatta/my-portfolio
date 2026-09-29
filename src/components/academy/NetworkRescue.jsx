import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ContactAdmin from "./ContactAdmin";
import { getOfflineRecords, OFFLINE_STORES } from "../../lib/offlineStore";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";

// Shown when a student loses the network or a request fails for connectivity
// reasons. A dead end with "network error" on it teaches nothing and worries a
// parent, so this offers three things instead: what to do about it, something
// worth reading, and something to play that needs no network at all.
//
// The quiz runs off questions already downloaded to the device, so a student
// with no signal is revising rather than idling. Nothing here is fetched.

const TIPS = [
  {
    title: "Your work is not lost",
    body: "Anything you already downloaded stays on this device. Answers you have finished are queued and send themselves when you are back.",
  },
  {
    title: "Loading and saving are different",
    body: "Opening a topic you have already opened works offline. Opening one you have never opened needs a connection, because the content has never reached this device.",
  },
  {
    title: "Photos may not send yet",
    body: "Assignments you hand in while offline are kept and retried automatically. You do not need to send them twice.",
  },
  {
    title: "A weak signal is not none",
    body: "On 2G or 3G, text pages will still load if images are slow. If a page hangs, moving somewhere with more signal and pulling to refresh is usually faster than waiting.",
  },
];

export default function NetworkRescue({
  onRetry,
  retrying = false,
  compact = false,
}) {
  const [tab, setTab] = useState("help");
  const { questions, source } = useOfflineQuiz();

  return (
    <section
      className={`rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/30 ${
        compact ? "" : "sm:p-6"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-amber-900 dark:text-amber-100">
            You are offline
          </h2>
          <p className="mt-1 max-w-prose text-sm text-amber-800 dark:text-amber-200">
            This part of the Academy needs a connection. Nothing you have already
            downloaded is affected, and nothing you have done is lost.
          </p>
        </div>
        {onRetry && (
          <button
            className="button-secondary shrink-0"
            type="button"
            onClick={onRetry}
            disabled={retrying}
          >
            {retrying ? "Trying..." : "Try again"}
          </button>
        )}
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          ["help", "What to do"],
          ["quiz", "Play a quiz"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              tab === key
                ? "bg-amber-700 text-white"
                : "bg-white text-amber-900 dark:bg-slate-900 dark:text-amber-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "help" ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {TIPS.map((tip) => (
            <li
              key={tip.title}
              className="rounded-xl bg-white p-4 dark:bg-slate-900"
            >
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {tip.title}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {tip.body}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <OfflineQuiz questions={questions} source={source} />
      )}

      <footer className="mt-4 border-t border-amber-300 pt-4 dark:border-amber-800">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Still stuck, or a link will not open?{" "}
          <Link
            className="font-semibold text-amber-900 underline dark:text-amber-100"
            to="/academy/faq"
          >
            Read the FAQ
          </Link>{" "}
          or ask us and we will sort it out.
        </p>
        <div className="mt-3">
          <ContactAdmin
            tone="light"
            context="Something will not load without a connection"
          />
        </div>
      </footer>
    </section>
  );
}

// Pulls multiple choice questions out of whatever the student already has on
// the device. Reuses their real downloaded work rather than inventing content,
// so the offline time is spent revising rather than idling.
function useOfflineQuiz() {
  const { user } = useAcademyAuth();
  const [questions, setQuestions] = useState([]);
  const [source, setSource] = useState("pending");

  const load = useCallback(async () => {
    if (!user?.id) {
      setSource("none");
      return;
    }
    try {
      for (const key of [
        OFFLINE_STORES.exercises,
        OFFLINE_STORES.lessons,
        OFFLINE_STORES.assignments,
      ]) {
        const records = await getOfflineRecords(key, user.id);
        const usable = (records ?? [])
          .map((record) => record?.data ?? record)
          .filter(
            (row) =>
              row?.question_type === "multiple_choice" &&
              Array.isArray(row.choices) &&
              row.choices.length >= 2 &&
              row.correct_answer,
          )
          .map((row) => ({
            id: row.id,
            prompt: row.title,
            choices: row.choices,
            answer: row.correct_answer,
          }));
        if (usable.length) {
          setQuestions(usable);
          setSource("downloaded");
          return;
        }
      }
      setQuestions([]);
      setSource("none");
    } catch {
      setQuestions([]);
      setSource("none");
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return { questions, source };
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function OfflineQuiz({ questions, source }) {
  const [round, setRound] = useState(null);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [asked, setAsked] = useState(0);

  const start = useCallback(() => {
    if (!questions.length) return;
    setRound(shuffle(questions).slice(0, 5));
    setPicked(null);
    setScore(0);
    setAsked(0);
  }, [questions]);

  const current = useMemo(() => {
    if (!round) return null;
    // Ask the same question to everyone in a round, so nobody can compare.
    const index = asked % round.length;
    return round[index] ?? null;
  }, [round, asked]);

  if (source === "pending") {
    return (
      <p className="mt-4 text-sm text-amber-800 dark:text-amber-200">
        Looking for questions you have downloaded...
      </p>
    );
  }

  if (!questions.length) {
    return (
      <div className="mt-4 rounded-xl bg-white p-4 dark:bg-slate-900">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
          No offline quiz yet
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          The quiz is built from topics you have already downloaded, so it needs
          no network. Download a topic while you have signal and the questions
          will be here next time you lose it.
        </p>
        <Link className="button-secondary mt-3 inline-block" to="/academy/courses">
          Go to your courses
        </Link>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="mt-4 rounded-xl bg-white p-4 dark:bg-slate-900">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {questions.length} question{questions.length === 1 ? "" : "s"} ready
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Taken from topics you have downloaded, so it works with no connection
          at all.
        </p>
        <button className="button-primary mt-3" type="button" onClick={start}>
          Start quiz
        </button>
      </div>
    );
  }

  if (asked >= round.length) {
    return (
      <div className="mt-4 rounded-xl bg-white p-4 text-center dark:bg-slate-900">
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          {score} out of {round.length}
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {score === round.length
            ? "All of them. That is a full set."
            : "Anything you missed is worth a look when you are back online."}
        </p>
        <button className="button-primary mt-3" type="button" onClick={start}>
          Play again
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl bg-white p-4 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        Question {asked + 1} of {round.length}
      </p>
      <p className="mt-2 font-semibold text-slate-800 dark:text-slate-100">
        {current?.prompt}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(current?.choices ?? []).map((choice) => {
          const isAnswer = choice === current?.answer;
          const chosen = choice === picked;
          return (
            <button
              key={choice}
              type="button"
              disabled={picked !== null}
              onClick={() => {
                setPicked(choice);
                if (isAnswer) setScore((value) => value + 1);
              }}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold disabled:cursor-default ${
                picked === null
                  ? "border-slate-300 hover:border-amber-500 dark:border-slate-700"
                  : isAnswer
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
                    : chosen
                      ? "border-rose-400 bg-rose-50 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100"
                      : "border-slate-200 text-slate-400 dark:border-slate-800"
              }`}
            >
              {choice}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <button
          className="button-primary mt-3"
          type="button"
          onClick={() => {
            setPicked(null);
            setAsked((value) => value + 1);
          }}
        >
          Next question
        </button>
      )}
    </div>
  );
}
