import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { friendlyError } from "../lib/utils";
import ContactAdmin from "../components/academy/ContactAdmin";

const RESEND_SECONDS = 45;

export default function AcademyForgotPassword() {
  const { sendPasswordReset, isConfigured } = useAcademyAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  // Stops the button being used to hammer the mail server, and gives a student
  // on a slow connection a moment before the next attempt.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    timer.current = setInterval(() => {
      setCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => clearInterval(timer.current);
  }, [cooldown]);

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    const normalized = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
      setError("Enter a valid email address, including the @ and the domain.");
      return;
    }
    setSubmitting(true);
    const { error: resetError } = await sendPasswordReset(normalized);
    setSubmitting(false);
    if (resetError) {
      setError(friendlyError(resetError, "The reset email could not be sent."));
      return;
    }
    // Deliberately does not say whether the address exists. Saying so would let
    // anyone test which students are enrolled. The "can't get in" route below
    // is how a genuine blocked student gets help.
    setMessage(
      "If that address has an Academy account, a reset link is on its way. It expires after a short time, so use it soon.",
    );
    setCooldown(RESEND_SECONDS);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">
          Algorise Tech Explorers
        </p>
        <h1 className="mt-3 text-3xl font-bold">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Enter your account email and we will send a secure reset link.
        </p>
        {!isConfigured ? (
          <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Academy authentication is not configured.
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <label className="label">
              Email
              <input
                className="field"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            {message && (
              <p
                role="status"
                className="rounded-lg bg-green-50 p-3 text-sm text-green-700"
              >
                {message}
              </p>
            )}
            <button
              className="button-primary w-full"
              type="submit"
              disabled={submitting || cooldown > 0}
            >
              {submitting
                ? "Sending..."
                : cooldown > 0
                  ? `Send again in ${cooldown}s`
                  : "Send reset link"}
            </button>
          </form>
        )}

        <div className="mt-6 space-y-3 border-t border-slate-200 pt-5 text-sm dark:border-slate-800">
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            Link not working?
          </p>
          <ul className="list-disc space-y-1 pl-5 text-slate-600 dark:text-slate-300">
            <li>Check spam or junk, it sometimes lands there.</li>
            <li>Links expire. Request a new one above.</li>
            <li>
              Use the address you signed up with. If you cannot remember it, ask
              an administrator to check it for you.
            </li>
          </ul>
          <div className="mt-4">
            <ContactAdmin context="resetting my password" tone="light" />
          </div>
        </div>

        <p className="mt-6 text-center text-sm">
          <Link
            className="font-semibold text-blue-600"
            to="/academy/login"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
