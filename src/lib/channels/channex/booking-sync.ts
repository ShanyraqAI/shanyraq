import "server-only";

import { Prisma } from "@prisma/client";
import { ACTIVE_RESERVATION_STATUSES } from "@/lib/constants";
import { parseISODate } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  createReservation,
  findFreeRoom,
  setReservationStatus,
  updateReservationDetails,
} from "@/lib/reservations/service";
import { PublicError } from "@/server/errors";
import {
  ChannexApiError,
  createChannexClient,
  type ChannexBookingRevisionPayload,
} from "./client";
import { enqueueChannexSyncs } from "./sync-outbox";

const MAX_FEED_BATCHES = 10;

function isActiveReservation(status: string) {
  return (ACTIVE_RESERVATION_STATUSES as readonly string[]).includes(status);
}

function otaCode(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("booking")) return "booking";
  if (normalized.includes("airbnb")) return "airbnb";
  if (normalized.includes("ostrovok") || normalized.includes("emerging") || normalized.includes("etg")) return "ostrovok";
  if (normalized.includes("bronevik")) return "bronevik";
  if (normalized.includes("expedia")) return "expedia";
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return slug || "channex";
}

function safeFailure(error: unknown) {
  if (error instanceof ChannexApiError) return { code: error.kind, message: error.message };
  if (error instanceof PublicError) return { code: "BOOKING_REJECTED", message: error.message };
  return { code: "BOOKING_PROCESSING_FAILED", message: "Не удалось обработать бронирование Channex." };
}

async function persistRevision(property: {
  id: string; organizationId: string; hotelId: string; rentalPropertyId: string; propertyId: string;
}, revision: ChannexBookingRevisionPayload) {
  if (revision.propertyId !== property.propertyId) throw new PublicError("Revision относится к другому объекту Channex.");
  const idempotencyKey = revision.systemId ?? revision.id;
  const replay = await db.channexBookingRevision.findFirst({
    where: {
      propertyRefId: property.id,
      OR: [{ revisionId: revision.id }, { idempotencyKey }],
    },
  });
  if (replay) return replay;
  return db.channexBookingRevision.upsert({
    where: { propertyRefId_revisionId: { propertyRefId: property.id, revisionId: revision.id } },
    update: {},
    create: {
      propertyRefId: property.id,
      organizationId: property.organizationId,
      hotelId: property.hotelId,
      rentalPropertyId: property.rentalPropertyId,
      revisionId: revision.id,
      channexBookingId: revision.bookingId,
      sourceSystemId: revision.systemId,
      idempotencyKey,
      eventType: revision.status.toUpperCase(),
      payload: revision as unknown as Prisma.InputJsonValue,
    },
  });
}

async function findOrCreateGuest(hotelId: string, revision: ChannexBookingRevisionPayload) {
  const fullName = `${revision.customer.name} ${revision.customer.surname}`.trim() || "Гость Channex";
  const existing = await db.guest.findFirst({
    where: {
      hotelId,
      OR: [
        ...(revision.customer.email ? [{ email: revision.customer.email }] : []),
        { fullName },
      ],
    },
    select: { id: true },
  });
  if (existing) return existing;
  return db.guest.create({
    data: {
      hotelId,
      fullName,
      email: revision.customer.email,
      phone: revision.customer.phone,
      country: revision.customer.country,
    },
    select: { id: true },
  });
}

/**
 * A crash between creating a reservation and saving its Channex link would
 * otherwise make every retry collide with the unique external ID.
 */
async function recoverUnlinkedReservation(
  property: { organizationId: string; hotelId: string; rentalPropertyId: string },
  bookingRecordId: string,
  roomKey: string,
  sourceChannel: string,
  externalReservationId: string,
) {
  const reservation = await db.reservation.findFirst({
    where: { hotelId: property.hotelId, rentalPropertyId: property.rentalPropertyId, sourceChannel, externalReservationId },
  });
  if (!reservation) return undefined;
  await db.channexBookingReservation.upsert({
    where: { bookingRecordId_roomKey: { bookingRecordId, roomKey } },
    update: { reservationId: reservation.id },
    create: {
      bookingRecordId,
      reservationId: reservation.id,
      organizationId: property.organizationId,
      hotelId: property.hotelId,
      rentalPropertyId: property.rentalPropertyId,
      roomKey,
    },
  });
  return reservation;
}

