/** Real Chromium IndexedDB, isolated from app auth/DB; no API or IDB mocks. */
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import ts from "typescript";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const source = await readFile(new URL("../src/lib/offline/read-snapshots.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const output = process.env.INSTANT_OVERVIEW_TEST_OUTPUT || "artifacts/read-snapshots-browser";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const context = await browser.newContext();
try {
  await context.route("https://snapshot-test.invalid/**", (route) => route.fulfill({
    contentType: route.request().url().endsWith("module.js") ? "text/javascript" : "text/html",
    body: route.request().url().endsWith("module.js") ? javascript : "<!doctype html><title>Isolated IndexedDB test</title>",
  }));
  const page = await context.newPage();
  await page.goto("https://snapshot-test.invalid/");
  const results = await page.evaluate(async () => {
    const m = await import("/module.js");
    const results = [];
    const check = (condition, message) => { if (!condition) throw new Error(message); results.push(message); };
    const record = (scope, resource, requestedAt = Date.now()) => ({ key: m.snapshotKey(scope, resource, "day-filter"), scope, params: "day-filter", schema: 1, version: '"v1"', syncedAt: Date.now(), requestedAt, data: { text: resource } });
    const a = record("user-org-A", "overview");
    await m.saveReadSnapshot(a);
    check((await m.loadReadSnapshot(a.key, a.scope, a.params)).data.text === "overview", "IndexedDB persists and restores a scoped read copy");
    check(await m.loadReadSnapshot(a.key, "other-user", a.params) === null, "wrong identity is never returned");
    check(await m.loadReadSnapshot(a.key, a.scope, "other-filter") === null, "wrong date/filter is never returned");
    const newer = { ...a, requestedAt: a.requestedAt + 2000, data: { text: "newer" } };
    await m.saveReadSnapshot(newer); await m.saveReadSnapshot({ ...a, data: { text: "older" } });
    check((await m.loadReadSnapshot(a.key, a.scope, a.params)).data.text === "newer", "an older tab/request cannot overwrite a newer persisted snapshot");
    const expired = { ...record("expired", "overview"), syncedAt: Date.now() - m.SNAPSHOT_TTL - 1000 };
    await m.saveReadSnapshot(expired);
    check(await m.loadReadSnapshot(expired.key, expired.scope, expired.params) === null, "expired copies are not hydrated");
    for (let i = 0; i < 30; i += 1) await m.saveReadSnapshot(record("bounded", `section-${i}`));
    const records = async () => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open("shanyraq-read-snapshots", 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const items = await new Promise((resolve, reject) => { const request = db.transaction("snapshots").objectStore("snapshots").getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      db.close(); return items;
    };
    check((await records()).length <= m.MAX_SNAPSHOTS, "the read cache stays within its record count limit");
    await m.clearReadSnapshots();
    for (let i = 0; i < 20; i += 1) await m.saveReadSnapshot({ ...record("bytes", `large-${i}`), data: { text: "x".repeat(250 * 1024) } });
    const bytes = (await records()).reduce((sum, item) => sum + new TextEncoder().encode(JSON.stringify(item)).byteLength, 0);
    check(bytes <= 4 * 1024 * 1024, "aggregate read storage stays within 4 MiB");
    await m.clearReadSnapshots();
    const keep = record("keep", "overview"); const remove = record("remove", "overview");
    await m.saveReadSnapshot(keep); await m.saveReadSnapshot(remove);
    localStorage.setItem("test-unsent-outbox", "do not remove");
    await m.clearReadSnapshots("remove");
    check(await m.loadReadSnapshot(remove.key, remove.scope, remove.params) === null && (await m.loadReadSnapshot(keep.key, keep.scope, keep.params)) !== null, "scope clearing leaves other identities untouched");
    check(localStorage.getItem("test-unsent-outbox") === "do not remove", "read cache clearing does not erase an outbox/draft store");
    await m.clearReadSnapshots();
    check((await records()).length === 0, "logout-style clearing removes all read snapshots");
    return results;
  });
  assert.ok(results.length >= 10);
  await writeFile(`${output}/results.json`, JSON.stringify({ passed: true, realIndexedDB: true, mockedApp: true, physicalDevices: false, results }, null, 2));
  console.log(results.join("\n"));
} finally {
  await context.close(); await browser.close();
}
