// Shared build-time read of the public academy catalogue.
//
// Prerendering and the sitemap must agree on which courses are public, so both
// read from here rather than each inventing a rule. Uses the anon key, because
// the course catalogue is public by design: the marketing pages for these
// courses have to be readable by a crawler that has never signed in.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function readLocalEnv(rootDir) {
  const file = join(rootDir, ".env.local");
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*["']?(.*?)["']?\s*$/))
      .filter(Boolean)
      .map(([, key, value]) => [key, value]),
  );
}

const ANON_KEYS = [
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
];

export function supabasePublicConfig(rootDir) {
  const env = { ...readLocalEnv(rootDir), ...process.env };
  const url = env.VITE_SUPABASE_URL;
  const key = ANON_KEYS.map((name) => env[name]).find(Boolean);
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

/**
 * Published courses.
 *
 * Reads with the anon key on purpose. academy_courses has a published-only
 * policy for anon, which is what a public course landing page needs: the
 * catalogue is marketing content, and a crawler has never signed in. Lesson
 * content stays behind authenticated on its own tables, so nothing behind the
 * login is exposed by reading this one.
 *
 * Returns [] rather than throwing when the database is unreachable: a build must
 * not fall over because a network call failed, and an empty catalogue degrades
 * to the static pages that are already in the sitemap.
 */
export async function fetchPublicCourses(rootDir) {
  const config = supabasePublicConfig(rootDir);
  if (!config) return [];

  const headers = { apikey: config.key, Authorization: `Bearer ${config.key}` };
  const query = new URLSearchParams({
    select: "slug,title,short_description,description,duration_weeks,language,published",
    published: "eq.true",
    order: "sort_order",
  });

  try {
    const response = await fetch(`${config.url}/rest/v1/academy_courses?${query}`, {
      headers,
    });
    if (!response.ok) return [];
    const courses = await response.json();
    return courses.filter((course) => course.slug && course.published);
  } catch {
    return [];
  }
}

/** The course description is the only field the pages have to agree on. */
export function courseDescription(course) {
  const short = (course.short_description || "").trim();
  if (short) return short;
  const full = (course.description || "").trim().replace(/\s+/g, " ");
  return full.length > 200 ? `${full.slice(0, 197).trimEnd()}…` : full;
}

