/** Read-only browser scenarios with mocked overview API. NOT a real-device benchmark. */
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const base = process.env.INSTANT_OVERVIEW_TEST_URL;
if (!base) throw new Error("Set INSTANT_OVERVIEW_TEST_URL to an isolated test/Preview deployment with the feature flag enabled.");
const fixture = process.argv.includes("--fixture");
const url = new URL(base);
if (!["localhost", "127.0.0.1"].includes(url.hostname) && process.env.ALLOW_PREVIEW_READ_TEST !== "true")
  throw new Error("Remote targets require ALLOW_PREVIEW_READ_TEST=true; never run against production.");
const core = JSON.parse(await readFile(new URL("./fixtures/instant-overview-core.json", import.meta.url), "utf8"));
const output = process.env.INSTANT_OVERVIEW_TEST_OUTPUT || "artifacts/instant-overview-browser";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  ...(process.env.INSTANT_OVERVIEW_STORAGE_STATE ? { storageState: process.env.INSTANT_OVERVIEW_STORAGE_STATE } : {}),
  recordVideo: { dir: output },
});
let failed = false;
const results = [];
try {
  if (fixture) await context.addInitScript(() => { if (localStorage.getItem("shanyraq-active-device-scope") === null) localStorage.setItem("shanyraq-active-device-scope", "u:h"); });
  let mode = "ok";
  await context.route("**/api/dashboard/overview?**", async (route) => {
    if (mode === "hold") return route.abort();
    if (mode === "denied") return route.fulfill({ status: 401, json: { error: "Session expired" } });
    if (mode === "error") return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    const request = route.request();
    const requestUrl = new URL(request.url());
    const block = requestUrl.searchParams.get("block");
    const scope = request.headers()["x-shanyraq-read-scope"];
    assert.ok(scope, "Every read must carry the server-verified workspace identity");
    return route.fulfill({ status: 200, json: {
      scope, params: JSON.stringify([requestUrl.searchParams.get("day"), process.env.INSTANT_OVERVIEW_TEST_LOCALE || "ru"]),
      version: '"browser-fixture-v1"', data: block === "core" ? core : [],
    } });
  });
  const page = await context.newPage();
  await page.goto(`${base}/dashboard/calendar`);
  // Useful data is prepared even though its outlet is currently hidden.
  await page.locator("[data-overview-content]").waitFor({ state: "attached" });
  const calendarInput = fixture ? page.getByLabel("calendar draft") : null;
  if (calendarInput) await calendarInput.fill("keep calendar state");
  let blockingRequests = 0;
  const requestListener = (request) => {
    if (request.isNavigationRequest() || new URL(request.url()).searchParams.has("_rsc")) blockingRequests += 1;
  };
  await context.setOffline(true);
  await page.waitForTimeout(100);
  page.on("request", requestListener);
  await page.locator('a[href="/dashboard"]:visible').first().click();
  await page.locator("[data-overview-content]").waitFor({ state: "visible" });
  assert.equal(new URL(page.url()).pathname, "/dashboard");
  assert.equal(blockingRequests, 0, "Prepared Overview must not start a document/RSC navigation");
  results.push("prepared Overview opens offline without document/RSC navigation");
  if (fixture) await page.getByLabel("overview draft").fill("unsaved overview input");
  await page.goBack();
  if (calendarInput) assert.equal(await calendarInput.inputValue(), "keep calendar state");
  await page.locator('a[href="/dashboard"]:visible').first().click();
  await page.locator("[data-overview-content]").waitFor({ state: "visible" });
  if (fixture) assert.equal(await page.getByLabel("overview draft").inputValue(), "unsaved overview input");
  results.push("browser Back and a repeated local transition preserve retained screen input (fixture-only input checks)");
  page.off("request", requestListener);
  mode = "error";
  await context.setOffline(false);
  await page.getByText(/Обновить часть данных не удалось/).waitFor();
  await page.locator("[data-overview-content]").waitFor({ state: "visible" });
  results.push("503 refresh retains the useful saved screen");
  mode = "ok";
  core.stats.revenueMonthToDate = 43000;
  await page.waitForTimeout(3000); // first bounded retry uses >= 2 s backoff
  if (fixture) {
    assert.equal(await page.getByTestId("revenue").textContent(), "43000");
    assert.equal(await page.getByLabel("overview draft").inputValue(), "unsaved overview input");
  }
  results.push("background recovery updates data without resetting local input (fixture)");
  await page.screenshot({ path: `${output}/prepared-overview.png` });
  // Let independent IndexedDB writes complete before testing persistence across reload.
  await page.waitForTimeout(150);
  mode = "hold";
  await page.goto(`${base}/dashboard/calendar`);
  await page.locator("[data-overview-content]").waitFor({ state: "attached" });
  await page.locator('a[href="/dashboard"]:visible').first().click();
  await page.locator("[data-overview-content]").waitFor({ state: "visible" });
  results.push("IndexedDB restores prepared data after a fresh online document bootstrap while API reads fail");
  const other = await context.newPage();
  await other.goto(`${base}/dashboard/calendar`);
  await other.evaluate(() => localStorage.setItem("shanyraq-active-device-scope", "another-user:another-hotel"));
  await page.locator('[role="alert"]:not(#__next-route-announcer__)').waitFor();
  assert.equal(await page.locator("[data-overview-content]:visible").count(), 0);
  results.push("cross-tab identity change removes the previous private screen");
  // Separate context for expiration, independent of cross-tab state.
  await other.close();
  await page.evaluate(() => localStorage.removeItem("shanyraq-active-device-scope"));
  mode = "denied";
  await page.goto(`${base}/dashboard`);
  await page.locator('[role="alert"]:not(#__next-route-announcer__)').waitFor();
  assert.equal(await page.locator("[data-overview-content]:visible").count(), 0);
  results.push("401 stops synchronization and removes cached content from the UI");
} catch (error) {
  failed = true;
  results.push(`FAILED: ${error.stack || error}`);
} finally {
  await context.close();
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify({ fixture, mockedAPI: true, physicalDevices: false, passed: !failed, results }, null, 2));
  console.log(results.join("\n"));
}
if (failed) process.exitCode = 1;
