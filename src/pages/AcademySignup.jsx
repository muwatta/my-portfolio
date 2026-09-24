import { useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { useTheme } from "../context/useTheme";
import {
  getAcademySignupErrorMessage,
  isValidAcademyRegistrationNumber,
  normalizeAcademyRegistrationNumber,
} from "../lib/registration";

export default function AcademySignup() {
  const { user, loading, signUp, isConfigured } = useAcademyAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signupStarted, setSignupStarted] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdRegistrationNumber, setCreatedRegistrationNumber] = useState("");
  const signupRequestStarted = useRef(false);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        Loading Academy...
      </div>
    );
  }

  if (user && !signupStarted) return <Navigate to="/academy/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (signupRequestStarted.current) return;
    setError("");

    const name = displayName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRegistrationNumber = normalizeAcademyRegistrationNumber(
      registrationNumber,
    );
    if (!name) return setError("Please enter your full name.");
    if (!isValidAcademyRegistrationNumber(normalizedRegistrationNumber)) {
      return setError("Enter your Academy registration number in the format ATE-26-001.");
    }
    if (password.length < 8) {
      return setError("Your password must be at least 8 characters.");
    }
    if (password !== confirmPassword)
      return setError("Passwords do not match.");

    signupRequestStarted.current = true;
    setSubmitting(true);
    setSignupStarted(true);
    setError("");
    let completed = false;
    try {
      const { error: signUpError } = await signUp(
        normalizedEmail,
        password,
        name,
        normalizedRegistrationNumber,
      );
      if (signUpError) throw signUpError;
      setCreatedRegistrationNumber(normalizedRegistrationNumber);
      setCreated(true);
      completed = true;
    } catch (signUpError) {
      setError(getAcademySignupErrorMessage(signUpError));
    } finally {
      if (!completed) {
        signupRequestStarted.current = false;
        setSignupStarted(false);
      }
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
              "Paths across software, embedded, and AI/ML",
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
              ATE Academy
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Create your student account with Algorise Tech Explorers.
            </p>
          </div>
          {!isConfigured ? (
            <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              Academy sign-up is not configured in this environment.
            </div>
          ) : created ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="signup-success-title"
              className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-950/40"
            >
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-900">
                ✓
              </div>
              <h3
                id="signup-success-title"
                className="mt-5 text-2xl font-bold"
              >
                Welcome to Muwatta Academy!
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Your Academy Registration Number is:
              </p>
              <p className="mt-2 text-2xl font-bold tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
                {createdRegistrationNumber}
              </p>
              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
                We sent a confirmation link to{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {email.trim().toLowerCase()}
                </span>
                . If this email already has an Academy account, sign in
                instead; we will not create a duplicate account.
              </p>
              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => navigate("/academy/login")}
                >
                  Go to sign in
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    signupRequestStarted.current = false;
                    setSignupStarted(false);
                    setCreated(false);
                  }}
                >
                  Not the right email?
                </button>
              </div>
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="label">
                Academy Registration Number
                <input
                  className="field uppercase tracking-[0.12em]"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  maxLength={10}
                  placeholder="ATE-26-001"
                  value={registrationNumber}
                  onChange={(event) =>
                    setRegistrationNumber(event.target.value.toUpperCase())
                  }
                  required
                />
              </label>
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
              <button
                className="button-primary w-full"
                type="submit"
                disabled={submitting}
              >
                 {submitting
                   ? "Creating your Academy account..."
                   : "Create student account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
