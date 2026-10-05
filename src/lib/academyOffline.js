import {
  OFFLINE_STORES,
  getOfflineRecord,
  putOfflineRecord,
} from "./offlineStore";

const listId = (name) => `list:${name}`;

async function getOfflineResult(userId, store, id, allowEmpty, fetchError = null) {
  const cached = await getOfflineRecord(store, userId, id ?? listId(store));
  if (cached !== null && (allowEmpty || cached.length)) {
    return {
      data: cached,
      error: null,
      configured: true,
      offline: true,
    };
  }
  return {
    data: null,
    error:
      fetchError ??
      new Error("This content has not been downloaded for offline use."),
    configured: true,
    offline: !fetchError,
  };
}

export async function fetchWithOfflineFallback({
  userId,
  store,
  id,
  fetcher,
  allowEmpty = true,
}) {
  const online = typeof navigator === "undefined" || navigator.onLine;
  if (online) {
    try {
      const result = await fetcher();
      if (!result?.error && result?.data !== undefined) {
        try {
          await putOfflineRecord(store, userId, id ?? listId(store), result.data);
        } catch {
          return { ...result, offline: false };
        }
        return { ...result, offline: false };
      }
      if (!result?.error) return { ...result, offline: false };
      return getOfflineResult(userId, store, id, allowEmpty, result.error);
    } catch (error) {
      return getOfflineResult(userId, store, id, allowEmpty, error);
    }
  }

  return getOfflineResult(userId, store, id, allowEmpty);
}

export async function cacheAcademySnapshot(userId, store, id, data) {
  return putOfflineRecord(store, userId, id ?? listId(store), data);
}

export function getOfflineCourseSnapshotId(courseId) {
  return `course:${courseId}`;
}

export function getOfflineWeekSnapshotId(courseId, weekId) {
  return `week:${courseId}:${weekId}`;
}

export const academyOfflineStores = OFFLINE_STORES;
