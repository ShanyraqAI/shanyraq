import "server-only";

import { ACTIVE_RESERVATION_STATUSES } from "@/lib/constants";
import { addDays, eachDay, toISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import { PublicError } from "@/server/errors";
import type { ChannexAvailabilityValue, ChannexRestrictionValue } from "./client";

export const CHANNEX_FULL_SYNC_DAYS = 500;
const MAX_PAYLOAD_BYTES = 9_000_000;

interface AriScope {
  propertyRefId: string;
  from: Date;
  to: Date;
  roomTypeIds?: string[];
  ratePlanIds?: string[];
}

export async function buildChannexAri(scope: AriScope) {
  const property = await db.channexProperty.findFirst({
    where: { id: scope.propertyRefId, provisioningStatus: "READY", propertyId: { not: null } },
    include: {
      roomTypeMappings: { where: { provisioningStatus: "PROVISIONED", channexRoomTypeId: { not: null } } },
      ratePlanMappings: {
        where: { provisioningStatus: "PROVISIONED", channexRatePlanId: { not: null } },
        include: { ratePlan: { include: { rates: { where: { date: { gte: scope.from, lte: scope.to } } } } } },
      },
    },
  });
  if (!property?.propertyId) throw new PublicError("Объект Channex ещё не готов к синхронизации.");

  const roomFilter = scope.roomTypeIds?.length ? new Set(scope.roomTypeIds) : null;
  const rateFilter = scope.ratePlanIds?.length ? new Set(scope.ratePlanIds) : null;
  const roomMappings = property.roomTypeMappings.filter((mapping) => !roomFilter || roomFilter.has(mapping.roomTypeId));
  const rateMappings = property.ratePlanMappings.filter((mapping) => !rateFilter || rateFilter.has(mapping.ratePlanId));
  const roomTypeIds = roomMappings.map((mapping) => mapping.roomTypeId);

  const [rooms, reservations, materialized] = roomTypeIds.length ? await Promise.all([
    db.room.groupBy({
      by: ["roomTypeId"],
      where: { rentalPropertyId: property.rentalPropertyId, roomTypeId: { in: roomTypeIds }, status: { notIn: ["OUT_OF_ORDER", "MAINTENANCE"] } },
      _count: { _all: true },
    }),
    db.reservation.findMany({
      where: {
        rentalPropertyId: property.rentalPropertyId,
        roomTypeId: { in: roomTypeIds },
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
        checkIn: { lte: scope.to },
        checkOut: { gt: scope.from },
      },
      select: { roomTypeId: true, checkIn: true, checkOut: true },
    }),
    db.availability.findMany({
      where: { hotelId: property.hotelId, roomTypeId: { in: roomTypeIds }, date: { gte: scope.from, lte: scope.to } },
      select: { roomTypeId: true, date: true, availableRooms: true, closed: true },
    }),
  ]) : [[], [], []];

  const roomCount = new Map(rooms.map((row) => [row.roomTypeId, row._count._all]));
  const availabilityByKey = new Map(materialized.map((row) => [`${row.roomTypeId}:${row.date.getTime()}`, row]));
  const dates = eachDay(scope.from, addDays(scope.to, 1));
  const availability: ChannexAvailabilityValue[] = [];
  for (const mapping of roomMappings) {
    const values = dates.map((date) => {
      const stored = availabilityByKey.get(`${mapping.roomTypeId}:${date.getTime()}`);
      const reserved = reservations.filter((item) => item.roomTypeId === mapping.roomTypeId && item.checkIn <= date && item.checkOut > date).length;
      return {
        date,
        value: stored ? (stored.closed ? 0 : stored.availableRooms) : Math.max(0, (roomCount.get(mapping.roomTypeId) ?? 0) - reserved),
      };
    });
    availability.push(...compressDailyValues(values, (range) => ({
      property_id: property.propertyId!,
      room_type_id: mapping.channexRoomTypeId!,
      date_from: toISODate(range.from),
      date_to: toISODate(range.to),
      availability: range.value,
    })));
  }

  const restrictions: ChannexRestrictionValue[] = [];
  for (const mapping of rateMappings) {
    const rates = new Map(mapping.ratePlan.rates.map((rate) => [rate.date.getTime(), rate]));
    const values = dates.map((date) => {
      const rate = rates.get(date.getTime());
      const minStay = rate?.minStay ?? 1;
      return {
        date,
        value: {
          rate: Number(rate?.price ?? mapping.ratePlan.basePrice),
          min_stay_arrival: rate?.minStayType === "THROUGH" ? 1 : minStay,
          min_stay_through: rate?.minStayType === "THROUGH" ? minStay : 1,
          max_stay: rate?.maxStay ?? 0,
          stop_sell: rate?.stopSell ?? false,
          closed_to_arrival: rate?.closedToArrival ?? false,
          closed_to_departure: rate?.closedToDeparture ?? false,
        },
      };
    });
    restrictions.push(...compressDailyValues(values, (range) => ({
      property_id: property.propertyId!,
      rate_plan_id: mapping.channexRatePlanId!,
      date_from: toISODate(range.from),
      date_to: toISODate(range.to),
      ...range.value,
    })));
  }

  assertPayloadSize(availability);
  assertPayloadSize(restrictions);
  return { availability, restrictions };
}

function assertPayloadSize(values: unknown[]) {
  if (Buffer.byteLength(JSON.stringify({ values }), "utf8") > MAX_PAYLOAD_BYTES) {
    throw new PublicError("Пакет Channex превышает безопасный размер. Сократите диапазон синхронизации.");
  }
}

export function compressDailyValues<T, R>(
  values: Array<{ date: Date; value: T }>,
  map: (range: { from: Date; to: Date; value: T }) => R,
): R[] {
  const result: R[] = [];
  let current: { from: Date; to: Date; value: T; signature: string } | null = null;
  for (const item of values) {
    const signature = JSON.stringify(item.value);
    if (current && current.signature === signature && item.date.getTime() === addDays(current.to, 1).getTime()) {
      current.to = item.date;
      continue;
    }
    if (current) result.push(map(current));
    current = { from: item.date, to: item.date, value: item.value, signature };
  }
  if (current) result.push(map(current));
  return result;
}
