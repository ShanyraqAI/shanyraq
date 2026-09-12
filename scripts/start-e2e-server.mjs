import { spawn } from "node:child_process";
import path from "node:path";

const sourceUrl = process.env.DATABASE_URL;
const databaseName = process.env.E2E_DATABASE_NAME ?? "shanyraq_e2e_test";
const port = process.env.E2E_PORT ?? "3101";

if (!sourceUrl) throw new Error("DATABASE_URL is required");
if (!/(?:^|[_-])(test|dev|demo)$/i.test(databaseName)) {
  throw new Error("E2E_DATABASE_NAME must identify a disposable test/dev database");
}
if (!/^\d{2,5}$/.test(port)) throw new Error("E2E_PORT must be a valid port number");

const databaseUrl = new URL(sourceUrl);
const sourceDatabaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
if (sourceDatabaseName === databaseName) {
  throw new Error("DATABASE_URL must remain the source connection; the E2E database is derived separately");
}
databaseUrl.pathname = `/${databaseName}`;

const host = "127.0.0.1";
const next = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [next, "start", "--hostname", host, "--port", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl.toString(),
    APP_URL: `http://${host}:${port}`,
    E2E_DATABASE_NAME: databaseName,
  },
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
