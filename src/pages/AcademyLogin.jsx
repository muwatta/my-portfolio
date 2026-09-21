import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAcademyAuth } from "../context/AcademyAuthContext";

export default function AcademyLogin() {
  const { user, loading, signIn, isConfigured } = useAcademyAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center">
        Loading Academy...
      </div>
    );
  if (user)
    return (
      <Navigate to={location.state?.from || "/academy/dashboard"} replace />
    );

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { error: signInError } = await signIn(email.trim(), password);
      if (signInError) throw signInError;
      navigate(location.state?.from || "/academy/dashboard", { replace: true });
    } catch (signInError) {
      setError(signInError.message || "We could not sign you in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <Link
          to="/"
          className="text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          ← Back to Muwatta
        </Link>
        <div className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Academy
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Sign in to continue your Python to AI/ML course.
          </p>
        </div>
        {!isConfigured ? (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Academy sign-in is not configured in this environment. Add the
            Supabase variables from `.env.example` to enable it.
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="label">
              Email
              <input
                className="field"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="label">
              Password
              <input
                className="field"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
              >
                {error}
              </p>
            )}
            <button
              className="button-primary w-full"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
