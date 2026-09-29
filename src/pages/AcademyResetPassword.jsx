import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { friendlyError } from "../lib/utils";
import ContactAdmin from "../components/academy/ContactAdmin";

export default function AcademyResetPassword() {
  const { updatePassword, user, loading } = useAcademyAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // A recovery link signs the user in, so `user` proves the link still works.
  // Without a session the link has expired or already been used, and there is
  // no point letting someone type a password that would silently fail.
  const hasRecoverySession = Boolean(user);

  useEffect(() => {
    if (hasRecoverySession) return;
    // Give the auth state a moment to arrive from the link before deciding.
    const timer = setTimeout(() => {}, 0);
    return () => clearTimeout(timer);
  }, [hasRecoverySession]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      return setError("Use at least 8 characters.");
    }
    if (password !== confirm) return setError("Passwords do not match.");
    if (password === confirm && /^\d+$/.test(password))
      return setError("Use more than just numbers for a password.");
    if (confirm.length > 0 && confirm.trim() !== confirm)
      return setError("Passwords cannot start or end with a space.");

    setSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setSubmitting(false);

    if (updateError) {
      setError(
        friendlyError(
          updateError,
          "That reset link has expired or has already been used. Request a new one.",
        ),
      );
      return;
    }
    setMessage("Password updated. Taking you to your dashboard...");
    setTimeout(() => navigate("/academy/dashboard"), 900);
  }

  if (!loading && !hasRecoverySession) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <h1 className="text-2xl font-bold">This link is no longer valid</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Reset links expire after a short time, and each one can only be used
            once. If you opened an older email, ask for a new link below.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link className="button-primary" to="/academy/forgot-password">
              Send me a new link
            </Link>
            <Link className="button-secondary" to="/academy/login">
              Back to sign in
            </Link>
          </div>
          <div className="mt-4">
            <ContactAdmin context="my reset link has expired" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <form
        className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8"
        onSubmit={submit}
      >
        <h1 className="text-2xl font-bold">Choose a new password</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Pick something you have not used elsewhere. At least 8 characters, and
          not only numbers.
        </p>
        <label className="label">
          New password
          <input
            className="field"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <label className="label">
          Confirm new password
          <input
            className="field"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
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
          {submitting ? "Saving..." : "Save new password"}
        </button>
        <p className="text-center text-sm">
          <Link className="font-semibold text-blue-600" to="/academy/login">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
