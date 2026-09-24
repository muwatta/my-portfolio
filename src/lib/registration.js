const ACADEMY_REGISTRATION_NUMBER_PATTERN = /^ATE-[0-9]{2}-[0-9]{3}$/;

export function normalizeAcademyRegistrationNumber(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function isValidAcademyRegistrationNumber(value) {
  const normalized = normalizeAcademyRegistrationNumber(value);
  return (
    ACADEMY_REGISTRATION_NUMBER_PATTERN.test(normalized) &&
    Number(normalized.slice(-3)) >= 1
  );
}

export function getAcademySignupErrorMessage(error) {
  const code = String(error?.code ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();
  const isRateLimited =
    error?.status === 429 ||
    code.includes("rate_limit") ||
    message.includes("too many requests") ||
    message.includes("too many signup attempts");
  const isExistingAccount =
    code.includes("already") ||
    code.includes("registered") ||
    code.includes("user_exists") ||
    message.includes("already registered") ||
    message.includes("already been registered");

  if (isRateLimited) {
    return "Too many signup attempts were made recently. Please wait a few minutes before trying again.";
  }
  if (isExistingAccount) {
    return "An Academy account may already exist for this email. Sign in or check your email for the confirmation link.";
  }
  return "We couldn't verify this registration number. Please check your Academy registration details or contact your teacher.";
}
