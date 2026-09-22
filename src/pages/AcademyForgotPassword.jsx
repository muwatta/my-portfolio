import { useState } from "react";
import { Link } from "react-router-dom";
import { useAcademyAuth } from "../hooks/useAcademyAuth";

export default function AcademyForgotPassword() {
  const { sendPasswordReset, isConfigured } = useAcademyAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSubmitting(true);
    const { error: resetError } = await sendPasswordReset(
      email.trim().toLowerCase(),
    );
    setSubmitting(false);
    if (resetError)
      setError(resetError.message || "We could not send the reset email.");
    else
      setMessage(
        "If an account exists for that email, a secure reset link is on its way.",
      );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">
          ATE Academy
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
              disabled={submitting}
            >
              {submitting ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}
        <Link
          className="mt-6 block text-center text-sm font-semibold text-blue-600"
          to="/academy/login"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
