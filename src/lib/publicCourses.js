// The public course catalogue, read with the anon key.
//
// academy_courses has a published-only policy for anon (see migration
// 20261324000000), so this returns the marketing metadata for a course and
// nothing else. Weeks, lessons, exercises and materials are on their own tables
// and stay behind the sign-in; nothing here is paid content.
//
// It is separate from lib/academy.js on purpose. That module is the signed-in
// student's data path and is used by the app shell. This one is used by public
// marketing pages, including at build time, so it must never require a session.

import { isSupabaseConfigured, supabase } from "./supabase";
import { ACADEMY } from "../data/academy";

const CATALOGUE_COLUMNS =
  "id,slug,title,short_description,description,duration_weeks,language,sort_order";

const normalise = (row) => ({
  id: row.id,
  slug: row.slug,
  title: row.title || "",
  shortDescription: row.short_description || "",
  description: row.description || "",
  durationWeeks: Number(row.duration_weeks || 0),
  language: row.language || "",
  order: Number.isFinite(row.sort_order) ? row.sort_order : 0,
});

export async function fetchPublicCourses() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("academy_courses")
    .select(CATALOGUE_COLUMNS)
    .eq("published", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("Public course catalogue unavailable:", error.message);
    return [];
  }
  return (data || []).map(normalise);
}

export async function fetchPublicCourse(slug) {
  if (!slug || !isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("academy_courses")
    .select(CATALOGUE_COLUMNS)
    .eq("published", true)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return normalise(data);
}

/** The sentence the course pages and the sitemap both quote. */
export function courseSummary(course) {
  const short = (course.shortDescription || course.description || "")
    .trim()
    .replace(/\s+/g, " ");
  if (short) return short;
  return `${course.title} is a ${course.durationWeeks}-week course at ${ACADEMY.name}.`;
}

export const coursePath = (slug) => `/courses/${slug}`;
