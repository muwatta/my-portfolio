// The academy's public name, in one place.
//
// It was "Algorise Tech Explorers" in the app and "Muwatta Academy" in the SEO
// copy, which is two names for one thing. Search engines resolve an entity by
// consistent naming, so the same string has to appear in the page titles, the
// footer link, the structured data and the sitemap. Plain data with no
// import.meta.env in it, so the build scripts can import this too and the
// sitemap cannot drift from the pages.
//
// Kept apart from SITE in lib/seo.js on purpose: SITE is the portfolio, this is
// the product the portfolio owner teaches through.

export const ACADEMY = {
  name: "Algorise Tech Explorers",
  path: "/academy",
  url: "https://www.muwatta.com.ng/academy",
  coursesPath: "/courses",
};

/** "C++ for Embedded Systems | Algorise Tech Explorers" */
export const academyCourseTitle = (courseTitle) =>
  `${courseTitle} | ${ACADEMY.name}`;
