import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAcademyAuth } from "../hooks/useAcademyAuth";

export default function AcademyResetPassword() {
  const { updatePassword, user } = useAcademyAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    const { error: updateError } = await updatePassword(password);
    if (updateError) setError(updateError.message || "Password reset failed.");
    else {
      setMessage("Password updated. You can now continue to Academy.");
      setTimeout(
        () => navigate(user ? "/academy/dashboard" : "/academy/login"),
        700,
      );
    }
  }
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <form
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8"
        onSubmit={submit}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">
          ATE Academy
        </p>
        <h1 className="mt-3 text-3xl font-bold">Choose a new password</h1>
        <div className="mt-6 space-y-4">
          <label className="label">
            New password
            <input
              className="field"
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <label className="label">
            Confirm password
            <input
              className="field"
              type="password"
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
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
          <button className="button-primary w-full" type="submit">
            Update password
          </button>
          <Link
            className="block text-center text-sm font-semibold text-blue-600"
            to="/academy/login"
          >
            Back to sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
