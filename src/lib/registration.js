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
