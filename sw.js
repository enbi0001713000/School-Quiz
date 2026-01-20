/* sw.template.js
 * Actionsが c3d3aa3 を差し替えて sw.js を生成する。
 */
const CACHE_NAME = "school-quiz-c3d3aa3";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./bank.js",
  "./app.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // GET以外は触らない
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // 同一オリジンのみ
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return resp;
      });
    })
  );
});
