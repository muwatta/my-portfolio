import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/offlineStore", () => ({
  OFFLINE_STORES: { assignments: "assignments" },
  getOfflineRecord: vi.fn(),
  putOfflineRecord: vi.fn(),
}));

const { getOfflineRecord, putOfflineRecord } = await import("../lib/offlineStore");
const { fetchWithOfflineFallback } = await import("../lib/academyOffline");

describe("fetchWithOfflineFallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    getOfflineRecord.mockResolvedValue(null);
    putOfflineRecord.mockResolvedValue(undefined);
  });

  it("preserves an online query error when there is no cached snapshot", async () => {
    const queryError = { code: "PGRST200", message: "Relationship not found" };
    const result = await fetchWithOfflineFallback({
      userId: "student-1",
      store: "assignments",
      id: "assignment-1",
      fetcher: async () => ({ data: null, error: queryError, configured: true }),
    });

    expect(result.error).toBe(queryError);
    expect(result.offline).toBe(false);
  });

  it("uses an offline snapshot after an online query error", async () => {
    getOfflineRecord.mockResolvedValue({ id: "assignment-1", title: "Cached" });
    const result = await fetchWithOfflineFallback({
      userId: "student-1",
      store: "assignments",
      id: "assignment-1",
      fetcher: async () => ({
        data: null,
        error: new Error("Query failed"),
        configured: true,
      }),
    });

    expect(result.data).toEqual({ id: "assignment-1", title: "Cached" });
    expect(result.error).toBeNull();
    expect(result.offline).toBe(true);
  });

  it("preserves a thrown online error when no snapshot is available", async () => {
    const queryError = new Error("Request rejected");
    const result = await fetchWithOfflineFallback({
      userId: "student-1",
      store: "assignments",
      id: "assignment-1",
      fetcher: async () => {
        throw queryError;
      },
    });

    expect(result.error).toBe(queryError);
    expect(result.offline).toBe(false);
  });
});
