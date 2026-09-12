/**
 * Demo seed — creates demo data for development/testing.
 * 
 * Usage: npx tsx prisma/seed-demo.ts
 * 
 * WARNING: This DELETES all data and creates fresh demo data.
 * Only use for development!
 */
import { PrismaClient } from "@prisma/client";
import { seedDemoData } from "../src/lib/demo-seed";
import { assertDisposableDatabase } from "../src/lib/security/database-safety";

const db = new PrismaClient();

async function main() {
  assertDisposableDatabase();
  console.log("⚠️  WARNING: This will DELETE ALL DATA and create fresh demo data!");
  console.log("Only run this for development/testing.");
  console.log("");
  
  console.log("Seeding Shanyraq demo data...");
  await seedDemoData(db);
  console.log("Demo seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
