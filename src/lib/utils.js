export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

const RATE_LIMIT_PATTERN =
  /rate.?limit|too many (requests|attempts)|email.*frequency|429/i;
const NETWORK_PATTERN =
  /failed to fetch|networkerror|network error|fetch.?failed|load failed|connection|timed? ?out|offline/i;

export function friendlyError(error, fallback = "Something went wrong. Please try again.") {
  const raw = (typeof error === "string" ? error : error?.message) || "";
  const message = String(raw).trim();

  if (!message) return fallback;

  if (RATE_LIMIT_PATTERN.test(message)) {
    return "You have sent too many requests recently. Please wait a few minutes and try again.";
  }

  if (NETWORK_PATTERN.test(message)) {
    return "We couldn't reach the server. Please check your internet connection and try again.";
  }

  if (message.length > 160) {
    return fallback;
  }

  return message;
}
