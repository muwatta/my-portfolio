import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normaliseRubric, reviewStateLabel } from "../lib/academyGrading";

const MIGRATIONS = "supabase/migrations";
const allSql = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(`${MIGRATIONS}/${name}`, "utf8"))
  .join("\n");

function latestDefinition(name) {
  const matches = [
    ...allSql.matchAll(
      new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`, "g"),
    ),
  ];
  expect(matches.length, `${name} should exist`).toBeGreaterThan(0);
  return matches.at(-1)[0];
}

const queue = latestDefinition("academy_grading_queue");
const record = latestDefinition("academy_record_client_run");
const review = latestDefinition("academy_review_submission");
const publish = latestDefinition("academy_publish_result");

describe("the review gate", () => {
  it("keeps four distinct review states", () => {
    expect(allSql).toMatch(
      /review_state in \('unreviewed', 'in_review', 'reviewed', 'published'\)/,
    );
  });

  it("refuses to publish a grade that was never reviewed", () => {
    expect(publish).toMatch(/Review this submission before publishing/);
    expect(publish).toMatch(/review_state in \('reviewed', 'published'\)/);
  });

  it("only publishes once the teacher asks", () => {
    expect(review).toMatch(/'reviewed'/);
    expect(review).not.toMatch(/published_at := now\(\)/);
    expect(publish).toMatch(/published_at = now\(\)/);
  });

  it("records who reviewed and who published", () => {
    expect(review).toMatch(/reviewed_by = auth\.uid\(\)/);
    expect(publish).toMatch(/published_by = auth\.uid\(\)/);
  });

  it("tells the student their mark when it is published", () => {
    expect(publish).toMatch(/academy_notifications/);
    expect(publish).toMatch(/'feedback'/);
  });

  it("keeps the mark inside the points the assignment is worth", () => {
    expect(review).toMatch(/between 0 and %/);
    expect(review).toMatch(/coalesce\(points, 100\) into assignment_points/);
    expect(review).not.toMatch(/max_score, 100\)/);
  });
});

describe("browser run results are never a mark", () => {
  it("labels the source as the browser", () => {
    expect(record).toMatch(/'client_reported'/);
  });

  it("uses manual_review, the existing value that means a human must look", () => {
    expect(record).toMatch(/'manual_review'/);
    expect(record).not.toMatch(/unverified_pass/);
    expect(record).not.toMatch(/unverified_partial/);
  });

  it("keeps the counts in test_summary rather than widening the status enum", () => {
    expect(record).toMatch(/'passed', p_passed, 'total', p_total/);
    expect(record).toMatch(/'source', 'browser'/);
    expect(record).toMatch(/'verified', false/);
  });

  it("is idempotent on the client operation id, so a retry cannot double count", () => {
    expect(record).toMatch(/client_operation_id = p_client_operation_id/);
    expect(record).toMatch(/if created\.id is not null then\s*return created/);
  });

  it("rejects impossible pass counts", () => {
    expect(record).toMatch(/at least one test/);
    expect(record).toMatch(/between zero and the total/);
  });

  it("surfaces the unverified nature in the queue", () => {
    expect(queue).toMatch(/'client_ran_tests', r\.deterministic_source = 'client_reported'/);
  });
});

describe("the grading queue", () => {
  it("returns jsonb so no column type can drift out of step", () => {
    expect(queue).toMatch(/returns setof jsonb/);
    expect(queue).not.toMatch(/returns table \(/);
  });

  it("filters by course, topic, student and state", () => {
    expect(queue).toMatch(/p_course_id is null or coalesce\(a\.course_id, w\.course_id\) = p_course_id/);
    expect(queue).toMatch(/p_topic_id is null or a\.lesson_id = p_topic_id/);
    expect(queue).toMatch(/p_student_id is null or s\.student_id = p_student_id/);
    expect(queue).toMatch(/p_review_state is null/);
  });

  it("joins the student, topic and course in one call", () => {
    expect(queue).toMatch(/join public\.academy_profiles p on p\.id = s\.student_id/);
    expect(queue).toMatch(/join auth\.users u on u\.id = s\.student_id/);
    expect(queue).toMatch(/'lesson_title', l\.title/);
    expect(queue).toMatch(/'course_title', c\.title/);
  });

  it("carries the rubric so the grading screen needs no second call", () => {
    expect(queue).toMatch(/'rubric', a\.rubric/);
  });

  it("is staff only and revoked from anon", () => {
    expect(queue).toMatch(/academy_is_teacher\(\)/);
    expect(allSql).toMatch(
      /revoke execute on function public\.academy_grading_queue\(uuid, uuid, uuid, text\) from public, anon/,
    );
  });
});

describe("rubric normalisation", () => {
  it("returns nothing for a missing rubric", () => {
    expect(normaliseRubric(null)).toEqual([]);
    expect(normaliseRubric(undefined)).toEqual([]);
  });

  it("reads a plain list of strings", () => {
    expect(normaliseRubric(["Correctness", "Clarity"])).toEqual([
      { criterion: "Correctness", max: null, weight: null },
      { criterion: "Clarity", max: null, weight: null },
    ]);
  });

  it("reads the common object shapes", () => {
    expect(normaliseRubric([{ name: "Correctness", max_points: 10 }])).toEqual([
      { criterion: "Correctness", max: 10, weight: null },
    ]);
    expect(normaliseRubric({ items: [{ title: "Clarity", points: 5 }] })).toEqual([
      { criterion: "Clarity", max: 5, weight: null },
    ]);
  });

  it("reads a keyed object", () => {
    const result = normaliseRubric({ Correctness: { max: 8 } });
    expect(result).toEqual([{ criterion: "Correctness", max: 8, weight: null }]);
  });

  it("drops entries with no criterion rather than rendering a blank row", () => {
    expect(normaliseRubric([{ max: 5 }])).toEqual([]);
  });
});

describe("review state wording", () => {
  it("says plainly that a review is not yet visible to the student", () => {
    expect(reviewStateLabel("unreviewed")).toMatch(/Waiting to be graded/);
    expect(reviewStateLabel("reviewed")).toMatch(/not published yet/);
    expect(reviewStateLabel("published")).toMatch(/Published/);
  });
});

describe("the grading screen", () => {
  const inbox = readFileSync(
    "src/components/academy/GradingInbox.jsx",
    "utf8",
  );

  it("cannot publish before a review exists", () => {
    expect(inbox).toMatch(
      /disabled=\{busy \|\| !\["reviewed", "published"\]\.includes\(current\.review_state\)\}/,
    );
  });

  it("is keyboard friendly but never steals keys while typing", () => {
    expect(inbox).toMatch(/event\.key === "j"/);
    expect(inbox).toMatch(/event\.key === "Enter"/);
    expect(inbox).toMatch(/const typing = tag === "INPUT"/);
    expect(inbox).toMatch(/if \(typing\) return/);
  });

  it("tells the teacher that a browser run is only a hint", () => {
    expect(inbox).toMatch(/server did not run/);
    expect(inbox).toMatch(/treat it as a hint, not a mark/);
  });

  it("rejects a missing or out-of-range mark before saving a review", () => {
    expect(inbox).toMatch(/const numericScore = String\(score\)\.trim\(\)/);
    expect(inbox).toMatch(/numericScore > maximum/);
    expect(inbox).toMatch(/Enter a mark from 0 to \$\{maximum\}/);
    expect(inbox).toMatch(/max=\{current\.max_score \?\? 100\}/);
  });
});
