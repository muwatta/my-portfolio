import {
  OFFLINE_STORES,
  getOfflineRecords,
  putOfflineRecord,
} from "./offlineStore";

const listeners = new Set();
let syncPromise = null;
let started = false;

const emit = (state) => listeners.forEach((listener) => listener(state));
const online = () => typeof navigator === "undefined" || navigator.onLine;
const createOperationId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `academy-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
    createdAt: operation.createdAt || new Date().toISOString(),
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
    );
}

export async function syncAcademyOperations(userId, handlers = {}) {
  if (!userId || !online() || syncPromise) return syncPromise;
  syncPromise = (async () => {
    const operations = await getPendingAcademyOperations(userId);
    if (!operations.length) {
      emit({ online: true, status: "synced", pending: 0 });
      return;
    }
    emit({ online: true, status: "syncing", pending: operations.length });
    for (const operation of operations) {
      const handler = handlers[operation.type];
      if (!handler) {
        await putOfflineRecord(OFFLINE_STORES.syncQueue, userId, operation.operationId, {
          ...operation,
          status: "failed",
          permanent: true,
          lastError: "No sync handler is available for this operation.",
        });
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
      }
    }
    emit({ online: true, status: "synced", pending: 0 });
  })().finally(() => {
    syncPromise = null;
  });
  return syncPromise;
}
