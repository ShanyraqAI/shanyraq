import { spawnSync } from "node:child_process";
import path from "node:path";

const source = process.env.DATABASE_URL;
const databaseName = process.env.E2E_DATABASE_NAME ?? "shanyraq_e2e_test";
if (!source) throw new Error("DATABASE_URL is required");
if (!/(?:^|[_-])(test|dev|demo)$/i.test(databaseName)) {
  throw new Error("Refusing migration: E2E_DATABASE_NAME must identify a test/dev database");
}

const url = new URL(source);
const sourceName = decodeURIComponent(url.pathname.replace(/^\//, ""));
if (sourceName === databaseName) throw new Error("Source and E2E database names must differ");
url.pathname = `/${databaseName}`;

const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url.toString() },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
