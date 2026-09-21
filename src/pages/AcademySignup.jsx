import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { useTheme } from "../context/useTheme";

export default function AcademySignup() {
  const { user, loading, signUp, isConfigured } = useAcademyAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        Loading Academy...
      </div>
    );
  }

  if (user) return <Navigate to="/academy/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const name = displayName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!name) return setError("Please enter your full name.");
    if (password.length < 8) {
      return setError("Your password must be at least 8 characters.");
    }
    if (password !== confirmPassword)
      return setError("Passwords do not match.");

    setSubmitting(true);
    try {
      const { data, error: signUpError } = await signUp(
        normalizedEmail,
        password,
        name,
      );
      if (signUpError) throw signUpError;
      if (data.session) {
        navigate("/academy/dashboard", { replace: true });
        return;
      }
      setMessage(
        "Account created. Check your email to confirm your account, then sign in.",
      );
    } catch (signUpError) {
      setError(
        signUpError.message || "We could not create your Academy account.",
      );
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
          <h1 className="mt-8 text-3xl font-bold tracking-tight">
            Your next chapter starts with one small step.
          </h1>
          <div className="mt-10 grid gap-3 text-sm text-slate-300">
            {[
              "A clear 11-week learning path",
              "Practical exercises and projects",
              "A student account built for progress",
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
            to="/academy/login"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            ← Back to sign in
          </Link>
          <div className="mt-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
              Academy
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Create a student account to start your Python to AI/ML course.
            </p>
          </div>
          {!isConfigured ? (
            <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              Academy sign-up is not configured in this environment.
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="label">
                Full name
                <input
                  className="field"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
              </label>
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
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
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
              <label className="label">
                Confirm password
                <input
                  className="field"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={8}
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
              {message && (
                <p
                  role="status"
                  className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300"
                >
                  {message}
                </p>
              )}
              <button
                className="button-primary w-full"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Creating account..." : "Create student account"}
              </button>
            </form>
          )}
          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
            Already have an Academy account?{" "}
            <Link
              to="/academy/login"
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
