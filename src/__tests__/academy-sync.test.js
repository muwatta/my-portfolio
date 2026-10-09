import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/offlineStore", () => ({
  OFFLINE_STORES: { syncQueue: "syncQueue" },
  getOfflineRecords: vi.fn(),
  putOfflineRecord: vi.fn(),
}));

const { getOfflineRecords, putOfflineRecord } = await import("../lib/offlineStore");
const { getPendingAcademyOperations, syncAcademyOperations, subscribeToAcademySync } =
  await import("../lib/academySync");

describe("offline operation synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("replays older queued operations before newer ones", async () => {
    getOfflineRecords.mockResolvedValue([
      {
        data: {
          operationId: "later",
          type: "assignment_submission",
          status: "pending",
          createdAt: "2026-10-09T10:02:00.000Z",
        },
      },
      {
        data: {
          operationId: "earlier",
          type: "assignment_submission",
          status: "pending",
          createdAt: "2026-10-09T10:01:00.000Z",
        },
      },
    ]);

    const operations = await getPendingAcademyOperations("student-1");

    expect(operations.map((operation) => operation.operationId)).toEqual([
      "earlier",
      "later",
    ]);
  });

  it("reports permanently failed work instead of a successful sync", async () => {
    let queue = [
      {
        data: {
          operationId: "operation-1",
          type: "assignment_submission",
          status: "pending",
          attempts: 4,
          createdAt: "2026-10-09T10:01:00.000Z",
        },
      },
    ];
    getOfflineRecords.mockImplementation(async () => queue);
    putOfflineRecord.mockImplementation(async (_store, _userId, _id, data) => {
      queue = [{ data }];
    });
    const states = [];
    const unsubscribe = subscribeToAcademySync((state) => states.push(state));

    await syncAcademyOperations("student-1", {
      assignment_submission: async () => {
        throw new Error("Assignment is locked.");
      },
    });
    unsubscribe();

    expect(states.at(-1)).toMatchObject({
      status: "failed",
      pending: 0,
      failed: 1,
    });
  });

  it("does not replay a later C++ week while an earlier submission is retrying", async () => {
    const first = {
      operationId: "week-1",
      type: "assignment_submission",
      status: "pending",
      attempts: 0,
      createdAt: "2026-10-09T10:01:00.000Z",
    };
    const second = {
      ...first,
      operationId: "week-2",
      createdAt: "2026-10-09T10:02:00.000Z",
    };
    let queue = [{ data: first }, { data: second }];
    getOfflineRecords.mockImplementation(async () => queue);
    putOfflineRecord.mockImplementation(async (_store, _userId, id, data) => {
      queue = queue.map((record) =>
        record.data.operationId === id ? { data } : record,
      );
    });
    const submitWeek2 = vi.fn();

    await syncAcademyOperations("student-1", {
      assignment_submission: async (_payload, operation) => {
        if (operation.operationId === "week-1") {
          throw new Error("Temporary network failure.");
        }
        submitWeek2();
      },
    });

    expect(submitWeek2).not.toHaveBeenCalled();
    expect(queue[1].data.status).toBe("pending");
  });
});
