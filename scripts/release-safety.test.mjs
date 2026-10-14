import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
test("ordinary build has no migration command", () => {
  const { scripts } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url)),
  );
  assert.equal(scripts.build, "prisma generate && node scripts/check-communications-schema.mjs && next build");
  assert.match(scripts.build, /check-communications-schema/);
  assert.equal(/migrate|deploy/.test(scripts.build), false);
});
test("accidental migration invocation refuses without approval even with production env", () => {
  const result = spawnSync(process.execPath, ["scripts/vercel-migrate.mjs"], {
    env: {
      ...process.env,
      VERCEL_ENV: "production",
      RELEASE_MIGRATIONS_APPROVED: "",
      DATABASE_URL: "",
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing migrations/);
});

test("legacy deploy helper cannot migrate before a future Vercel build", () => {
  const script = readFileSync(
    new URL("./deploy-production.ps1", import.meta.url),
    "utf8",
  );
  assert.equal(
    /prisma migrate deploy|git push origin|git add -A|git commit -m/.test(
      script,
    ),
    false,
  );
  assert.match(script, /preflight only/i);
});

test("approved release refuses a non-production target instead of reporting a successful skip", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/vercel-migrate.mjs", "--apply-reviewed-release"],
    {
      env: {
        ...process.env,
        VERCEL_ENV: "preview",
        RELEASE_MIGRATIONS_APPROVED: "1",
        DATABASE_URL: "",
      },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires production target/);
});
test("approved production release refuses a missing database before running Prisma", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/vercel-migrate.mjs", "--apply-reviewed-release"],
    {
      env: {
        ...process.env,
        VERCEL_ENV: "production",
        RELEASE_MIGRATIONS_APPROVED: "1",
        DATABASE_URL: "",
      },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DATABASE_URL is not set/);
});

test("read-only release gate includes both merged feature schemas", () => {
  const gate = readFileSync(new URL("./check-communications-schema.mjs", import.meta.url), "utf8");
  for (const model of ["DocumentSigningRequest", "OperationReceipt", "ChannexBooking.lastProviderRevisionAt"]) assert.ok(gate.includes(model));
  assert.equal(/migrate deploy|ALTER TABLE|CREATE TABLE/.test(gate), false);
});
