import { PrismaClient } from "@prisma/client";

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
 */
export async function getCurrentHotelId(): Promise<string> {
  const hotel = await db.hotel.findFirst({
    where: { slug: DEMO_HOTEL_SLUG },
    select: { id: true },
  });
  if (!hotel) throw new Error("Demo hotel not found. Run `npm run db:reset`.");
  return hotel.id;
}

export const DEMO_HOTEL_SLUG = "shanyraq-astana";
