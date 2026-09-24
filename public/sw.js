const CACHE_PREFIX = "muwatta-academy";
const CACHE_VERSION = "v4";
const APP_SHELL_CACHE = `${CACHE_PREFIX}-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `${CACHE_PREFIX}-assets-${CACHE_VERSION}`;
const CONTENT_CACHE = `${CACHE_PREFIX}-content-${CACHE_VERSION}`;

const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/academy",
  "/manifest.json",
  "/offline.html",
  "/images/academy-icon.svg",
  "/images/academy-icon-192.png",
  "/images/academy-icon-512.png",
];

const isSameOrigin = (url) => url.origin === self.location.origin;
const isCacheableAsset = (request, url) =>
  request.destination === "style" ||
  request.destination === "script" ||
  request.destination === "font" ||
  request.destination === "image" ||
  /\.(?:js|css|woff2?|png|jpe?g|gif|svg|webp|ico)$/i.test(url.pathname);

const putInCache = async (cacheName, request, response, allowOpaque = false) => {
  if (
    !response ||
    (response.status !== 200 && response.type !== "opaque") ||
    (!allowOpaque && response.type === "opaque")
  ) {
    return;
  }
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
};

const networkFirst = async (request, cacheName) => {
  try {
    const response = await fetch(request);
    await putInCache(cacheName, request, response);
    return response;
  } catch {
    return (
      (await caches.match(request)) ||
      (await caches.match("/index.html")) ||
      (await caches.match("/")) ||
      (await caches.match("/offline.html"))
    );
  }
};

const cacheFirst = async (request, cacheName, allowOpaque = false) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  await putInCache(cacheName, request, response, allowOpaque);
  return response;
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              name.startsWith(CACHE_PREFIX) &&
              ![APP_SHELL_CACHE, ASSET_CACHE, CONTENT_CACHE].includes(name),
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (
    !isSameOrigin(url) &&
    !(url.hostname === "cdn.jsdelivr.net" && url.pathname.includes("/pyodide/v0.27.2/"))
  ) {
    return;
  }

  if (!isSameOrigin(url)) {
    event.respondWith(
      cacheFirst(request, CONTENT_CACHE, true).catch(
        () => new Response("Python runtime is not available offline yet.", { status: 503 }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request, APP_SHELL_CACHE).catch(
        () => caches.match("/offline.html"),
      ),
    );
    return;
  }

  if (isCacheableAsset(request, url)) {
    event.respondWith(
      cacheFirst(request, ASSET_CACHE).catch(async () => {
        if (request.destination === "image") {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" rx="32" fill="#0f172a"/><text x="50%" y="54%" text-anchor="middle" font-family="sans-serif" font-size="42" fill="#67e8f9">M</text></svg>',
            { headers: { "Content-Type": "image/svg+xml" } },
          );
        }
        return new Response("Offline asset unavailable.", { status: 503 });
      }),
    );
    return;
  }

  if (url.pathname.startsWith("/course_material_assets/")) {
    event.respondWith(networkFirst(request, CONTENT_CACHE));
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag !== "academy-sync") return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) =>
      clients.forEach((client) => client.postMessage({ type: "ACADEMY_SYNC_REQUESTED" })),
    ),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX))
            .map((name) => caches.delete(name)),
        ),
      ),
    );
  }
});
