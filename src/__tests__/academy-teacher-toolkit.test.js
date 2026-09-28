import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gradebookToCsv } from "../lib/academyTeacher";

const MIGRATIONS = "supabase/migrations";
const allSql = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(`${MIGRATIONS}/${name}`, "utf8"))
  .join("\n");

function latestDefinition(name) {
  const matches = [
    ...allSql.matchAll(
      new RegExp(
        `create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`,
        "g",
      ),
    ),
  ];
  expect(matches.length, `${name} should exist`).toBeGreaterThan(0);
  return matches.at(-1)[0];
}

const announce = latestDefinition("academy_announce");
const gradebook = latestDefinition("academy_gradebook");
const dashboard = latestDefinition("academy_teacher_dashboard");

describe("announcements", () => {
  it("needs a title, a message and an audience", () => {
    expect(announce).toMatch(/needs a title and a message/);
    expect(announce).toMatch(/Choose a course, a class or a student/);
  });

  it("reaches a course, a class or one student", () => {
    expect(announce).toMatch(/p_course_id is not null/);
    expect(announce).toMatch(/p_class_id is not null/);
    expect(announce).toMatch(/p_student_id is not null/);
  });

  it("only reaches actively enrolled students of that course", () => {
    expect(announce).toMatch(/e\.status = 'active'/);
  });

  it("tells the teacher how many people it reached", () => {
    expect(announce).toMatch(/returns integer/);
    expect(announce).toMatch(/select count\(\*\) into recipients/);
    expect(announce).toMatch(/return recipients/);
  });

  it("writes to the activity feed, which had no writer at all", () => {
    expect(announce).toMatch(/insert into public\.academy_activity_feed/);
    expect(allSql).toMatch(/'admin_view',\s*\n\s*'announcement'/);
  });
});

describe("the gradebook", () => {
  it("is staff only and scoped to one course", () => {
    expect(gradebook).toMatch(/academy_is_teacher\(\)/);
    expect(gradebook).toMatch(/p_course_id is null then/);
  });

  it("returns one row per enrolled student", () => {
    expect(gradebook).toMatch(/from public\.academy_enrollments e/);
    expect(gradebook).toMatch(/e\.status = 'active'/);
  });

  it("counts only published marks towards the total", () => {
    expect(gradebook).toMatch(/r\.review_state = 'published'/);
  });

  it("carries the per task cells so the table needs no second call", () => {
    expect(gradebook).toMatch(/'results', coalesce\(/);
    expect(gradebook).toMatch(/'max_points', t\.max_points/);
  });

  it("returns jsonb so the shape can grow without a migration", () => {
    expect(gradebook).toMatch(/returns setof jsonb/);
  });
});

describe("the teacher dashboard", () => {
  it("answers everything in one call", () => {
    expect(dashboard).toMatch(/returns jsonb/);
    ["needs_grading", "due_this_week", "inactive_students", "completion", "recent_activity", "totals"].forEach(
      (key) => expect(dashboard).toContain(`'${key}'`),
    );
  });

  it("orders inside the aggregate, not on the subquery", () => {
    // order by on a subquery feeding jsonb_agg is read as a grouping column and
    // fails with 42803, so every list orders twice: once to limit, once to sort.
    const lists = dashboard.match(/jsonb_agg\(item order by/g) ?? [];
    expect(lists.length).toBeGreaterThanOrEqual(4);
    expect(dashboard).not.toMatch(/\)\s*,?\s*\n\s*'[^']+', coalesce\(\(\s*\n\s*select jsonb_agg\([^)]*\)\s*\n\s*from [^(]*\([^)]*\)\s*\n\s*where[^;]*order by/);
  });

  it("includes reviewed but unpublished work so nothing is hidden", () => {
    expect(dashboard).toMatch(
      /'unreviewed', 'in_review', 'reviewed'\)/,
    );
  });

  it("treats ten quiet days as inactive, long enough to cover a weekend", () => {
    expect(dashboard).toMatch(/>= 10/);
  });

  it("only counts topics that are published and released", () => {
    expect(dashboard).toMatch(
      /l\.status = 'published'\s*\n\s*and \(l\.release_at is null or l\.release_at <= now\(\)\)/,
    );
  });
});

describe("gradebook CSV export", () => {
  const rows = [
    {
      student_name: "Ada Lovelace",
      student_email: "ada@example.com",
      total_earned: 18,
      total_possible: 20,
      results: [
        { assignment_id: "a1", title: "Loops", max_points: 10, score: 8, state: "published" },
        { assignment_id: "a2", title: "Functions", max_points: 10, score: 10, state: "published" },
      ],
    },
    {
      student_name: "Grace Hopper",
      student_email: "grace@example.com",
      total_earned: 0,
      total_possible: 20,
      results: [
        { assignment_id: "a1", title: "Loops", max_points: 10, state: "unsubmitted" },
      ],
    },
  ];

  it("writes a header row naming every task and its maximum", () => {
    const csv = gradebookToCsv(rows);
    const [header] = csv.split("\r\n");
    expect(header).toContain("Student");
    expect(header).toContain("Loops (10)");
    expect(header).toContain("Functions (10)");
    expect(header).toContain("Total");
  });

  it("writes one row per student with their totals", () => {
    // The file ends with a newline, which is what a spreadsheet expects, so the
    // trailing empty element is dropped before counting.
    const lines = gradebookToCsv(rows).split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Ada Lovelace");
    expect(lines[1]).toContain("90");
  });

  it("leaves a cell blank when the mark is not published yet", () => {
    const lines = gradebookToCsv(rows).split("\r\n").filter(Boolean);
    expect(lines[2]).toContain("Grace Hopper");
    expect(lines[2]).not.toContain("held");
  });

  it("neutralises a cell that a spreadsheet would run as a formula", () => {
    const hostile = [
      {
        student_name: "=cmd|'/c calc'!A1",
        student_email: "+danger@example.com",
        total_earned: 0,
        total_possible: 10,
        results: [],
      },
    ];
    const csv = gradebookToCsv(hostile);
    expect(csv).toContain("\"'=cmd");
    expect(csv).toContain("\"'+danger");
  });

  it("escapes embedded quotes so the file stays valid", () => {
    const quoted = [
      {
        student_name: 'Grace "Amazing" Hopper',
        student_email: "g@example.com",
        total_earned: 1,
        total_possible: 10,
        results: [],
      },
    ];
    expect(gradebookToCsv(quoted)).toContain('"Grace ""Amazing"" Hopper"');
  });

  it("returns nothing rather than a broken file for an empty gradebook", () => {
    expect(gradebookToCsv([])).toBe("");
    expect(gradebookToCsv(null)).toBe("");
  });
});

describe("the teacher dashboard page replaced the placeholder", () => {
  it("no longer routes the 34 line stub", () => {
    const app = readFileSync("src/App.jsx", "utf8");
    expect(app).not.toContain("AcademyTeacherPlaceholder");
    expect(app).toContain("AcademyTeacherDashboard");
  });

  it("links the grading queue from the dashboard", () => {
    const page = readFileSync("src/pages/AcademyTeacherDashboard.jsx", "utf8");
    expect(page).toMatch(/to="\/academy\/admin\/submissions"/);
  });
});
