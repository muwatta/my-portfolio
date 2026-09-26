import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  inFn: vi.fn(),
}));

const { from, rpc, select, order, inFn } = mocks;

const orderResult = { data: [], error: null };
const orderChain = {
  order,
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
} from "../lib/academy";

describe("Academy data-layer embeds", () => {
  beforeEach(() => {
    from.mockReset();
    rpc.mockReset();
    select.mockReset();
    order.mockReset();
    inFn.mockReset();
    order.mockImplementation(() => orderChain);
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
    const rowResult = { data: [{ id: "sub-1", student_id: "s1" }], error: null };
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
