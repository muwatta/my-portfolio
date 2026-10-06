import { useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { useTheme } from "../context/useTheme";
import {
  getAcademySignupErrorMessage,
} from "../lib/registration";
import {
  getAcademyPasswordErrorMessage,
  getAcademyPasswordProblems,
} from "../lib/password";
import PasswordField from "../components/academy/PasswordField";

const sidePanelHighlights = [
  { text: "Paths across software, embedded, and AI/ML", accent: "teal" },
  { text: "Practical exercises and projects", accent: "violet" },
  { text: "A student account built for progress", accent: "amber" },
];

const accentDot = {
  teal: "bg-teal-400",
  violet: "bg-violet-400",
  amber: "bg-amber-400",
};

export default function AcademySignup() {
  const {
    user,
    loading,
    signUp,
    resendConfirmation,
    isConfigured,
  } = useAcademyAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordAttempted, setPasswordAttempted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signupStarted, setSignupStarted] = useState(false);
  const [created, setCreated] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [confirmationError, setConfirmationError] = useState(false);
  const signupRequestStarted = useRef(false);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-500 dark:text-slate-400">
        Loading Academy...
      </div>
    );
  }

  if (user && !signupStarted)
    return <Navigate to="/academy/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (signupRequestStarted.current) return;
    setError("");

    const name = displayName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!name) return setError("Please enter your full name.");
    const problems = getAcademyPasswordProblems(password);
    if (problems.length) {
      setPasswordAttempted(true);
      return setError(
        `Your password needs ${problems.length === 1 ? "one more thing" : `${problems.length} more things`}: ${problems.join(", ").toLowerCase()}.`,
      );
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
      );
      if (signUpError) throw signUpError;
      setCreated(true);
      completed = true;
    } catch (signUpError) {
      // A password the server refuses must say which rule was missed, or the
      // student is left guessing why a form they filled in correctly failed.
      const isPasswordProblem =
        /password/i.test(String(signUpError?.message ?? signUpError?.msg ?? ""));
      setError(
        isPasswordProblem
          ? getAcademyPasswordErrorMessage(signUpError)
          : getAcademySignupErrorMessage(signUpError),
      );
    } finally {
      if (!completed) {
        signupRequestStarted.current = false;
        setSignupStarted(false);
      }
      setSubmitting(false);
    }
  }

  async function handleResendConfirmation() {
    setResendingConfirmation(true);
    setConfirmationMessage("");
    setConfirmationError(false);
    try {
      const { error: resendError } = await resendConfirmation(
        email.trim().toLowerCase(),
      );
      if (resendError) throw resendError;
      setConfirmationMessage(
        "A new confirmation email has been requested. Check your inbox and spam folder.",
      );
    } catch (resendError) {
      setConfirmationError(true);
      const message = String(resendError?.message ?? "").toLowerCase();
      const isRateLimited =
        resendError?.status === 429 ||
        message.includes("rate limit") ||
        message.includes("too many requests");
      setConfirmationMessage(
        isRateLimited
          ? "Too many confirmation emails were requested. Please wait a few minutes before trying again."
          : "We couldn't send another confirmation email. Please try again shortly or contact Academy support.",
      );
    } finally {
      setResendingConfirmation(false);
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
          <h1 className="mt-8 text-3xl font-bold leading-tight tracking-tight">
            Your next chapter starts with one small step.
          </h1>
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
            to="/academy/login"
            className="text-sm font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
          >
            ← Back to sign in
          </Link>

          <div className="mt-6">
            <h2 className="text-3xl font-bold tracking-tight">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Set up your student account with Algorise Tech Explorers.
            </p>
          </div>

          {!isConfigured ? (
            <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Academy sign-up is not configured in this environment.
            </div>
          ) : created ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center sm:p-8 dark:border-emerald-800 dark:bg-emerald-950/40"
            >
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-900">
                ✓
              </div>
              <h3 id="signup-success-title" className="mt-5 text-2xl font-bold">
                Welcome to Algorise Tech Explorers!
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                A confirmation link should arrive at{" "}
                <span className="break-all font-semibold text-slate-800 dark:text-slate-100">
                  {email.trim().toLowerCase()}
                </span>
                . Confirm your email to activate your account and access the
                dashboard. If you do not see it shortly, check your spam folder
                or request another email below.
              </p>
              {confirmationMessage && (
                <p
                  role={confirmationError ? "alert" : "status"}
                  aria-live="polite"
                  className={`mt-3 text-sm ${
                    confirmationError
                      ? "text-red-700 dark:text-red-300"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {confirmationMessage}
                </p>
              )}
              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Your registration number is issued for you automatically once you
                confirm your email, and you will see it on your dashboard. It
                stays provisional until an administrator accepts it.
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
                  onClick={handleResendConfirmation}
                  disabled={resendingConfirmation}
                >
                  {resendingConfirmation
                    ? "Requesting email..."
                    : "Resend confirmation email"}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    signupRequestStarted.current = false;
                    setSignupStarted(false);
                    setCreated(false);
                    setConfirmationMessage("");
                  }}
                >
                  Not the right email?
                </button>
              </div>
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
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
              <PasswordField
                id="academy-signup-password"
                label="Password"
                value={password}
                onChange={(next) => {
                  setPassword(next);
                  if (passwordAttempted) setPasswordAttempted(false);
                }}
                hint="Use a password you have not used on another site."
              />
              <PasswordField
                id="academy-signup-password-confirm"
                label="Confirm password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                showToggle={false}
              />
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
              <p className="text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
                Academy never asks for your password over chat or by email. Keep it
                to yourself.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
