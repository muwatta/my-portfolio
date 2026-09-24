const DB_NAME = "muwatta-academy-offline";
const DB_VERSION = 1;
export const OFFLINE_CONTENT_CACHE = "muwatta-academy-content-v4";
export const OFFLINE_MATERIAL_CACHE = "muwatta-academy-materials-v1";

export const OFFLINE_STORES = {
  courses: "courses",
  lessons: "lessons",
  exercises: "exercises",
  assignments: "assignments",
  materials: "materials",
  progress: "progress",
  drafts: "drafts",
  attempts: "attempts",
  notifications: "notifications",
  leaderboard: "leaderboard",
  syncQueue: "syncQueue",
  metadata: "metadata",
  profile: "profile",
};

const recordKey = (userId, id) => `${userId}:${id}`;

const requestResult = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (transaction) =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

const openDatabase = () =>
  new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      Object.values(OFFLINE_STORES).forEach((storeName) => {
        if (database.objectStoreNames.contains(storeName)) return;
        const store = database.createObjectStore(storeName, { keyPath: "key" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export async function putOfflineRecord(storeName, userId, id, data) {
  if (!userId) throw new Error("An authenticated student is required.");
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put({
    key: recordKey(userId, id),
    id,
    userId,
    data,
    updatedAt: new Date().toISOString(),
  });
  await transactionDone(transaction);
  database.close();
  return data;
}

export async function getOfflineRecord(storeName, userId, id) {
  if (!userId) return null;
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const record = await requestResult(
    transaction.objectStore(storeName).get(recordKey(userId, id)),
  );
  await transactionDone(transaction);
  database.close();
  return record?.data ?? null;
}

export async function getOfflineRecords(storeName, userId) {
  if (!userId) return [];
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const index = transaction.objectStore(storeName).index("userId");
  const records = await requestResult(index.getAll(userId));
  await transactionDone(transaction);
  database.close();
  return records.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

export async function deleteOfflineRecord(storeName, userId, id) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).delete(recordKey(userId, id));
  await transactionDone(transaction);
  database.close();
}

export async function clearOfflineUser(userId, { preserveQueue = false } = {}) {
  if (!userId) return;
  const database = await openDatabase();
  const stores = Object.values(OFFLINE_STORES).filter(
    (storeName) => !preserveQueue || storeName !== OFFLINE_STORES.syncQueue,
  );
  const transaction = database.transaction(stores, "readwrite");
  stores.forEach((storeName) => {
    transaction.objectStore(storeName).index("userId").delete(userId);
  });
  await transactionDone(transaction);
  database.close();
}

export async function clearOfflineDownloads(userId) {
  const stores = [
    OFFLINE_STORES.courses,
    OFFLINE_STORES.lessons,
    OFFLINE_STORES.exercises,
    OFFLINE_STORES.assignments,
    OFFLINE_STORES.materials,
    OFFLINE_STORES.metadata,
  ];
  for (const storeName of stores) {
    const records = await getOfflineRecords(storeName, userId);
    for (const record of records) {
      await deleteOfflineRecord(storeName, userId, record.id);
    }
  }
  if ("caches" in window) {
    const cache = await caches.open(OFFLINE_MATERIAL_CACHE);
    const requests = await cache.keys();
    await Promise.all(requests.map((request) => cache.delete(request)));
  }
}

export async function cacheOfflineAsset(url) {
  if (!("caches" in window)) throw new Error("Offline file storage is unavailable.");
  const response = await fetch(url);
  if (!response.ok) throw new Error("The material could not be downloaded.");
  const cache = await caches.open(OFFLINE_MATERIAL_CACHE);
  await cache.put(url, response.clone());
  return response;
}

export async function removeOfflineAsset(url) {
  if (!("caches" in window)) return;
  const cache = await caches.open(OFFLINE_MATERIAL_CACHE);
  await cache.delete(url);
}

export async function estimateOfflineStorage() {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
