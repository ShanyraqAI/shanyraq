/**
 * System seed — creates only system-level data that's shared across all tenants.
 * 
 * This does NOT create demo users, hotels, or reservations.
 * It only creates the global Channel records needed for the channel manager.
 * 
 * Safe to run against production database.
 */
import type { PrismaClient } from "@prisma/client";

export async function seedSystemData(db: PrismaClient): Promise<void> {
  // ---------------------------------------------------------------- channels
  await db.channel.createMany({
    data: [
      { id: "booking", name: "Booking.com", description: "Глобальный канал с максимальным охватом путешественников." },
      { id: "ostrovok", name: "Ostrovok", description: "Канал, ориентированный на рынки СНГ и Азии." },
      { id: "krisha", name: "Krisha", description: "Казахстанская площадка для размещения объектов проживания." },
      { id: "direct", name: "Прямые брони", description: "Брони по телефону, на стойке и через сайт отеля.", isInternal: true },
    ],
    skipDuplicates: true,
  });
}