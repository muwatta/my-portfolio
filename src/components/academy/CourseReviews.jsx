import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteAcademyCourseReview,
  getAcademyCourseReviews,
  saveAcademyCourseReview,
} from "../../lib/academy";
import { supabase } from "../../lib/supabase";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";
import { friendlyError } from "../../lib/utils";

const MAX_BODY = 2000;

// Reviews and ratings, updating in real time.
//
// The table is in the realtime publication, so a rating written by one student
// appears for everyone else without a reload. That is the point of the feature:
// feedback is only useful if it is visible while the course is still fresh.
export default function CourseReviews({ courseId }) {
  const { user } = useAcademyAuth();
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ average: null, count: 0 });
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const mine = useMemo(
    () => reviews.find((review) => review.user_id === user?.id) ?? null,
    [reviews, user?.id],
  );

  const load = useCallback(async () => {
    const result = await getAcademyCourseReviews(courseId);
    if (result.error) {
      setError(friendlyError(result.error, "Reviews could not be loaded."));
      setLoading(false);
      return;
    }
    const rows = result.data ?? [];
    setReviews(rows);
    if (rows.length) {
      const total = rows.reduce((sum, review) => sum + Number(review.rating), 0);
      setSummary({ average: total / rows.length, count: rows.length });
    } else {
      setSummary({ average: null, count: 0 });
    }
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    load();
  }, [courseId, load]);

  // Realtime. A changed rating from anybody, including an edit to somebody
  // else's review, is refetched rather than patched, so the list cannot drift
  // out of step with the database.
  useEffect(() => {
    if (!courseId) return undefined;
    const channel = supabase
      .channel(`course-reviews:${courseId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "academy_course_reviews",
          filter: `course_id=eq.${courseId}`,
        },
        () => {
          load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [courseId, load]);

  useEffect(() => {
    if (mine) {
      setRating(Number(mine.rating));
      setBody(mine.body ?? "");
    }
  }, [mine]);

  async function submit(event) {
    event.preventDefault();
    if (!rating) return setError("Choose a rating from 1 to 5 stars.");
    setBusy(true);
    setError("");
    setMessage("");
    const result = await saveAcademyCourseReview({ courseId, rating, body });
    setBusy(false);
    if (result.error) {
      setError(friendlyError(result.error, "Your review could not be saved."));
      return;
    }
    setMessage(
      mine
        ? "Review updated. Thank you."
        : "Thank you. Your review is now visible to everyone.",
    );
    await load();
  }

  async function remove() {
    setBusy(true);
    setError("");
    const result = await deleteAcademyCourseReview(courseId);
    setBusy(false);
    if (result.error) {
      setError(friendlyError(result.error, "Your review could not be removed."));
      return;
    }
    setRating(0);
    setBody("");
    setMessage("Your review was removed.");
    await load();
  }

  if (!courseId) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Reviews</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {summary.average === null ? (
            "No reviews yet"
          ) : (
            <>
              <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {summary.average.toFixed(1)}
              </span>{" "}
              out of 5 &middot; {summary.count}{" "}
              {summary.count === 1 ? "review" : "reviews"}
            </>
          )}
        </p>
      </header>

      {message && (
        <p
          role="status"
          className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <form className="mt-4 space-y-3" onSubmit={submit}>
        <fieldset>
          <legend className="text-sm font-semibold">
            {mine ? "Your rating" : "Rate this course"}
          </legend>
          <div className="mt-1 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
                aria-pressed={rating === value}
                onMouseEnter={() => setHover(value)}
                onMouseLeave={() => setHover(0)}
                onFocus={() => setHover(value)}
                onBlur={() => setHover(0)}
                onClick={() => setRating(value)}
                className={`min-h-11 min-w-11 rounded-lg text-2xl leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                  (hover || rating) >= value
                    ? "text-amber-500"
                    : "text-slate-300 dark:text-slate-600"
                }`}
              >
                &#9733;
              </button>
            ))}
          </div>
        </fieldset>

        <label className="label">
          {mine ? "Edit your review" : "Add a review"}
          <textarea
            className="field min-h-24 resize-y"
            value={body}
            maxLength={MAX_BODY}
            placeholder="What worked, what was unclear, what would you change?"
            onChange={(event) => setBody(event.target.value)}
          />
          <span className="text-xs text-slate-500">
            Optional. {body.length} of {MAX_BODY} characters.
          </span>
        </label>

        <div className="flex flex-wrap gap-3">
          <button className="button-primary" type="submit" disabled={busy || !rating}>
            {busy ? "Saving..." : mine ? "Update review" : "Post review"}
          </button>
          {mine && (
            <button
              className="button-secondary text-rose-600"
              type="button"
              disabled={busy}
              onClick={remove}
            >
              Delete my review
            </button>
          )}
        </div>
      </form>

      <div className="mt-6 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        {loading ? (
          <p className="text-sm text-slate-500">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Be the first to review this course. Others see it straight away.
          </p>
        ) : (
          reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60"
            >
              <header className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {review.user_id === user?.id
                    ? "You"
                    : review.academy_profiles?.display_name || "Student"}
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {"\u2605".repeat(Number(review.rating))}
                </p>
              </header>
              {review.body ? (
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                  {review.body}
                </p>
              ) : (
                <p className="mt-1 text-sm italic text-slate-400">
                  No comment, just a rating.
                </p>
              )}
              <p className="mt-1 text-xs text-slate-400">
                {new Date(review.updated_at).toLocaleDateString()}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
