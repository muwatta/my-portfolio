import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
const { from, rpc } = mocks;

vi.mock("../lib/supabase", () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
  isSupabaseConfigured: true,
}));

import {
  getAcademyAdminPractice,
  getAcademyProjects,
  getAcademyTeacherAssignments,
} from "../lib/academy";

function builder(result) {
  const b = {
    select: vi.fn(() => b),
    order: vi.fn(() => b),
    in: vi.fn(() => b),
    eq: vi.fn(() => b),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (res, rej) => Promise.resolve(result).then(res, rej),
  };
  return b;
}

describe("admin content ordering", () => {
  beforeEach(() => {
    from.mockReset();
    rpc.mockReset();
  });

  it("orders practice exercises by week, then lesson, then exercise order", async () => {
    const lessons = {
      data: [
        {
          id: "l2",
          title: "Week 2 lesson",
          lesson_number: 1,
          sort_order: 1,
          academy_weeks: { week_number: 2 },
        },
        {
          id: "l1",
          title: "Week 1 lesson",
          lesson_number: 1,
          sort_order: 1,
          academy_weeks: { week_number: 1 },
        },
      ],
      error: null,
    };
    const exercises = {
      data: [
        { id: "e-late", lesson_id: "l2", title: "Zebra", sort_order: 0 },
        { id: "e-b", lesson_id: "l1", title: "B", sort_order: 1 },
        { id: "e-a", lesson_id: "l1", title: "A", sort_order: 0 },
        { id: "e-orphan", lesson_id: null, title: "Orphan", sort_order: 0 },
      ],
      error: null,
    };
    from.mockReturnValue(builder(lessons));
    rpc.mockResolvedValue(exercises);

    const result = await getAcademyAdminPractice();

    expect(result.data.lessons.map((l) => l.id)).toEqual(["l1", "l2"]);
    expect(result.data.exercises.map((e) => e.id)).toEqual([
      "e-a",
      "e-b",
      "e-late",
      "e-orphan",
    ]);
  });

  it("orders project milestones by milestone number", async () => {
    from.mockReturnValue(
      builder({
        data: [
          {
            id: "p1",
            title: "Capstone",
            academy_project_milestones: [
              { id: "m3", milestone_number: 3, title: "Third" },
              { id: "m1", milestone_number: 1, title: "First" },
              { id: "m2", milestone_number: 2, title: "Second" },
            ],
          },
        ],
        error: null,
      }),
    );

    const result = await getAcademyProjects("student-1");

    expect(
      result.data[0].academy_project_milestones.map((m) => m.milestone_number),
    ).toEqual([1, 2, 3]);
  });

  it("requests assignments in curriculum order rather than newest first", async () => {
    const chain = builder({ data: [], error: null });
    from.mockReturnValue(chain);

    await getAcademyTeacherAssignments();

    const columns = chain.order.mock.calls.map((call) => call[0]);
    expect(columns).toEqual(["course_id", "week_id", "due_at", "title"]);
    expect(columns).not.toContain("created_at");
  });
});