async function applyRevision(property: {
  id: string; organizationId: string; hotelId: string; rentalPropertyId: string;
}, inboxId: string, revision: ChannexBookingRevisionPayload) {
  const sourceChannel = otaCode(revision.otaName);
  const booking = await db.channexBooking.upsert({
    where: { propertyRefId_uniqueId: { propertyRefId: property.id, uniqueId: revision.uniqueId } },
    update: {
      channexBookingId: revision.bookingId,
      otaCode: sourceChannel,
      otaName: revision.otaName,
      otaReservationCode: revision.otaReservationCode,
      lastRevisionAt: new Date(),
    },
    create: {
      propertyRefId: property.id,
      organizationId: property.organizationId,
      hotelId: property.hotelId,
      rentalPropertyId: property.rentalPropertyId,
      channexBookingId: revision.bookingId,
      uniqueId: revision.uniqueId,
      otaCode: sourceChannel,
      otaName: revision.otaName,
      otaReservationCode: revision.otaReservationCode,
      lastRevisionAt: new Date(),
    },
  });
  await db.channexBookingRevision.update({ where: { id: inboxId }, data: { bookingRecordId: booking.id } });
  const commissionSetting = revision.otaCommission === null
    ? await db.channelCommissionSetting.findUnique({ where: { hotelId_sourceChannel: { hotelId: property.hotelId, sourceChannel } } })
    : null;
  const bookingRoomAmount = revision.rooms.reduce((sum, room) => sum + room.amount, 0);
  const existingLinks = await db.channexBookingReservation.findMany({
    where: { bookingRecordId: booking.id },
    include: { reservation: true },
  });

  if (revision.status === "cancelled") {
    for (const link of existingLinks) {
      if (isActiveReservation(link.reservation.status)) {
        await setReservationStatus(property.hotelId, link.reservationId, "CANCELLED", { enqueueChannelSync: false });
      }
      const roomIndex = revision.rooms.findIndex((room, indexInRevision) => (room.otaUniqueId ?? `index-${indexInRevision + 1}`) === link.roomKey);
      const revisionRoom = roomIndex >= 0 ? revision.rooms[roomIndex] : null;
      const share = revisionRoom && bookingRoomAmount > 0 ? revisionRoom.amount / bookingRoomAmount : existingLinks.length > 0 ? 1 / existingLinks.length : 0;
      const commission = revision.otaCommission !== null ? revision.otaCommission * share : null;
      if (revision.amount !== null || commission !== null || revision.services.length || revision.paymentCollect !== null || revision.paymentType !== null) {
        await db.reservation.update({
          where: { id: link.reservationId },
          data: {
            ...(revision.amount !== null && share > 0 ? { channelBookingAmount: revision.amount * share } : {}),
            ...(commission !== null ? {
              otaCommissionAmount: commission,
              otaCommissionSource: revision.otaCommission !== null ? "CHANNEX" : "ESTIMATED",
              commissionRateSnapshot: commissionSetting && revision.otaCommission === null ? commissionSetting.ratePercent : null,
              commissionFixedSnapshot: commissionSetting && revision.otaCommission === null ? commissionSetting.fixedFee : null,
            } : {}),
            paymentCollect: revision.paymentCollect,
            paymentType: revision.paymentType,
            ...(revision.services.length ? { financialServices: revision.services.flatMap((service) => service.roomIndex !== null
              ? service.roomIndex === roomIndex ? [{ ...service }] : []
              : [{ ...service, totalPrice: Math.round(service.totalPrice * share * 100) / 100 }]) as unknown as Prisma.InputJsonValue } : {}),
            financialComponentsSource: "CHANNEX",
          },
        });
      }
    }
    await enqueueAffectedAvailability(property, existingLinks.map((link) => ({
      roomTypeId: link.reservation.roomTypeId,
      checkIn: link.reservation.checkIn,
      checkOut: link.reservation.checkOut,
    })));
    return;
  }
  if (revision.rooms.length === 0) throw new PublicError("В бронировании Channex отсутствуют комнаты.");

  const roomTypeIds = [...new Set(revision.rooms.map((room) => room.roomTypeId).filter((id): id is string => Boolean(id)))];
  if (roomTypeIds.length !== new Set(revision.rooms.map((room) => room.roomTypeId)).size) {
    throw new PublicError("Channex не сопоставил тип размещения в бронировании.");
  }
  const mappings = await db.channexRoomTypeMapping.findMany({
    where: { propertyRefId: property.id, channexRoomTypeId: { in: roomTypeIds }, provisioningStatus: "PROVISIONED" },
    select: { roomTypeId: true, channexRoomTypeId: true },
  });
  const roomTypeByExternal = new Map(mappings.map((mapping) => [mapping.channexRoomTypeId!, mapping.roomTypeId]));
  if (roomTypeByExternal.size !== roomTypeIds.length) throw new PublicError("Для бронирования Channex не настроено сопоставление типа размещения.");

  const suppliedRateIds = [...new Set(revision.rooms.map((room) => room.ratePlanId).filter((id): id is string => Boolean(id)))];
  if (suppliedRateIds.length) {
    const mappedRates = await db.channexRatePlanMapping.count({
      where: { propertyRefId: property.id, channexRatePlanId: { in: suppliedRateIds }, provisioningStatus: "PROVISIONED" },
    });
    if (mappedRates !== suppliedRateIds.length) throw new PublicError("Для бронирования Channex не настроено сопоставление тарифа.");
  }

  const guest = await findOrCreateGuest(property.hotelId, revision);
  const desiredKeys = new Set<string>();
  const affected: Array<{ roomTypeId: string; checkIn: Date; checkOut: Date }> = [];
  const activeReservationIds: string[] = [];
  for (const [index, room] of revision.rooms.entries()) {
    const roomKey = room.otaUniqueId ?? `index-${index + 1}`;
    desiredKeys.add(roomKey);
    const roomTypeId = roomTypeByExternal.get(room.roomTypeId!);
    if (!roomTypeId) throw new PublicError("Тип размещения Channex не найден.");
    const checkIn = parseISODate(room.checkIn);
    const checkOut = parseISODate(room.checkOut);
    const link = existingLinks.find((item) => item.roomKey === roomKey);
    const externalReservationId = `${revision.uniqueId}:${roomKey}`;
    const current = link?.reservation ?? await recoverUnlinkedReservation(property, booking.id, roomKey, sourceChannel, externalReservationId);
    const targetRoom = current?.roomTypeId === roomTypeId
      ? { id: current.roomId }
      : await findFreeRoom(property.hotelId, roomTypeId, checkIn, checkOut);
    if (!targetRoom) throw new PublicError(`Нет свободного пәтера для бронирования ${revision.otaReservationCode ?? revision.uniqueId}.`);

    let reservationId: string;
    if (current && isActiveReservation(current.status)) {
      await updateReservationDetails({
        id: current.id,
        hotelId: property.hotelId,
        guestId: guest.id,
        roomId: targetRoom.id,
        checkIn: room.checkIn,
        checkOut: room.checkOut,
        checkInTime: revision.arrivalHour ?? undefined,
        adults: room.adults,
        children: room.children,
        pricingMode: "MANUAL",
        manualTotalAmount: room.amount,
        manualCurrency: revision.currency,
        notes: revision.notes,
        enqueueChannelSync: false,
      });
      reservationId = current.id;
      affected.push({ roomTypeId: current.roomTypeId, checkIn: current.checkIn, checkOut: current.checkOut });
    } else {
      const created = await createReservation({
        hotelId: property.hotelId,
        guestId: guest.id,
        roomId: targetRoom.id,
        checkIn: room.checkIn,
        checkOut: room.checkOut,
        checkInTime: revision.arrivalHour ?? undefined,
        adults: room.adults,
        children: room.children,
        pricingMode: "MANUAL",
        manualTotalAmount: room.amount,
        manualCurrency: revision.currency,
        sourceChannel,
        externalReservationId,
        status: "CONFIRMED",
        notes: revision.notes,
        enqueueChannelSync: false,
      });
      reservationId = created.id;
      await db.channexBookingReservation.upsert({
        where: { bookingRecordId_roomKey: { bookingRecordId: booking.id, roomKey } },
        update: { reservationId: created.id },
        create: {
          bookingRecordId: booking.id,
          reservationId: created.id,
          organizationId: property.organizationId,
          hotelId: property.hotelId,
          rentalPropertyId: property.rentalPropertyId,
          roomKey,
        },
      });
    }
    const share = bookingRoomAmount > 0 ? room.amount / bookingRoomAmount : 1 / revision.rooms.length;
    const commission = revision.otaCommission !== null
      ? revision.otaCommission * share
      : commissionSetting && commissionSetting.currency === revision.currency
        ? room.amount * Number(commissionSetting.ratePercent) / 100 + Number(commissionSetting.fixedFee) * share
        : null;
    await db.reservation.update({
      where: { id: reservationId },
      data: {
        channelBookingAmount: revision.amount === null ? null : revision.amount * share,
        otaCommissionAmount: commission,
        otaCommissionSource: commission === null ? null : revision.otaCommission !== null ? "CHANNEX" : "ESTIMATED",
        commissionRateSnapshot: commissionSetting && revision.otaCommission === null ? commissionSetting.ratePercent : null,
        commissionFixedSnapshot: commissionSetting && revision.otaCommission === null ? commissionSetting.fixedFee : null,
        paymentCollect: revision.paymentCollect,
        paymentType: revision.paymentType,
        financialServices: revision.services.length
          ? revision.services.flatMap((service) => service.roomIndex !== null
            ? service.roomIndex === index ? [{ ...service }] : []
            : [{ ...service, totalPrice: Math.round(service.totalPrice * share * 100) / 100 }]) as unknown as Prisma.InputJsonValue
          : Prisma.DbNull,
        financialComponentsSource: "CHANNEX",
      },
    });
    activeReservationIds.push(reservationId);
    affected.push({ roomTypeId, checkIn, checkOut });
  }

  for (const stale of existingLinks.filter((link) => !desiredKeys.has(link.roomKey))) {
    if (isActiveReservation(stale.reservation.status)) {
      await setReservationStatus(property.hotelId, stale.reservationId, "CANCELLED", { enqueueChannelSync: false });
    }
    affected.push({ roomTypeId: stale.reservation.roomTypeId, checkIn: stale.reservation.checkIn, checkOut: stale.reservation.checkOut });
    await db.channexBookingReservation.delete({ where: { id: stale.id } });
  }
  await db.channexBooking.update({ where: { id: booking.id }, data: { reservationId: activeReservationIds[0] ?? null } });
  await enqueueAffectedAvailability(property, affected);
}

