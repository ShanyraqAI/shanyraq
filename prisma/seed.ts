/**
 * Standalone seed entrypoint (npm run db:seed / db:reset).
 * The seeding logic itself lives in src/lib/demo-seed.ts so the runtime
 * bootstrap can reuse it on ephemeral hosts.
 */
import { PrismaClient } from "@prisma/client";
import { seedDemoData } from "../src/lib/demo-seed";

const db = new PrismaClient();

async function main() {
  console.log("Seeding Shanyraq demo data...");
  await seedDemoData(db);
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
