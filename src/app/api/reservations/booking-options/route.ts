import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/tenant";
import { hasHotelPermission } from "@/lib/access";
import { ACTIVE_RESERVATION_STATUSES } from "@/lib/constants";
import { parseISODate, toISODate } from "@/lib/dates";
import {
  nightlyTotal,
  staysConflict,
  validBookingRange,
} from "@/lib/reservations/date-range";
import type { BookingOptions } from "@/lib/reservations/booking-options-types";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  AuthenticationError,
  AuthorizationError,
  PublicError,
} from "@/server/errors";
import { privateJson, communicationError } from "@/lib/communications/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const member = await getCurrentMembership();
    if (!member) throw new AuthenticationError();
    const params = new URL(request.url).searchParams;
    const mode = params.get("mode");
    if (mode !== "calendar" && mode !== "quote")
      throw new PublicError("Проверьте запрос календаря.");
    if (
      mode === "quote"
        ? !hasHotelPermission(member, "RESERVATIONS")
        : !(
            hasHotelPermission(member, "CALENDAR") ||
            hasHotelPermission(member, "RESERVATIONS")
          )
    )
      throw new AuthorizationError();
    const scope = `${member.userId}:${member.hotelId}`;
    if (request.headers.get("x-shanyraq-scope") !== scope)
      throw new PublicError(
        "Вы сменили объект или пользователя. Откройте календарь заново.",
      );
    await enforceRateLimit("booking-options", scope, 90, 60000);
    const checkIn = params.get("from") ?? "";
    const checkOut = params.get("to") ?? "";
    if (!validBookingRange({ checkIn, checkOut }))
      throw new PublicError("Выберите период от 1 до 366 ночей.");
    const roomId = params.get("roomId");
    if (mode === "calendar" && !roomId)
      throw new PublicError("Выберите квартиру.");
    const from = parseISODate(checkIn);
    const to = parseISODate(checkOut);
    const rooms = await db.room.findMany({
      where: {
        hotelId: member.hotelId,
        ...(roomId ? { id: roomId } : {}),
        status: { notIn: ["OUT_OF_ORDER", "MAINTENANCE"] },
      },
      include: { roomType: { select: { capacity: true, basePrice: true } } },
      orderBy: { number: "asc" },
    });
    if (roomId && !rooms.length)
      throw new PublicError("Квартира не найдена или недоступна.");
    const staysRaw = await db.reservation.findMany({
      where: {
        hotelId: member.hotelId,
        roomId: { in: rooms.map((room) => room.id) },
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
        checkIn: { lte: to },
        checkOut: { gte: from },
      },
      select: {
        id: true,
        roomId: true,
        checkIn: true,
        checkOut: true,
        checkInTime: true,
        checkOutTime: true,
      },
      orderBy: { checkIn: "asc" },
    });
    const stays = staysRaw.map((stay) => ({
      ...stay,
      checkIn: toISODate(stay.checkIn),
      checkOut: toISODate(stay.checkOut),
    }));
    const result: BookingOptions = {
      scope,
      stays,
      quotes: [],
      checkedAt: new Date().toISOString(),
    };
    if (mode === "quote") {
      const guests = Number(params.get("guests"));
      if (!Number.isInteger(guests) || guests < 1 || guests > 20)
        throw new PublicError("Проверьте число гостей.");
      const hotel = await db.hotel.findUniqueOrThrow({
        where: { id: member.hotelId },
        select: {
          defaultCheckInTime: true,
          defaultCheckOutTime: true,
          currency: true,
        },
      });
      const range = {
        checkIn,
        checkOut,
        checkInTime: hotel.defaultCheckInTime,
        checkOutTime: hotel.defaultCheckOutTime,
      };
      const free = rooms.filter(
        (room) =>
          room.roomType.capacity >= guests &&
          !stays.some(
            (stay) => stay.roomId === room.id && staysConflict(range, stay),
          ),
      );
      const plans = await db.ratePlan.findMany({
        where: {
          hotelId: member.hotelId,
          roomTypeId: { in: free.map((room) => room.roomTypeId) },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      const rates = await db.rate.findMany({
        where: {
          ratePlanId: { in: plans.map((plan) => plan.id) },
          date: { gte: from, lt: to },
        },
        select: { ratePlanId: true, date: true, price: true },
      });
      result.quotes = free.map((room) => {
        const plan = plans.find((item) => item.roomTypeId === room.roomTypeId);
        return {
          roomId: room.id,
          ratePlanId: plan?.id ?? null,
          currency: plan?.currency ?? hotel.currency,
          total: nightlyTotal(
            Number(plan?.basePrice ?? room.roomType.basePrice),
            checkIn,
            checkOut,
            rates
              .filter((rate) => rate.ratePlanId === plan?.id)
              .map((rate) => ({
                date: toISODate(rate.date),
                price: Number(rate.price),
              })),
          ),
        };
      });
    }
    return privateJson(result);
  } catch (error) {
    return communicationError(error);
  }
}