async function enqueueAffectedAvailability(
  property: { hotelId: string; rentalPropertyId: string },
  affected: Array<{ roomTypeId: string; checkIn: Date; checkOut: Date }>,
) {
  if (!affected.length) return;
  const from = new Date(Math.min(...affected.map((item) => item.checkIn.getTime())));
  const to = new Date(Math.max(...affected.map((item) => item.checkOut.getTime() - 86_400_000)));
  await db.$transaction((tx) => enqueueChannexSyncs(tx, property.hotelId, {
    rentalPropertyId: property.rentalPropertyId,
    roomTypeIds: [...new Set(affected.map((item) => item.roomTypeId))],
    ratePlanIds: [],
    from,
    to,
    availability: true,
    restrictions: false,
  }));
}

async function processAndAcknowledge(
  property: { id: string; organizationId: string; hotelId: string; rentalPropertyId: string; propertyId: string },
  revision: ChannexBookingRevisionPayload,
) {
  const inbox = await persistRevision(property, revision);
  if (inbox.acknowledgedAt) return;
  if (inbox.processingStatus !== "PROCESSED") {
    const staleBefore = new Date(Date.now() - 10 * 60_000);
    const claimed = await db.channexBookingRevision.updateMany({
      where: {
        id: inbox.id,
        OR: [
          { processingStatus: { in: ["RECEIVED", "FAILED"] } },
          { processingStatus: "PROCESSING", processingStartedAt: { lt: staleBefore } },
        ],
      },
      data: { processingStatus: "PROCESSING", processingStartedAt: new Date(), attempts: { increment: 1 }, safeErrorCode: null, safeErrorMessage: null },
    });
    if (claimed.count !== 1) throw new PublicError("Revision Channex уже обрабатывается.");
    try {
      await applyRevision(property, inbox.id, revision);
      await db.$transaction([
        db.channexBookingRevision.update({
          where: { id: inbox.id },
          data: { processingStatus: "PROCESSED", processedAt: new Date(), payload: { processed: true } },
        }),
        db.channexProperty.update({ where: { id: property.id }, data: { lastProcessedRevisionId: revision.id } }),
      ]);
    } catch (error) {
      const failure = safeFailure(error);
      await db.channexBookingRevision.update({
        where: { id: inbox.id },
        data: { processingStatus: "FAILED", safeErrorCode: failure.code, safeErrorMessage: failure.message },
      });
      throw error;
    }
  }
  const client = createChannexClient({ environment: "staging" });
  await client.acknowledgeBookingRevision(revision.id);
  await db.channexBookingRevision.update({ where: { id: inbox.id }, data: { acknowledgedAt: new Date() } });
}

