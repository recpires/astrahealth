/*
 * ASTRA Health — offline service worker.
 *
 * Goal: the whole app keeps working with no network at all, including a full
 * page reload — the situation of a crew that loses its link and has no ground
 * server. Online behaviour is unchanged: pages and data always come from the
 * network first; the local copies are used only when the network fails.
 *
 *  - install:  pre-caches every route (HTML) and every static file those pages reference;
 *  - pages:    network first → local copy of that page → local copy of /future or /;
 *  - RSC data: network first → local copy → network error (Next.js then falls back to a page load);
 *  - /_next/static, /_next/image, icons, /brand: local copy first (file names change on every build),
 *    refreshed in the background.
 *
 * Bump SW_VERSION to force every client to re-install and re-cache.
 * Keep ROUTES in sync with src/app (checked by tests/future/offline.test.ts).
 */
const SW_VERSION = "astra-health-sw-v1";
const PAGES = `${SW_VERSION}-pages`;
const ASSETS = `${SW_VERSION}-assets`;
const DATA = `${SW_VERSION}-data`;

const ROUTES = [
  "/",
  "/analysis",
  "/response",
  "/comms",
  "/science",
  "/future",
  "/future/journal",
  "/future/assess",
  "/future/profile",
  "/future/eva",
  "/future/readiness",
];

const isAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/_next/image") ||
  url.pathname.startsWith("/brand/") ||
  /^\/(icon|apple-icon|opengraph-image)[^/]*$/.test(url.pathname);

const isRscRequest = (request, url) => request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");

/** Same-origin files referenced by a page (scripts, styles, images, icons). */
function referencedFiles(html) {
  const found = new Set();
  const decode = (s) => s.replace(/&amp;/g, "&");
  for (const m of html.matchAll(/(?:src|href)="(\/[^"]+)"/g)) found.add(decode(m[1]));
  for (const m of html.matchAll(/srcSet="([^"]+)"|srcset="([^"]+)"/gi)) {
    for (const part of decode(m[1] || m[2]).split(",")) {
      const u = part.trim().split(/\s+/)[0];
      if (u && u.startsWith("/")) found.add(u);
    }
  }
  return [...found].filter((p) => isAsset(new URL(p, self.location.origin)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGES);
      const assets = await caches.open(ASSETS);
      const files = new Set();
      for (const route of ROUTES) {
        try {
          const res = await fetch(route, { cache: "no-store" });
          if (!res.ok) continue;
          const html = await res.clone().text();
          await pages.put(route, res);
          referencedFiles(html).forEach((f) => files.add(f));
        } catch {
          /* a route that cannot be fetched now is cached on its first visit */
        }
      }
      await Promise.all(
        [...files].map(async (f) => {
          try {
            const res = await fetch(f);
            if (res.ok) await assets.put(f, res);
          } catch {
            /* ignore: cached on first use */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!key.startsWith(SW_VERSION)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function networkFirst(request, cacheName, fallbacks) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok && res.type === "basic") cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request, { ignoreVary: cacheName === PAGES });
    if (hit) return hit;
    for (const f of fallbacks) {
      const alt = await cache.match(f, { ignoreVary: true, ignoreSearch: true });
      if (alt) return alt;
    }
    return Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  // The image optimizer answers with "Vary: Accept"; the precached copy was fetched with another Accept header.
  const hit = await cache.match(request, { ignoreVary: true });
  const refresh = fetch(request)
    .then((res) => {
      if (res.ok && res.type === "basic") cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || (await refresh) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const own = url.pathname.replace(/\/$/, "") || "/";
    event.respondWith(networkFirst(request, PAGES, [own, url.pathname.startsWith("/future") ? "/future" : "/", "/"]));
    return;
  }
  if (isRscRequest(request, url)) {
    event.respondWith(networkFirst(request, DATA, []));
    return;
  }
  if (isAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});
