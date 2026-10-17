/** Additive upgrade + disabled-schema gates on a fresh, loopback-only DB. */
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  cp,
  writeFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { catalogView } from "../src/lib/guest-stay/catalog";
import { stayWorkspace } from "../src/lib/guest-stay/service";
import type { CurrentMembership } from "../src/lib/tenant";
async function main() {
  const source = process.env.DATABASE_URL;
  if (!source || process.env.RUN_GUEST_STAY_DB_TESTS !== "1")
    throw new Error("Explicit disposable DB opt-in required");
  const u = new URL(source);
  if (
    !["127.0.0.1", "localhost"].includes(u.hostname) ||
    !u.pathname.includes("fixture")
  )
    throw new Error("Loopback fixture required");
  const name = `stay_upgrade_fixture_${randomBytes(6).toString("hex")}`;
  const target = new URL(source);
  target.pathname = `/${name}`;
  const admin = new PrismaClient({ log: [] });
  const root = await mkdtemp(join(tmpdir(), "stay-upgrade-"));
  const schemaDir = join(root, "prisma");
  await mkdir(join(schemaDir, "migrations"), { recursive: true });
  function run(args: string[], env: Partial<NodeJS.ProcessEnv> = {}) {
    return spawnSync(process.execPath, args, {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: target.toString(), ...env },
    });
  }
  try {
    await admin.$executeRawUnsafe(
      `CREATE DATABASE "${name}" ENCODING 'UTF8' TEMPLATE template0`,
    );
    const sourceSchema = await readFile("prisma/schema.prisma", "utf8");
    const baseline = sourceSchema
      .slice(0, sourceSchema.indexOf("// Opt-in publication"))
      .split("\n")
      .filter(
        (l) =>
          !/^\s*(catalogListings|catalogListing|guestStays|guestStay|guestStayPolicies|guestStayPolicy)\s/.test(
            l,
          ),
      )
      .join("\n");
    await writeFile(join(schemaDir, "schema.prisma"), baseline);
    for (const entry of await readdir("prisma/migrations"))
      if (!entry.startsWith("20261018"))
        await cp(
          join("prisma/migrations", entry),
          join(schemaDir, "migrations", entry),
          { recursive: true },
        );
    const migrated = run([
      "node_modules/prisma/build/index.js",
      "migrate",
      "deploy",
      "--schema",
      join(schemaDir, "schema.prisma"),
    ]);
    assert.equal(migrated.status, 0, "baseline clean migrations must pass");
    console.log("PASS: all baseline migrations on clean UTF8 PostgreSQL");
    const db = new PrismaClient({
      datasources: { db: { url: target.toString() } },
      log: [],
    });
    try {
      const org = await db.organization.create({
        data: { name: "Legacy fixture preserved" },
      });
      const hotel = await db.hotel.create({
        data: { orgId: org.id, slug: name, name: "Legacy hotel" },
      });
      const property = await db.rentalProperty.create({
        data: {
          organizationId: org.id,
          hotelId: hotel.id,
          internalName: "Legacy apartment",
          publicName: "Legacy apartment",
          inventoryMode: "SINGLE_UNIT",
        },
      });
      const type = await db.roomType.create({
        data: {
          hotelId: hotel.id,
          rentalPropertyId: property.id,
          name: "Legacy",
          capacity: 2,
          basePrice: 10000,
        },
      });
      const room = await db.room.create({
        data: {
          hotelId: hotel.id,
          rentalPropertyId: property.id,
          roomTypeId: type.id,
          number: "legacy",
        },
      });
      const guest = await db.guest.create({
        data: { hotelId: hotel.id, fullName: "Legacy guest" },
      });
      const r = await db.reservation.create({
        data: {
          hotelId: hotel.id,
          rentalPropertyId: property.id,
          roomTypeId: type.id,
          roomId: room.id,
          guestId: guest.id,
          sourceChannel: "direct",
          checkIn: new Date("2026-12-01Z"),
          checkOut: new Date("2026-12-03Z"),
          totalAmount: 20000,
        },
      });
      process.env.GUEST_STAY_ENABLED = "false";
      process.env.PUBLIC_CATALOG_ENABLED = "false";
      await assert.rejects(catalogView(db, name), /пока не включена/);
      await assert.rejects(
        stayWorkspace(db, {} as CurrentMembership),
        /пока не включена/,
      );
      assert.equal(await db.reservation.count(), 1);
      console.log(
        "PASS: feature-off services and legacy booking work without new tables",
      );
      const off = run(["scripts/check-communications-schema.mjs"], {
        VERCEL_ENV: "preview",
        GUEST_STAY_ENABLED: "false",
        PUBLIC_CATALOG_ENABLED: "false",
        GUEST_DOCUMENT_BUNDLES_ENABLED: "false",
      });
      assert.equal(off.status, 0);
      console.log(
        "PASS: read-only deployment gate accepts baseline when flags off",
      );
      const on = run(["scripts/check-communications-schema.mjs"], {
        VERCEL_ENV: "preview",
        GUEST_STAY_ENABLED: "true",
        PUBLIC_CATALOG_ENABLED: "true",
      });
      assert.notEqual(on.status, 0);
      console.log("PASS: enabled deployment gate rejects missing stay tables");
      const upgrade = run([
        "node_modules/prisma/build/index.js",
        "migrate",
        "deploy",
      ]);
      assert.equal(upgrade.status, 0, "additive upgrade must pass");
      const preserved = await db.reservation.findUniqueOrThrow({
        where: { id: r.id },
        include: { guest: true },
      });
      assert.equal(preserved.guest.fullName, "Legacy guest");
      assert.equal(preserved.totalAmount.toString(), "20000");
      assert.equal(await db.catalogListing.count(), 0);
      assert.equal(await db.guestStay.count(), 0);
      console.log(
        "PASS: additive upgrade preserves legacy reservation/guest and publishes nothing automatically",
      );
      const gate = run(["scripts/check-communications-schema.mjs"], {
        VERCEL_ENV: "preview",
        GUEST_STAY_ENABLED: "true",
        PUBLIC_CATALOG_ENABLED: "true",
      });
      assert.equal(gate.status, 0);
      console.log(
        "PASS: enabled read-only deployment gate accepts migrated schema",
      );
    } finally {
      await db.$disconnect();
    }
  } finally {
    await admin.$executeRawUnsafe(
      `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`,
    );
    await admin.$disconnect();
    await rm(root, { recursive: true, force: true });
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.name : "MigrationTestError");
  process.exitCode = 1;
});