export async function pollChannexPropertyBookings(propertyRefId: string) {
  const property = await db.channexProperty.findFirst({
    where: { id: propertyRefId, environment: "STAGING", provisioningStatus: "READY", propertyId: { not: null } },
    select: { id: true, organizationId: true, hotelId: true, rentalPropertyId: true, propertyId: true },
  });
  if (!property?.propertyId) return { processed: 0, failed: 0 };
  const scopedProperty = { ...property, propertyId: property.propertyId };
  const client = createChannexClient({ environment: "staging" });
  let processed = 0;
  let failed = 0;
  for (let batch = 0; batch < MAX_FEED_BATCHES; batch++) {
    const revisions = await client.listBookingRevisionFeed(property.propertyId);
    if (!revisions.length) break;
    let stop = false;
    for (const revision of revisions) {
      try {
        await processAndAcknowledge(scopedProperty, revision);
        processed++;
      } catch (error) {
        failed++;
        stop = true;
        const failure = safeFailure(error);
        await db.channexProperty.update({
          where: { id: property.id },
          data: { lastErrorCode: failure.code, lastErrorMessage: failure.message },
        });
        console.error("Channex booking revision failed", { incidentId: crypto.randomUUID(), propertyRefId: property.id, revisionId: revision.id });
        break;
      }
    }
    if (stop || revisions.length < 100) break;
  }
  await db.channexProperty.update({ where: { id: property.id }, data: { lastBookingPollAt: new Date() } });
  return { processed, failed };
}

export async function pollAllChannexBookings(limit = 20) {
  const properties = await db.channexProperty.findMany({
    where: { environment: "STAGING", provisioningStatus: "READY", propertyId: { not: null } },
    orderBy: [{ lastBookingPollAt: "asc" }, { createdAt: "asc" }],
    take: Math.max(1, Math.min(limit, 100)),
    select: { id: true },
  });
  let processed = 0;
  let failed = 0;
  for (const property of properties) {
    const result = await pollChannexPropertyBookings(property.id);
    processed += result.processed;
    failed += result.failed;
  }
  return { properties: properties.length, processed, failed };
}

export async function triggerChannexBookingPoll(externalPropertyId: string) {
  const property = await db.channexProperty.findFirst({
    where: { environment: "STAGING", propertyId: externalPropertyId, provisioningStatus: "READY" },
    select: { id: true },
  });
  if (!property) return { found: false, processed: 0, failed: 0 };
  return { found: true, ...(await pollChannexPropertyBookings(property.id)) };
}
