import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { useTheme } from "../context/useTheme";
import { friendlyError } from "../lib/utils";

const sidePanelHighlights = [
  { text: "Build useful programming habits", accent: "amber" },
  { text: "Practice with real code", accent: "teal" },
  { text: "Explore backend, C++, embedded, or AI/ML paths", accent: "violet" },
];

const accentDot = {
  teal: "bg-teal-400",
  violet: "bg-violet-400",
  amber: "bg-amber-400",
};

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
      <div className="grid min-h-screen place-items-center text-slate-500 dark:text-slate-400">
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
      setError(friendlyError(signInError, "We could not sign you in."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center bg-[#F2F4F8] px-4 py-10 dark:bg-[#0B0F1A]">
      <button
        type="button"
        className="button-secondary absolute right-4 top-4 px-3 py-1.5"
        onClick={toggle}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? "Light" : "Dark"}
      </button>

      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[0.85fr_1.15fr]">
        {/* Side panel */}
        <div className="hidden bg-[#0D1321] p-8 text-white lg:block">
          <p className="text-sm font-semibold text-slate-400">Algorise Tech Explorers</p>
          <h2 className="mt-8 text-3xl font-bold leading-tight tracking-tight">
            Small lessons. Strong foundations across software and hardware.
          </h2>
          <div className="mt-10 grid gap-3 text-sm text-slate-300">
            {sidePanelHighlights.map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-white/5 p-4"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${accentDot[item.accent]}`}
                  aria-hidden="true"
                />
                {item.text}
              </div>
            ))}
          </div>
        </div>

        {/* Form panel */}
        <div className="p-6 sm:p-8">
          <Link
            to="/"
            className="text-sm font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          >
            ← Back to portfolio
          </Link>

          <div className="mt-6">
            <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Sign in to continue your learning journey.
            </p>
          </div>

          {!isConfigured ? (
            <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
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
              <span className="label">
                <label htmlFor="academy-login-password">Password</label>
                <span className="relative mt-1 block">
                  <input
                    id="academy-login-password"
                    className="field pr-16"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1/2 flex min-h-11 -translate-y-1/2 items-center rounded-md px-3 text-xs font-semibold text-slate-500 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:hover:text-amber-400"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
              </span>
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
                className="block text-center text-sm font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
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
                className="font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
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
