import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
const { from, rpc } = mocks;

vi.mock("../lib/supabase", () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
  isSupabaseConfigured: true,
}));

import { getAcademyRegistrationCodes } from "../lib/academy";

function chain(result) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    in: vi.fn(() => builder),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

describe("registration number listing", () => {
  beforeEach(() => {
    from.mockReset();
    rpc.mockReset();
  });

  it("uses the server RPC when it succeeds", async () => {
    rpc.mockResolvedValue({
      data: [{ registration_number: "ATE-26-001", status: "claimed" }],
      error: null,
    });

    const result = await getAcademyRegistrationCodes();

    expect(rpc).toHaveBeenCalledWith("academy_admin_registration_list", {
      search_text: null,
      status_filter: null,
    });
    expect(from).not.toHaveBeenCalled();
    expect(result.data).toHaveLength(1);
  });

  it("falls back to direct reads when the RPC rejects the request", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "something went wrong in the database" },
    });

    from.mockImplementation((table) => {
      if (table === "academy_registration_codes") {
        return chain({
          data: [
            {
              id: "c1",
              registration_number: "ATE-26-001",
              status: "claimed",
              claimed_by: "s1",
              registration_year: 2026,
              serial_number: 1,
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
          error: null,
        });
      }
      if (table === "academy_profiles") {
        return chain({
          data: [{ id: "s1", display_name: "Ada", current_course_id: "co1" }],
          error: null,
        });
      }
      return chain({ data: [{ id: "co1", title: "Python" }], error: null });
    });

    const result = await getAcademyRegistrationCodes();

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      {
        registration_number: "ATE-26-001",
        status: "claimed",
        student_id: "s1",
        student_name: "Ada",
        student_email: null,
        course_title: "Python",
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("explains an administrator-rights rejection instead of falling back", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Only Academy administrators can view registration numbers.",
      },
    });

    const result = await getAcademyRegistrationCodes();

    expect(result.data).toEqual([]);
    expect(result.error.message).toMatch(/not registered as an Academy administrator/i);
    expect(from).not.toHaveBeenCalled();
  });
});
