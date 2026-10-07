export const TURNSTILE_SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? "";
export const isTurnstileRequired =
  import.meta.env.PROD || Boolean(TURNSTILE_SITE_KEY);
