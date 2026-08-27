/**
 * Standalone seed entrypoint (npm run db:seed).
 * 
 * This is the SAFE production seed - it only creates system-level data
 * (channels, etc.) and does NOT delete or create demo users/hotels.
 * 
 * For demo data, use: npm run db:seed:demo
 */
import { PrismaClient } from "@prisma/client";
import { seedSystemData } from "../src/lib/system-seed";

const db = new PrismaClient();

async function main() {
  console.log("Seeding system data (channels, etc.)...");
  await seedSystemData(db);
  console.log("System seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
