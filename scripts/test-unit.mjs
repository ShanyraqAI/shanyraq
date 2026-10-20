// Discover every checked-in source unit test; individual files run in isolated Node test workers.
import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
// Enabling integration cases must never redirect the runner to a customer/production DB.
const dbFlags = ["BILLING_DB_TESTS", "RENTAL_PROPERTY_DB_TESTS", "RESERVATION_DB_TESTS", "RESERVATION_IMPORT_DB_TESTS"];
if (dbFlags.some((flag) => process.env[flag] === "true")) {
  const url = new URL(process.env.DATABASE_URL ?? "invalid:");
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !decodeURIComponent(url.pathname).endsWith("_test")) {
    throw new Error("Integration cases require a local disposable PostgreSQL database ending in _test");
  }
}
function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? collect(file) : file.endsWith(".test.ts") ? [file] : [];
  });
}
const files = [...collect("src"),
  "scripts/release-safety.test.mjs", "scripts/service-worker.test.mjs",
  "scripts/security-audit-regressions.test.cjs", "scripts/security-hardening.test.cjs",
].sort();
if (files.length < 4) throw new Error("No source test suite found");
const result = spawnSync(process.execPath, ["--require", "./scripts/test-server-preload.cjs", "--import", "tsx", "--test", ...files], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
