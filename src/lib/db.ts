import { PrismaClient } from "@prisma/client";
import { ensureDatabaseReady } from "@/lib/bootstrap";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/**
 * Single-tenant MVP: resolves the active demo hotel.
 *
 * When authentication lands, this becomes `requireSession()` → membership →
 * hotel from the URL/host. Every server action and query funnels through this
 * function so tenant isolation only has to be enforced in one place.
 *
 * The database self-provisions on first access: on an empty database the
 * bootstrap applies the schema DDL and loads the demo dataset. This is what
 * keeps the ephemeral Vercel demo alive across cold starts; locally it is a
 * fast no-op.
 */
export async function getCurrentHotelId(): Promise<string> {
  await ensureDatabaseReady();
  const hotel = await db.hotel.findFirst({
    where: { slug: DEMO_HOTEL_SLUG },
    select: { id: true },
  });
  if (!hotel) throw new Error("Демо-отель не найден. Выполните npm run db:reset.");
  return hotel.id;
}

/** Same as getCurrentHotelId but returns the full hotel record. */
export async function getDemoHotel() {
  await ensureDatabaseReady();
  const hotel = await db.hotel.findFirst({
    where: { slug: DEMO_HOTEL_SLUG },
  });
  if (!hotel) throw new Error("Демо-отель не найден. Выполните npm run db:reset.");
  return hotel;
}

export const DEMO_HOTEL_SLUG = "shanyraq-astana";
