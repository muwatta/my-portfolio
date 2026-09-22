import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { useTheme } from "../context/useTheme";

export default function AcademyLogin() {
  const { user, loading, signIn, isConfigured } = useAcademyAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="relative grid min-h-screen place-items-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <button
        type="button"
        className="button-secondary absolute right-4 top-4 px-3 py-1.5"
        onClick={toggle}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? "Light" : "Dark"}
      </button>
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="hidden bg-slate-900 p-8 text-white dark:bg-slate-800 lg:block">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Muwatta Academy
          </p>
          <h2 className="mt-8 text-3xl font-bold tracking-tight">
            Small lessons. Strong foundations across software and hardware.
          </h2>
          <div className="mt-10 grid gap-3 text-sm text-slate-300">
            {[
              "Build useful programming habits",
              "Practice with real code",
              "Explore backend, C++, embedded, or AI/ML paths",
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-slate-700 bg-slate-800/70 p-4"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 sm:p-8">
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
              Sign in to continue your ATE Academy learning journey.
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
                <span className="relative block">
                  <input
                    className="field pr-16"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:text-blue-600"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
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
              <Link
                to="/academy/forgot-password"
                className="block text-center text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Forgot password?
              </Link>
            </form>
          )}
          {isConfigured && (
            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
              New to Academy?{" "}
              <Link
                to="/academy/signup"
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                Create a student account
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
