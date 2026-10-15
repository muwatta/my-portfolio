import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  eq: vi.fn(),
  inFn: vi.fn(),
}));

const { from, rpc, select, order, eq, inFn } = mocks;

const orderResult = { data: [], error: null };
const orderChain = {
  order,
  eq,
  in: inFn,
  then: (resolve, reject) => Promise.resolve(orderResult).then(resolve, reject),
};

vi.mock("../lib/supabase", () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
  isSupabaseConfigured: true,
}));

import {
  getAcademyTeacherClasses,
  getAcademyTeacherSubmissions,
  getAcademyTeacherAssignments,
  getAcademySubmissionHistory,
} from "../lib/academy";

describe("Academy data-layer embeds", () => {
  beforeEach(() => {
    from.mockReset();
    rpc.mockReset();
    select.mockReset();
    order.mockReset();
    eq.mockReset();
    inFn.mockReset();
    orderResult.data = [];
    orderResult.error = null;
    order.mockImplementation(() => orderChain);
    eq.mockReturnValue(orderChain);
    inFn.mockResolvedValue({ data: [], error: null });
    select.mockReturnValue(orderChain);
    from.mockReturnValue({ select });
  });

  it("class list no longer embeds academy_profiles through class members", async () => {
    const rowResult = {
      data: [
        {
          id: "class-1",
          name: "Group A",
          academy_class_members: [{ student_id: "s1", status: "active" }],
        },
      ],
      error: null,
    };
    const chain = {
      in: inFn,
      order: vi.fn(() => chain),
      then: (res, rej) => Promise.resolve(rowResult).then(res, rej),
    };
    select.mockReturnValue(chain);
    inFn.mockResolvedValue({ data: [{ id: "s1", display_name: "Ada" }], error: null });

    const result = await getAcademyTeacherClasses();
    const usedSelect = select.mock.calls.at(-1)[0];
    expect(usedSelect).not.toMatch(/academy_profiles\(/);
    expect(result.data[0].academy_class_members[0].academy_profiles).toEqual({
      display_name: "Ada",
    });
  });

  it("submissions resolve the student name with an explicit FK hint", async () => {
    const rowResult = {
      data: [
        {
          id: "sub-1-old",
          assignment_id: "a1",
          student_id: "s1",
          attempt_number: 1,
          submitted_at: "2026-10-01",
        },
        {
          id: "sub-1-latest",
          assignment_id: "a1",
          student_id: "s1",
          attempt_number: 2,
          submitted_at: "2026-10-02",
        },
        {
          id: "sub-2",
          assignment_id: "a1",
          student_id: "s2",
          attempt_number: 1,
          submitted_at: "2026-10-03",
        },
      ],
      error: null,
    };
    const chain = {
      in: inFn,
      order: vi.fn(() => chain),
      then: (res, rej) => Promise.resolve(rowResult).then(res, rej),
    };
    select.mockReturnValue(chain);
    inFn.mockResolvedValue({ data: [{ id: "s1", display_name: "Ada" }], error: null });

    const result = await getAcademyTeacherSubmissions();
    const usedSelect = select.mock.calls.at(-1)[0];
    expect(usedSelect).not.toMatch(/academy_profiles!/);
    expect(result.data[0].academy_profiles).toEqual({ display_name: "Ada" });
    expect(result.data.map(({ id }) => id)).toEqual(["sub-1-latest", "sub-2"]);
    expect(result.data[0].attempts_count).toBe(2);
  });

  it("shows students only the latest submission and retains the attempt count", async () => {
    orderResult.data = [
      { id: "latest", attempt_number: 3 },
      { id: "older", attempt_number: 2 },
      { id: "oldest", attempt_number: 1 },
    ];

    const result = await getAcademySubmissionHistory("a1", "s1");

    expect(result.data).toEqual([
      { id: "latest", attempt_number: 3, attempts_count: 3 },
    ]);
  });

  it("disambiguates the assignments-to-course relationship", async () => {
    await getAcademyTeacherAssignments();
    const usedSelect = select.mock.calls.at(-1)[0];
    expect(usedSelect).toContain(
      "academy_courses!academy_assignments_course_id_fkey(title)",
    );
    expect(usedSelect).not.toMatch(/[^!]academy_courses\(/);
  });
});
