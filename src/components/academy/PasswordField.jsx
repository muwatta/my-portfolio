import { useId, useState } from "react";
import {
  ACADEMY_PASSWORD_MIN_LENGTH,
  getAcademyPasswordRuleResults,
} from "../../lib/password";

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "new-password",
  showToggle = true,
  hint = null,
}) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const hintId = `${fieldId}-rules`;
  const [revealed, setRevealed] = useState(false);
  const results = getAcademyPasswordRuleResults(value);
  const metCount = results.filter((rule) => rule.met).length;

  return (
    <div>
      <label className="label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={fieldId}
          className="field pr-20"
          type={revealed ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={ACADEMY_PASSWORD_MIN_LENGTH}
          aria-describedby={hintId}
        />
        {showToggle && (
          <button
            type="button"
            className="absolute right-1 top-1/2 flex min-h-11 -translate-y-1/2 items-center rounded-md px-3 text-xs font-semibold text-slate-500 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:hover:text-amber-400"
            onClick={() => setRevealed((current) => !current)}
            aria-label={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          >
            {revealed ? "Hide" : "Show"}
          </button>
        )}
      </div>

      <div id={hintId} className="mt-2">
        {hint && (
          <p className="text-xs font-normal text-slate-500 dark:text-slate-400">
            {hint}
          </p>
        )}
        <ul className="mt-1 grid gap-1">
          {results.map((rule) => (
            <li
              key={rule.id}
              className={`flex items-center gap-2 text-xs ${
                rule.met
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  rule.met
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-400 text-transparent dark:border-slate-600"
                }`}
              >
                ✓
              </span>
              <span>{rule.label}</span>
              <span className="sr-only">
                {rule.met ? "requirement met" : "requirement not met yet"}
              </span>
            </li>
          ))}
        </ul>
        <p
          className="mt-1 text-xs font-normal text-slate-500 dark:text-slate-400"
          aria-live="polite"
        >
          {metCount} of {results.length} requirements met.
        </p>
      </div>
    </div>
  );
}