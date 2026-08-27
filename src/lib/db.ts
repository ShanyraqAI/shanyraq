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
 * Get the current hotel ID from the authenticated user's membership.
 * This replaces the old DEMO_HOTEL_SLUG-based lookup.
 */
export async function getCurrentHotelId(): Promise<string> {
  await ensureDatabaseReady();
  const { getCurrentHotel } = await import("@/lib/tenant");
  const hotel = await getCurrentHotel();
  if (!hotel) throw new Error("Отель не найден. Завершите онбординг или войдите в аккаунт.");
  return hotel.id;
}

/**
 * Get the current hotel record from the authenticated user's membership.
 */
export async function getCurrentHotel() {
  await ensureDatabaseReady();
  const { getCurrentHotel: getHotel } = await import("@/lib/tenant");
  const hotel = await getHotel();
  if (!hotel) throw new Error("Отель не найден. Завершите онбординг или войдите в аккаунт.");
  return hotel;
}

/**
 * @deprecated Use getCurrentHotelId() instead.
 * Kept for backward compatibility with legacy code.
 */
export const DEMO_HOTEL_SLUG = "shanyraq-astana";

/**
 * @deprecated Use getCurrentHotel() instead.
 * Kept for backward compatibility with legacy code.
 */
export async function getDemoHotel() {
  return getCurrentHotel();
}
