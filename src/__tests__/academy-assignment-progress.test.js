import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabase } = vi.hoisted(() => ({
  supabase: { from: vi.fn() },
}));

vi.mock("../lib/supabase", () => ({ supabase }));

const { getAcademyAssignments } = await import("../lib/academy");

function queryFor(result) {
  const promise = Promise.resolve(result);
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    or: vi.fn(() => query),
    maybeSingle: vi.fn(() => promise),
    then: (resolve, reject) => promise.then(resolve, reject),
  };
  return query;
}

describe("C++ assignment marks and progression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockImplementation((table) => {
      if (table === "academy_enrollments") {
        return queryFor({
          data: {
            academy_courses: {
              id: "cpp-course",
              language: "cpp",
            },
          },
          error: null,
        });
      }
      if (table === "academy_assignments") {
        return queryFor({
          data: [
            {
              id: "week-one",
              title: "Week 1",
              retry_limit: 3,
              academy_weeks: { week_number: 1, title: "Week 1" },
            },
            {
              id: "week-two",
              title: "Week 2",
              retry_limit: 3,
              academy_weeks: { week_number: 2, title: "Week 2" },
            },
            {
              id: "week-three",
              title: "Week 3",
              retry_limit: 3,
              academy_weeks: { week_number: 3, title: "Week 3" },
            },
          ],
          error: null,
        });
      }
      if (table === "academy_submissions") {
        return queryFor({
          data: [
            {
              assignment_id: "week-one",
              attempt_number: 1,
              status: "graded",
              academy_submission_results: [{ final_score: 60 }],
            },
            {
              assignment_id: "week-one",
              attempt_number: 2,
              status: "graded",
              academy_submission_results: [{ final_score: 80 }],
            },
            {
              assignment_id: "week-two",
              attempt_number: 1,
              status: "submitted",
              academy_submission_results: [{ final_score: null }],
            },
          ],
          error: null,
        });
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("keeps prior work visible, preserves the best mark, and waits for grading to unlock later weeks", async () => {
    const result = await getAcademyAssignments("retake-student");

    expect(result.error).toBeNull();
    expect(result.data.map((assignment) => assignment.id)).toEqual([
      "week-one",
      "week-two",
      "week-three",
    ]);
    expect(result.data[0]).toMatchObject({
      completed_mark: 80,
      attempts_used: 2,
      locked: false,
    });
    expect(result.data[1]).toMatchObject({
      completed_mark: null,
      attempts_used: 1,
      locked: false,
    });
    expect(result.data[2].locked).toBe(true);
    expect(result.data[0].latest_submission_status).toBe("graded");
    expect(result.data[1].latest_submission_status).toBe("submitted");
  });

  it("deduplicates identical weekly tasks and prefers the lesson-linked copy", async () => {
    const duplicate = {
      id: "week-one-duplicate",
      course_id: "cpp-course",
      title: "Duplicate Week 1",
      instructions: "Print the same output.",
      starter_code: "int main() {}",
      lesson_id: null,
      created_at: "2026-10-10",
      retry_limit: 3,
      academy_weeks: { week_number: 1, title: "Week 1" },
    };
    const canonical = {
      ...duplicate,
      id: "week-one-canonical",
      title: "Week 1 lesson task",
      lesson_id: "lesson-1",
      created_at: "2026-10-09",
    };
    supabase.from.mockImplementation((table) => {
      if (table === "academy_enrollments") {
        return queryFor({
          data: {
            academy_courses: {
              id: "cpp-course",
              language: "cpp",
            },
          },
          error: null,
        });
      }
      if (table === "academy_assignments") {
        return queryFor({ data: [duplicate, canonical], error: null });
      }
      if (table === "academy_submissions") {
        return queryFor({ data: [], error: null });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await getAcademyAssignments("duplicate-student");

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("week-one-canonical");
  });
});
