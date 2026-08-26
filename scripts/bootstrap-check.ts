/**
 * Simulates a serverless cold start: connects to an empty database and runs
 * the same bootstrap path as a page request. Run several copies concurrently
 * to verify the race protection (single transactional seed).
 */
import { getCurrentHotelId } from "../src/lib/db";
import { db } from "../src/lib/db";

async function main() {
  const started = Date.now();
  const hotelId = await getCurrentHotelId();
  const [reservations, connections, channels, guests] = await Promise.all([
    db.reservation.count({ where: { hotelId } }),
    db.channelConnection.count({ where: { hotelId } }),
    db.channel.count(),
    db.guest.count({ where: { hotelId } }),
  ]);
  console.log(
    `[pid ${process.pid}] ready in ${Date.now() - started}ms | reservations=${reservations} connections=${connections} channels=${channels} guests=${guests}`,
  );
  if (connections < 2 || channels < 4 || reservations < 20) {
    console.error(`[pid ${process.pid}] INCOMPLETE DATASET — race condition!`);
    process.exitCode = 1;
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(`[pid ${process.pid}] FAILED:`, e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
