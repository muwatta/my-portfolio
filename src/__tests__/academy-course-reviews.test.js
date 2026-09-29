import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20261233000000_academy_course_reviews.sql",
  "utf8",
);
const lib = readFileSync("src/lib/academy.js", "utf8");
const ui = readFileSync("src/components/academy/CourseReviews.jsx", "utf8");
const page = readFileSync("src/pages/AcademyCourses.jsx", "utf8");

describe("a student can rate and review a course", () => {
  it("accepts a rating of one to five only", () => {
    expect(sql).toMatch(/rating smallint not null check \(rating between 1 and 5\)/);
  });

  it("allows exactly one review per person per course, in the database", () => {
    // A second review from a retried offline write must not create a duplicate.
    expect(sql).toMatch(
      /create unique index if not exists academy_course_reviews_once_per_user\s*on public\.academy_course_reviews \(course_id, user_id\)/,
    );
  });

  it("upserts rather than inserts, so editing and retrying are the same call", () => {
    expect(lib).toMatch(/onConflict: "course_id,user_id"/);
  });

  it("bounds the comment length", () => {
    expect(sql).toMatch(/char_length\(body\) <= 2000/);
  });
});

describe("a review can only ever speak for yourself", () => {
  it("inserts only as the signed in user", () => {
    expect(sql).toMatch(
      /create policy academy_course_reviews_self_write[\s\S]*?with check \(user_id = auth\.uid\(\)\)/,
    );
  });

  it("updates only your own", () => {
    expect(sql).toMatch(
      /create policy academy_course_reviews_self_update[\s\S]*?using \(user_id = auth\.uid\(\)\)\s*with check \(user_id = auth\.uid\(\)\)/,
    );
  });

  it("lets you take your own back, and a teacher remove anything", () => {
    expect(sql).toMatch(
      /using \(user_id = auth\.uid\(\) or public\.academy_is_teacher\(\)\)/,
    );
  });

  it("does not hide reviews from other students", () => {
    // Feedback is the point, so it is readable by anyone signed in.
    expect(sql).toMatch(
      /create policy academy_course_reviews_read[\s\S]*?for select to authenticated\s*using \(true\)/,
    );
  });
});

describe("reviews appear in real time", () => {
  it("is in the realtime publication", () => {
    expect(sql).toMatch(
      /alter publication supabase_realtime add table public\.academy_course_reviews/,
    );
  });

  it("catches the duplicate so a rerun does not fail the migration", () => {
    expect(sql).toMatch(/exception when duplicate_object then null/);
  });

  it("subscribes and refetches rather than patching state", () => {
    // Patching would let the list drift away from the database.
    expect(ui).toMatch(/channel\(`course-reviews:\$\{courseId\}`\)/);
    expect(ui).toMatch(/event: "\*"/);
    expect(ui).toMatch(/load\(\);/);
  });

  it("cleans the channel up when the course changes or the page closes", () => {
    expect(ui).toMatch(/supabase\.removeChannel\(channel\)/);
  });
});

describe("the summary is one round trip", () => {
  it("computes averages on the server", () => {
    expect(sql).toMatch(/create or replace function public\.academy_course_rating_summary/);
    expect(sql).toMatch(/round\(avg\(reviews\.rating\)::numeric, 2\)/);
  });

  it("hides a draft course from the summary", () => {
    expect(sql).toMatch(/c\.published or public\.academy_is_teacher\(\)/);
  });
});

describe("the review panel is usable on a phone", () => {
  it("gives every star a full tap target", () => {
    expect(ui).toMatch(/min-h-11 min-w-11/);
  });

  it("labels the stars for a screen reader", () => {
    expect(ui).toMatch(/aria-label=\{`\$\{value\} star\$\{value === 1 \? "" : "s"\}`\}/);
  });

  it("says how long the comment can be", () => {
    expect(ui).toMatch(/of \{MAX_BODY\} characters/);
  });

  it("can be edited and taken back by its author", () => {
    expect(ui).toMatch(/Update review/);
    expect(ui).toMatch(/Delete my review/);
  });

  it("is mounted on the page a student lands on after choosing a path", () => {
    expect(page).toMatch(/<CourseReviews courseId=\{activeCourse\.id\}/);
  });

  it("recomputes the average from what it just loaded", () => {
    expect(ui).toMatch(/reduce\(\(sum, review\) => sum \+ Number\(review\.rating\), 0\)/);
  });
});
