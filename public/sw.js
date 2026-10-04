/* Shanyraq Mobile service worker: offline app shell, saved workspace pages and push notifications. */
const STATIC_CACHE = "shanyraq-static-v2";
const PAGES_CACHE = "shanyraq-pages-v1";
const KNOWN_CACHES = [STATIC_CACHE, PAGES_CACHE];
const PRECACHE_URLS = ["/manifest.webmanifest", "/icons/shanyraq-192.png", "/icons/shanyraq-512.png"];
const STATIC_LIMIT = 400;

const STATIC_REF = /\/_next\/static\/[^"'\\\s)<>]+/g;

// Saves the scripts and styles a page needs, so it can hydrate without a network.
async function cacheAssetsFrom(html) {
  const statics = await caches.open(STATIC_CACHE);
  for (const asset of new Set(html.match(STATIC_REF) || [])) {
    if (await statics.match(asset)) continue;
    try {
      const response = await fetch(asset);
      if (response.ok) await statics.put(asset, response);
    } catch {
      return;
    }
  }
}

async function precache() {
  const cache = await caches.open(STATIC_CACHE);
  await cache.addAll(PRECACHE_URLS);
  const offline = await fetch("/offline");
  if (!offline.ok) return;
  await cache.put("/offline", offline.clone());
  await cacheAssetsFrom(await offline.text());
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("shanyraq-") && !KNOWN_CACHES.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/brand/") || url.pathname === "/manifest.webmanifest";
}

function isWorkspacePage(url) {
  return url.pathname === "/dashboard" || url.pathname.startsWith("/dashboard/");
}

// Only a real authenticated workspace page may be stored — never a redirect to /login or an error page.
function isCacheablePage(response) {
  if (!response || response.status !== 200 || response.type !== "basic" || response.redirected) return false;
  return isWorkspacePage(new URL(response.url)) && (response.headers.get("content-type") || "").includes("text/html");
}

function pageKey(url) {
  return new URL(url.pathname + url.search, self.location.origin).toString();
}

async function trimStaticCache() {
  const cache = await caches.open(STATIC_CACHE);
  // Oldest build chunks go first; the offline page and icons are kept.
  const keys = (await cache.keys()).filter((request) => new URL(request.url).pathname.startsWith("/_next/static/"));
  const excess = keys.length - STATIC_LIMIT;
  for (let index = 0; index < excess; index += 1) await cache.delete(keys[index]);
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreVary: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

async function handleNavigation(request, url) {
  try {
    const response = await fetch(request);
    if (isCacheablePage(response)) {
      const cache = await caches.open(PAGES_CACHE);
      await cache.put(pageKey(url), response.clone());
    } else if (response.redirected && new URL(response.url).pathname === "/login") {
      // The session ended: drop every saved page of the previous session.
      await caches.delete(PAGES_CACHE);
    }
    return response;
  } catch {
    const cache = await caches.open(PAGES_CACHE);
    const cached = (await cache.match(pageKey(url), { ignoreVary: true })) || (await cache.match(pageKey(url), { ignoreSearch: true, ignoreVary: true }));
    if (cached) return cached;
    return (await caches.match("/offline", { ignoreVary: true })) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // RSC requests stay on the network: when they fail, Next.js falls back to a full
  // navigation, which is answered from the saved pages.
  if (request.mode === "navigate" && isWorkspacePage(url)) {
    event.respondWith(handleNavigation(request, url));
  }
});

async function warmPages(urls) {
  const pages = await caches.open(PAGES_CACHE);
  let html = "";
  for (const href of urls) {
    const url = new URL(href, self.location.origin);
    if (url.origin !== self.location.origin || !isWorkspacePage(url)) continue;
    try {
      const response = await fetch(url.toString(), { credentials: "same-origin", headers: { accept: "text/html" } });
      if (!isCacheablePage(response)) continue;
      html += await response.clone().text();
      await pages.put(pageKey(url), response);
    } catch {
      return;
    }
  }
  await cacheAssetsFrom(html);
  await trimStaticCache();
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "warm" && Array.isArray(data.urls)) {
    event.waitUntil(warmPages(data.urls.slice(0, 20)));
  } else if (data.type === "clear-pages") {
    event.waitUntil(caches.delete(PAGES_CACHE));
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(self.registration.showNotification(payload.title || "Shanyraq", {
    body: payload.body || "Новое уведомление",
    icon: "/icons/shanyraq-192.png",
    badge: "/icons/shanyraq-192.png",
    tag: payload.id || "shanyraq-notification",
    data: { href: payload.href || "/dashboard" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.href || "/dashboard", self.location.origin);
  const href = target.origin === self.location.origin ? `${target.pathname}${target.search}${target.hash}` : "/dashboard";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      return existing.navigate(href).then(() => existing.focus());
    }
    return self.clients.openWindow(href);
  }));
});
