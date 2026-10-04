import { clearScopedOutbox } from "@/lib/offline/outbox";

export const PAGES_CACHE = "shanyraq-pages-v1";
export const SNAPSHOT_KEY = "shanyraq-offline-snapshot-at";
const WARM_KEY = "shanyraq-offline-warm-at";
const WARM_INTERVAL_MS = 10 * 60_000;

export async function clearSavedPages() {
  window.localStorage.removeItem(SNAPSHOT_KEY);
  window.localStorage.removeItem(WARM_KEY);
  if ("caches" in window) await window.caches.delete(PAGES_CACHE).catch(() => false);
}

/** Removes everything this account stored on the device: saved pages and unsent changes. */
export async function clearDeviceData() {
  clearScopedOutbox();
  await clearSavedPages();
}

/** Asks the service worker to save workspace pages for offline use, at most every 10 minutes. */
export async function warmOfflinePages(urls: string[]) {
  if (!("serviceWorker" in navigator) || navigator.onLine === false) return;
  const last = Number(window.localStorage.getItem(WARM_KEY) ?? 0);
  if (Date.now() - last < WARM_INTERVAL_MS) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const worker = registration?.active;
  if (!worker) return;
  window.localStorage.setItem(WARM_KEY, String(Date.now()));
  window.localStorage.setItem(SNAPSHOT_KEY, new Date().toISOString());
  worker.postMessage({ type: "warm", urls });
}
