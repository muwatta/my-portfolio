// Warms the academy when a visitor signals intent to open it.
//
// A cold click on "Academy" had to fetch 9 chunks. Two changes cut that: the
// public pages no longer mount the auth provider, and these prefetches cover
// what is left. Hover and focus are the interesting ones, because somebody
// pointing at a link is a signal they are about to click it, and a keyboard user
// tabbing onto it has usually already decided.
//
const loaded = new Map();

/** Import once, and never let a prefetch failure surface as an unhandled rejection. */
const warm = (key, load) => {
  if (loaded.has(key)) return loaded.get(key);
  const promise = load().catch(() => null);
  loaded.set(key, promise);
  return promise;
};

/** The academy's front page and the shell it shares with the FAQ. */
export const preloadAcademyPublic = () => {
  warm("home", () => import("../pages/AcademyHome"));
  warm("footer", () => import("../components/academy/AcademyFooter"));
};

/**
 * The sign-in pages and the auth provider, which is what actually pulls in
 * Supabase. Warming this on hover is what makes "Academy" then "Sign in" feel
 * like a page change rather than a reload.
 */
export const preloadAcademyAuth = () => {
  warm("auth", () => import("../context/AcademyAuthContext"));
  warm("login", () => import("../pages/AcademyLogin"));
};

/** Called on hover or focus of a link into the academy. */
export const preloadAcademy = () => {
  preloadAcademyPublic();
  preloadAcademyAuth();
};
