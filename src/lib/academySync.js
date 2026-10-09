import {
  OFFLINE_STORES,
  getOfflineRecords,
  putOfflineRecord,
} from "./offlineStore";

const listeners = new Set();
let syncPromise = null;
let started = false;
let lastQueuedAt = 0;

const emit = (state) => listeners.forEach((listener) => listener(state));
const online = () => typeof navigator === "undefined" || navigator.onLine;
const createOperationId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `academy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const nextQueuedAt = () => {
  lastQueuedAt = Math.max(Date.now(), lastQueuedAt + 1);
  return new Date(lastQueuedAt).toISOString();
};

export function subscribeToAcademySync(listener) {
  listeners.add(listener);
  listener({ online: online(), status: "idle", pending: 0 });
  return () => listeners.delete(listener);
}

export function startAcademySync() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => emit({ online: true, status: "reconnected" }));
  window.addEventListener("offline", () => emit({ online: false, status: "offline" }));
}

export async function enqueueAcademyOperation(userId, operation) {
  const operationId = operation.operationId || createOperationId();
  const record = {
    operationId,
    userId,
    type: operation.type,
    payload: operation.payload,
    createdAt: operation.createdAt || nextQueuedAt(),
    status: "pending",
    attempts: 0,
    lastError: null,
  };
  await putOfflineRecord(OFFLINE_STORES.syncQueue, userId, operationId, record);
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.ready
      .then((registration) => registration.sync?.register("academy-sync"))
      .catch(() => undefined);
  }
  emit({ online: online(), status: "pending", pending: 1 });
  return operationId;
}

export async function getPendingAcademyOperations(userId) {
  const records = await getOfflineRecords(OFFLINE_STORES.syncQueue, userId);
  return records
    .map((record) => record.data)
    .filter(
      (operation) =>
        (operation.status === "pending" ||
          (operation.status === "failed" &&
            !operation.permanent &&
            (operation.attempts || 0) < 5)) &&
        (!operation.nextRetryAt ||
          Date.parse(operation.nextRetryAt) <= Date.now()),
    )
    .sort(
      (left, right) =>
        Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
        String(left.operationId).localeCompare(String(right.operationId)),
    );
}

export async function syncAcademyOperations(userId, handlers = {}) {
  if (!userId || !online() || syncPromise) return syncPromise;
  syncPromise = (async () => {
    const operations = await getPendingAcademyOperations(userId);
    const reportQueueState = async () => {
      const records = await getOfflineRecords(OFFLINE_STORES.syncQueue, userId);
      const remaining = records.map((record) => record.data);
      const failed = remaining.filter(
        (operation) =>
          operation.status === "failed" &&
          (operation.permanent || (operation.attempts || 0) >= 5),
      );
      const lastError = failed
        .map((operation) => operation.lastError)
        .filter(Boolean)
        .pop();
      const pending = remaining.filter(
        (operation) =>
          operation.status === "pending" ||
          (operation.status === "failed" &&
            !operation.permanent &&
            (operation.attempts || 0) < 5),
      );
      emit({
        online: true,
        status: failed.length ? "failed" : pending.length ? "pending" : "synced",
        pending: pending.length,
        failed: failed.length,
        lastError,
      });
    };
    if (!operations.length) {
      await reportQueueState();
      return;
    }
    emit({ online: true, status: "syncing", pending: operations.length });
    let assignmentSequenceBlocked = false;
    for (const operation of operations) {
      if (
        operation.type === "assignment_submission" &&
        assignmentSequenceBlocked
      ) {
        continue;
      }
      const handler = handlers[operation.type];
      if (!handler) {
        await putOfflineRecord(OFFLINE_STORES.syncQueue, userId, operation.operationId, {
          ...operation,
          status: "failed",
          permanent: true,
          lastError: "No sync handler is available for this operation.",
        });
        if (operation.type === "assignment_submission") {
          assignmentSequenceBlocked = true;
        }
        continue;
      }
      try {
        await handler(operation.payload, operation);
        await putOfflineRecord(OFFLINE_STORES.syncQueue, userId, operation.operationId, {
          ...operation,
          status: "synced",
          syncedAt: new Date().toISOString(),
          payload: operation.payload?.file
            ? { ...operation.payload, file: null }
            : operation.payload,
        });
      } catch (error) {
        const attempts = (operation.attempts || 0) + 1;
        const permanent = attempts >= 5 || error?.permanent === true;
        await putOfflineRecord(OFFLINE_STORES.syncQueue, userId, operation.operationId, {
          ...operation,
          attempts,
          status: permanent ? "failed" : "pending",
          permanent,
          lastError: error?.message || "Sync failed.",
          nextRetryAt: permanent
            ? null
            : new Date(Date.now() + Math.min(300000, 1000 * 2 ** attempts)).toISOString(),
        });
        if (operation.type === "assignment_submission") {
          assignmentSequenceBlocked = true;
        }
      }
    }
    await reportQueueState();
  })().finally(() => {
    syncPromise = null;
  });
  return syncPromise;
}
