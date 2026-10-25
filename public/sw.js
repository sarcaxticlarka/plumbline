/* Plumbline service worker — offline shell for the signed-in app.
 *  • /_next/static, fonts, icons: cache-first (immutable)
 *  • /app/* pages: network-first, falling back to the last copy seen (so the composer opens with no signal)
 *  • /api/*: never cached (authenticated, live data) — the app queues writes itself (IndexedDB outbox)
 */
const V = "plumbline-v1";
const STATIC = `${V}-static`;
const PAGES = `${V}-pages`;
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, "/icon.svg", "/manifest.webmanifest"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(V)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  // On sign-out the page asks us to forget any cached (authenticated) pages.
  if (e.data && e.data.type === "clear") e.waitUntil(caches.delete(PAGES));
});

const keyFor = (req) => new Request(new URL(req.url).pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || /\.(?:woff2?|svg|png|ico|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  const isPage = req.mode === "navigate" || req.headers.get("x-sw-cache") === "1";
  if (isPage && url.pathname.startsWith("/app")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const res = await fetch(req);
          // Only keep real pages (not redirects to /login, not errors).
          if (res.ok && !res.redirected) cache.put(keyFor(req), res.clone());
          return res;
        } catch {
          const hit = await cache.match(keyFor(req), { ignoreVary: true });
          if (hit) return hit;
          return (await caches.match(OFFLINE)) || Response.error();
        }
      })(),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(async () => (await caches.match(OFFLINE)) || Response.error()));
  }
});
