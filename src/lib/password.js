export const ACADEMY_PASSWORD_MIN_LENGTH = 8;

export const ACADEMY_PASSWORD_RULES = [
  {
    id: "length",
    label: `At least ${ACADEMY_PASSWORD_MIN_LENGTH} characters`,
    test: (value) => value.length >= ACADEMY_PASSWORD_MIN_LENGTH,
  },
  {
    id: "lowercase",
    label: "A lowercase letter",
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: "uppercase",
    label: "An uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "digit",
    label: "A number",
    test: (value) => /[0-9]/.test(value),
  },
  {
    id: "symbol",
    label: "A symbol, for example !, @, or $",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

export function getAcademyPasswordRuleResults(value) {
  const password = String(value ?? "");
  return ACADEMY_PASSWORD_RULES.map((rule) => ({
    ...rule,
    met: rule.test(password),
  }));
}

export function getAcademyPasswordProblems(value) {
  return getAcademyPasswordRuleResults(value)
    .filter((rule) => !rule.met)
    .map((rule) => rule.label);
}

export function isAcademyPasswordStrong(value) {
  return getAcademyPasswordProblems(value).length === 0;
}

const SUPABASE_RULE_HINTS = [
  {
    test: (message) => /at least\s+\d+\s+characters?/i.test(message),
    hint: (message) => {
      const match = message.match(/at least\s+(\d+)\s+characters?/i);
      const length = match ? Number(match[1]) : ACADEMY_PASSWORD_MIN_LENGTH;
      return `Use at least ${length} characters.`;
    },
  },
  {
    test: (message) => /each:\s*(.+)$/i.test(message),
    hint: () =>
      "Use a mix of lowercase and uppercase letters, a number, and a symbol.",
  },
];

// Supabase reports these as "Password should ..." with no error code, and some
// failures carry only a status. Matching the text is the only way to turn them
// into something a student can act on instead of showing raw server wording.
export function getAcademyPasswordErrorMessage(error) {
  const code = String(error?.code ?? error?.error_code ?? "").toLowerCase();
  const raw = String(error?.message ?? error?.msg ?? "").trim();

  // weak_password arrives with the code set and often no usable text, so the
  // code has to be checked before the empty-message path.
  if (code.includes("weak_password")) {
    return "That password is too easy to guess. Mix uppercase, lowercase, a number, and a symbol.";
  }
  if (!raw) {
    return "We could not save that password. Try again, or reset it from the sign-in page.";
  }
  const message = raw.toLowerCase();
  if (!/password/.test(message)) return raw;

  for (const rule of SUPABASE_RULE_HINTS) {
    if (rule.test(message)) return rule.hint(message);
  }
  return "That password could not be saved. Use at least 8 characters with uppercase, lowercase, a number, and a symbol.";
}