import { execFileSync } from "node:child_process";
import { assertDisposableDatabase } from "../src/lib/security/database-safety";

assertDisposableDatabase();
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
execFileSync(npx, ["prisma", "db", "push", "--force-reset"], { stdio: "inherit", env: process.env });
execFileSync(npx, ["tsx", "prisma/seed-demo.ts"], { stdio: "inherit", env: process.env });
