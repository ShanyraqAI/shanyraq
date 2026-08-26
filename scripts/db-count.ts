import { PrismaClient } from "@prisma/client";

async function main() {
  const db = new PrismaClient();
  const h = await db.hotel.count();
  const r = await db.reservation.count();
  const c = await db.channelConnection.count();
  const g = await db.guest.count();
  console.log(`hotels: ${h} | reservations: ${r} | connections: ${c} | guests: ${g}`);
  await db.$disconnect();
}

main();
