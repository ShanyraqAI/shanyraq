import { clearReadSnapshots } from "./read-snapshots";
import { clearComposerMemory } from "@/lib/communications/composer-memory";
import {
  ACTIVE_SCOPE_KEY,
  clearScopedOutbox,
  setOutboxScope,
} from "@/lib/offline/outbox";
export const PAGES_CACHE = "shanyraq-pages-disabled-v4";
export const SNAPSHOT_KEY = "shanyraq-offline-snapshot-at";
export async function clearSavedPages() {
  window.localStorage.removeItem(SNAPSHOT_KEY);
  window.localStorage.removeItem("shanyraq-offline-warm-at");
  if ("caches" in window) {
    const keys = await window.caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("shanyraq-pages-"))
        .map((key) => window.caches.delete(key)),
    );
  }
  navigator.serviceWorker?.controller?.postMessage({ type: "clear-pages" });
}
export async function clearDeviceData() {
  const clearReads = clearReadSnapshots().catch(() => undefined);
  clearComposerMemory();
  clearScopedOutbox();
  setOutboxScope("");
  window.localStorage.removeItem(ACTIVE_SCOPE_KEY);
  await clearSavedPages();
  await clearReads;
}
/** Private HTML is no longer saved; retain the caller contract while purging legacy snapshots. */
export async function warmOfflinePages(_urls: string[]) {
  void _urls;
  await clearSavedPages();
}
