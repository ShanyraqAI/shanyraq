import "server-only";

import { Prisma } from "@prisma/client";
import { ACTIVE_RESERVATION_STATUSES } from "@/lib/constants";
import { parseISODate } from "@/lib/dates";
import { db as rootDb } from "@/lib/db";
import { resolveGuest } from "@/lib/guests/resolve";
import { revisionDecision } from "./revision-order";
import { lockBusinessKeys } from "@/lib/reservations/service";
import type { AfterCommit } from "@/lib/reservations/operation";
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
  if (
    normalized.includes("ostrovok") ||
    normalized.includes("emerging") ||
    normalized.includes("etg")
  )
    return "ostrovok";
  if (normalized.includes("bronevik")) return "bronevik";
  if (normalized.includes("expedia")) return "expedia";
  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || "channex";
}

function safeFailure(error: unknown) {
  if (error instanceof ChannexApiError)
    return { code: error.kind, message: error.message };
  if (error instanceof PublicError)
    return { code: "BOOKING_REJECTED", message: error.message };
  return {
    code: "BOOKING_PROCESSING_FAILED",
    message: "Не удалось обработать бронирование Channex.",
  };
}

async function persistRevision(
  property: {
    id: string;
    organizationId: string;
    hotelId: string;
    rentalPropertyId: string;
    propertyId: string;
  },
  revision: ChannexBookingRevisionPayload,
) {
  if (revision.propertyId !== property.propertyId)
    throw new PublicError("Revision относится к другому объекту Channex.");
  const idempotencyKey = revision.id;
  const replay = await rootDb.channexBookingRevision.findFirst({
    where: {
      propertyRefId: property.id,
      revisionId: revision.id,
    },
  });
  if (replay) return replay;
  return rootDb.channexBookingRevision.upsert({
    where: {
      propertyRefId_revisionId: {
        propertyRefId: property.id,
        revisionId: revision.id,
      },
    },
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

async function findOrCreateGuest(
  db: Prisma.TransactionClient,
  hotelId: string,
  revision: ChannexBookingRevisionPayload,
  existingGuestId?: string,
) {
  return resolveGuest(db, hotelId, {
    guestId: existingGuestId,
    guestName:
      `${revision.customer.name} ${revision.customer.surname}`.trim() ||
      "Гость Channex",
    guestEmail: revision.customer.email,
    guestPhone: revision.customer.phone,
    country: revision.customer.country,
  });
}

/**
 * A crash between creating a reservation and saving its Channex link would
 * otherwise make every retry collide with the unique external ID.
 */
async function recoverUnlinkedReservation(
  db: Prisma.TransactionClient,
  property: {
    organizationId: string;
    hotelId: string;
    rentalPropertyId: string;
  },
  bookingRecordId: string,
  roomKey: string,
  sourceChannel: string,
  externalReservationId: string,
) {
  const reservation = await db.reservation.findFirst({
    where: {
      hotelId: property.hotelId,
      rentalPropertyId: property.rentalPropertyId,
      sourceChannel,
      externalReservationId,
    },
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

async function applyRevision(
  property: {
    id: string;
    organizationId: string;
    hotelId: string;
    rentalPropertyId: string;
  },
  inboxId: string,
  revision: ChannexBookingRevisionPayload,
  db: Prisma.TransactionClient,
  defer: AfterCommit,
) {
  const sourceChannel = otaCode(revision.otaName);
  const booking = await db.channexBooking.upsert({
    where: {
      propertyRefId_uniqueId: {
        propertyRefId: property.id,
        uniqueId: revision.uniqueId,
      },
    },
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
  await db.channexBookingRevision.update({
    where: { id: inboxId },
    data: { bookingRecordId: booking.id },
  });
  const commissionSetting =
    revision.otaCommission === null
      ? await db.channelCommissionSetting.findUnique({
          where: {
            hotelId_sourceChannel: { hotelId: property.hotelId, sourceChannel },
          },
        })
      : null;
  const bookingRoomAmount = revision.rooms.reduce(
    (sum, room) => sum + room.amount,
    0,
  );
  const existingLinks = await db.channexBookingReservation.findMany({
    where: { bookingRecordId: booking.id },
    include: { reservation: true },
  });

  if (revision.status === "cancelled") {
    for (const link of existingLinks) {
      if (isActiveReservation(link.reservation.status)) {
        await setReservationStatus(
          property.hotelId,
          link.reservationId,
          "CANCELLED",
          { enqueueChannelSync: false, tx: db, afterCommit: defer },
        );
      }
      const roomIndex = revision.rooms.findIndex(
        (room, indexInRevision) =>
          (room.otaUniqueId ?? `index-${indexInRevision + 1}`) === link.roomKey,
      );
      const revisionRoom = roomIndex >= 0 ? revision.rooms[roomIndex] : null;
      const share =
        revisionRoom && bookingRoomAmount > 0
          ? revisionRoom.amount / bookingRoomAmount
          : existingLinks.length > 0
            ? 1 / existingLinks.length
            : 0;
      const commission =
        revision.otaCommission !== null ? revision.otaCommission * share : null;
      if (
        revision.amount !== null ||
        commission !== null ||
        revision.services.length ||
        revision.paymentCollect !== null ||
        revision.paymentType !== null
      ) {
        await db.reservation.update({
          where: { id: link.reservationId },
          data: {
            ...(revision.amount !== null && share > 0
              ? { channelBookingAmount: revision.amount * share }
              : {}),
            ...(commission !== null
              ? {
                  otaCommissionAmount: commission,
                  otaCommissionSource:
                    revision.otaCommission !== null ? "CHANNEX" : "ESTIMATED",
                  commissionRateSnapshot:
                    commissionSetting && revision.otaCommission === null
                      ? commissionSetting.ratePercent
                      : null,
                  commissionFixedSnapshot:
                    commissionSetting && revision.otaCommission === null
                      ? commissionSetting.fixedFee
                      : null,
                }
              : {}),
            paymentCollect: revision.paymentCollect,
            paymentType: revision.paymentType,
            ...(revision.services.length
              ? {
                  financialServices: revision.services.flatMap((service) =>
                    service.roomIndex !== null
                      ? service.roomIndex === roomIndex
                        ? [{ ...service }]
                        : []
                      : [
                          {
                            ...service,
                            totalPrice:
                              Math.round(service.totalPrice * share * 100) /
                              100,
                          },
                        ],
                  ) as unknown as Prisma.InputJsonValue,
                }
              : {}),
            financialComponentsSource: "CHANNEX",
          },
        });
      }
    }
    await enqueueAffectedAvailability(
      db,
      property,
      existingLinks.map((link) => ({
        roomTypeId: link.reservation.roomTypeId,
        checkIn: link.reservation.checkIn,
        checkOut: link.reservation.checkOut,
      })),
    );
    return;
  }
  if (revision.rooms.length === 0)
    throw new PublicError("В бронировании Channex отсутствуют комнаты.");

  const roomTypeIds = [
    ...new Set(
      revision.rooms
        .map((room) => room.roomTypeId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (
    roomTypeIds.length !==
    new Set(revision.rooms.map((room) => room.roomTypeId)).size
  ) {
    throw new PublicError(
      "Channex не сопоставил тип размещения в бронировании.",
    );
  }
  const mappings = await db.channexRoomTypeMapping.findMany({
    where: {
      propertyRefId: property.id,
      channexRoomTypeId: { in: roomTypeIds },
      provisioningStatus: "PROVISIONED",
    },
    select: { roomTypeId: true, channexRoomTypeId: true },
  });
  const roomTypeByExternal = new Map(
    mappings.map((mapping) => [mapping.channexRoomTypeId!, mapping.roomTypeId]),
  );
  if (roomTypeByExternal.size !== roomTypeIds.length)
    throw new PublicError(
      "Для бронирования Channex не настроено сопоставление типа размещения.",
    );

  const suppliedRateIds = [
    ...new Set(
      revision.rooms
        .map((room) => room.ratePlanId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (suppliedRateIds.length) {
    const mappedRates = await db.channexRatePlanMapping.count({
      where: {
        propertyRefId: property.id,
        channexRatePlanId: { in: suppliedRateIds },
        provisioningStatus: "PROVISIONED",
      },
    });
    if (mappedRates !== suppliedRateIds.length)
      throw new PublicError(
        "Для бронирования Channex не настроено сопоставление тарифа.",
      );
  }

  const guest = await findOrCreateGuest(
    db,
    property.hotelId,
    revision,
    existingLinks[0]?.reservation.guestId,
  );
  const desiredKeys = new Set<string>();
  const affected: Array<{ roomTypeId: string; checkIn: Date; checkOut: Date }> =
    [];
  const activeReservationIds: string[] = [];
  for (const [index, room] of revision.rooms.entries()) {
    const roomKey = room.otaUniqueId ?? `index-${index + 1}`;
    if (desiredKeys.has(roomKey))
      throw new PublicError(
        "Revision содержит повторяющийся идентификатор комнаты.",
      );
    desiredKeys.add(roomKey);
    const roomTypeId = roomTypeByExternal.get(room.roomTypeId!);
    if (!roomTypeId) throw new PublicError("Тип размещения Channex не найден.");
    const checkIn = parseISODate(room.checkIn);
    const checkOut = parseISODate(room.checkOut);
    const link = existingLinks.find((item) => item.roomKey === roomKey);
    const externalReservationId = `${revision.uniqueId}:${roomKey}`;
    const current =
      link?.reservation ??
      (await recoverUnlinkedReservation(
        db,
        property,
        booking.id,
        roomKey,
        sourceChannel,
        externalReservationId,
      ));
    const targetRoom =
      current?.roomTypeId === roomTypeId
        ? { id: current.roomId }
        : await findFreeRoom(
            property.hotelId,
            roomTypeId,
            checkIn,
            checkOut,
            db,
          );
    if (!targetRoom)
      throw new PublicError(
        `Нет свободного пәтера для бронирования ${revision.otaReservationCode ?? revision.uniqueId}.`,
      );

    let reservationId: string;
    if (current && isActiveReservation(current.status)) {
      await updateReservationDetails(
        {
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
        },
        { tx: db, afterCommit: defer },
      );
      reservationId = current.id;
      affected.push({
        roomTypeId: current.roomTypeId,
        checkIn: current.checkIn,
        checkOut: current.checkOut,
      });
    } else {
      if (current)
        throw new PublicError(
          "Завершённая или отменённая бронь Channex требует ручной проверки перед повторным открытием.",
        );
      const created = await createReservation(
        {
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
        },
        { tx: db, afterCommit: defer },
      );
      reservationId = created.id;
      await db.channexBookingReservation.upsert({
        where: {
          bookingRecordId_roomKey: { bookingRecordId: booking.id, roomKey },
        },
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
    const share =
      bookingRoomAmount > 0
        ? room.amount / bookingRoomAmount
        : 1 / revision.rooms.length;
    const commission =
      revision.otaCommission !== null
        ? revision.otaCommission * share
        : commissionSetting && commissionSetting.currency === revision.currency
          ? (room.amount * Number(commissionSetting.ratePercent)) / 100 +
            Number(commissionSetting.fixedFee) * share
          : null;
    await db.reservation.update({
      where: { id: reservationId },
      data: {
        channelBookingAmount:
          revision.amount === null ? null : revision.amount * share,
        otaCommissionAmount: commission,
        otaCommissionSource:
          commission === null
            ? null
            : revision.otaCommission !== null
              ? "CHANNEX"
              : "ESTIMATED",
        commissionRateSnapshot:
          commissionSetting && revision.otaCommission === null
            ? commissionSetting.ratePercent
            : null,
        commissionFixedSnapshot:
          commissionSetting && revision.otaCommission === null
            ? commissionSetting.fixedFee
            : null,
        paymentCollect: revision.paymentCollect,
        paymentType: revision.paymentType,
        financialServices: revision.services.length
          ? (revision.services.flatMap((service) =>
              service.roomIndex !== null
                ? service.roomIndex === index
                  ? [{ ...service }]
                  : []
                : [
                    {
                      ...service,
                      totalPrice:
                        Math.round(service.totalPrice * share * 100) / 100,
                    },
                  ],
            ) as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        financialComponentsSource: "CHANNEX",
      },
    });
    activeReservationIds.push(reservationId);
    affected.push({ roomTypeId, checkIn, checkOut });
  }

  for (const stale of existingLinks.filter(
    (link) => !desiredKeys.has(link.roomKey),
  )) {
    if (isActiveReservation(stale.reservation.status)) {
      await setReservationStatus(
        property.hotelId,
        stale.reservationId,
        "CANCELLED",
        { enqueueChannelSync: false, tx: db, afterCommit: defer },
      );
    }
    affected.push({
      roomTypeId: stale.reservation.roomTypeId,
      checkIn: stale.reservation.checkIn,
      checkOut: stale.reservation.checkOut,
    });
    await db.channexBookingReservation.delete({ where: { id: stale.id } });
  }
  await db.channexBooking.update({
    where: { id: booking.id },
    data: { reservationId: activeReservationIds[0] ?? null },
  });
  await enqueueAffectedAvailability(db, property, affected);
}

async function enqueueAffectedAvailability(
  db: Prisma.TransactionClient,
  property: { hotelId: string; rentalPropertyId: string },
  affected: Array<{ roomTypeId: string; checkIn: Date; checkOut: Date }>,
) {
  if (!affected.length) return;
  const from = new Date(
    Math.min(...affected.map((item) => item.checkIn.getTime())),
  );
  const to = new Date(
    Math.max(...affected.map((item) => item.checkOut.getTime() - 86_400_000)),
  );
  await enqueueChannexSyncs(db, property.hotelId, {
    rentalPropertyId: property.rentalPropertyId,
    roomTypeIds: [...new Set(affected.map((item) => item.roomTypeId))],
    ratePlanIds: [],
    from,
    to,
    availability: true,
    restrictions: false,
  });
}

type BookingProperty = {
  id: string;
  organizationId: string;
  hotelId: string;
  rentalPropertyId: string;
  propertyId: string;
};
/** Persisted inbox + one transaction for ALL rooms, links, financial fields, ARI intent and processed marker. */
export async function processChannexRevision(
  property: BookingProperty,
  revision: ChannexBookingRevisionPayload,
) {
  const inbox = await persistRevision(property, revision);
  const effects: Array<() => void | Promise<void>> = [];
  try {
    await rootDb.$transaction(
      async (tx) => {
        await lockBusinessKeys(tx, [
          `channex-booking:${property.id}:${revision.bookingId}`,
          `channex-booking-key:${property.id}:${revision.uniqueId}`,
        ]);
        const currentInbox = await tx.channexBookingRevision.findUniqueOrThrow({
          where: { id: inbox.id },
        });
        if (currentInbox.processingStatus === "PROCESSED") return;
        const prior = await tx.channexBooking.findUnique({
          where: {
            propertyRefId_channexBookingId: {
              propertyRefId: property.id,
              channexBookingId: revision.bookingId,
            },
          },
        });
        if (prior && prior.uniqueId !== revision.uniqueId)
          throw new PublicError(
            "Идентификаторы бронирования Channex изменились; требуется проверка.",
          );
        const byUniqueId = await tx.channexBooking.findUnique({
          where: {
            propertyRefId_uniqueId: {
              propertyRefId: property.id,
              uniqueId: revision.uniqueId,
            },
          },
        });
        if (byUniqueId && byUniqueId.channexBookingId !== revision.bookingId)
          throw new PublicError(
            "Внешний ключ уже принадлежит другой брони Channex.",
          );
        if (prior && !prior.lastProviderRevisionAt)
          throw new PublicError(
            "Для существующей брони нужен подтверждённый исходный порядок revisions; выполните сверку с Channex перед включением новых повторов.",
          );
        const decision = revisionDecision(
          revision.insertedAt,
          prior?.lastProviderRevisionAt ?? null,
        );
        if (decision.apply) {
          const linked = prior
            ? await tx.channexBookingReservation.findMany({
                where: { bookingRecordId: prior.id },
                select: { reservationId: true },
              })
            : [];
          await lockBusinessKeys(
            tx,
            linked.map((link) => `reservation:${link.reservationId}`),
          );
          // Deterministic inventory lock order also protects two multi-room revisions for different bookings.
          const rooms = await tx.room.findMany({
            where: {
              hotelId: property.hotelId,
              rentalPropertyId: property.rentalPropertyId,
            },
            select: { id: true, roomTypeId: true },
          });
          await lockBusinessKeys(
            tx,
            rooms.map((room) => `room:${room.id}`),
          );
          await lockBusinessKeys(
            tx,
            rooms.map((room) => `room-type:${room.roomTypeId}`),
          );
          await applyRevision(property, inbox.id, revision, tx, (effect) =>
            effects.push(effect),
          );
          await tx.channexBooking.update({
            where: {
              propertyRefId_channexBookingId: {
                propertyRefId: property.id,
                channexBookingId: revision.bookingId,
              },
            },
            data: { lastProviderRevisionAt: decision.providerTime },
          });
        }
        await tx.channexBookingRevision.update({
          where: { id: inbox.id },
          data: {
            processingStatus: "PROCESSED",
            processedAt: new Date(),
            processingStartedAt: null,
            attempts: { increment: 1 },
            safeErrorCode: null,
            safeErrorMessage: null,
            payload: { processed: true, ignoredOlderRevision: !decision.apply },
          },
        });
        await tx.channexProperty.update({
          where: { id: property.id },
          data: { lastProcessedRevisionId: revision.id },
        });
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  } catch (error) {
    const failure = safeFailure(error);
    await rootDb.channexBookingRevision.updateMany({
      where: { id: inbox.id, processingStatus: { not: "PROCESSED" } },
      data: {
        processingStatus: "FAILED",
        attempts: { increment: 1 },
        safeErrorCode: failure.code,
        safeErrorMessage: failure.message,
      },
    });
    throw error;
  }
  for (const effect of effects) {
    try {
      await effect();
    } catch {
      console.error("Channex post-commit notification failed", {
        revisionId: revision.id,
      });
    }
  }
  return inbox.id;
}
async function processAndAcknowledge(
  property: BookingProperty,
  revision: ChannexBookingRevisionPayload,
) {
  const inboxId = await processChannexRevision(property, revision);
  const inbox = await rootDb.channexBookingRevision.findUniqueOrThrow({
    where: { id: inboxId },
  });
  if (inbox.acknowledgedAt) return;
  // Provider network operation deliberately outside the local transaction. Retry does not reapply data.
  const client = createChannexClient({ environment: "staging" });
  await client.acknowledgeBookingRevision(revision.id);
  await rootDb.channexBookingRevision.update({
    where: { id: inboxId },
    data: { acknowledgedAt: new Date() },
  });
}

export async function pollChannexPropertyBookings(propertyRefId: string) {
  const property = await rootDb.channexProperty.findFirst({
    where: {
      id: propertyRefId,
      environment: "STAGING",
      provisioningStatus: "READY",
      propertyId: { not: null },
    },
    select: {
      id: true,
      organizationId: true,
      hotelId: true,
      rentalPropertyId: true,
      propertyId: true,
    },
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
        await rootDb.channexProperty.update({
          where: { id: property.id },
          data: {
            lastErrorCode: failure.code,
            lastErrorMessage: failure.message,
          },
        });
        console.error("Channex booking revision failed", {
          incidentId: crypto.randomUUID(),
          propertyRefId: property.id,
          revisionId: revision.id,
        });
        break;
      }
    }
    if (stop || revisions.length < 100) break;
  }
  await rootDb.channexProperty.update({
    where: { id: property.id },
    data: { lastBookingPollAt: new Date() },
  });
  return { processed, failed };
}

export async function pollAllChannexBookings(limit = 20) {
  const properties = await rootDb.channexProperty.findMany({
    where: {
      environment: "STAGING",
      provisioningStatus: "READY",
      propertyId: { not: null },
    },
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
  const property = await rootDb.channexProperty.findFirst({
    where: {
      environment: "STAGING",
      propertyId: externalPropertyId,
      provisioningStatus: "READY",
    },
    select: { id: true },
  });
  if (!property) return { found: false, processed: 0, failed: 0 };
  return { found: true, ...(await pollChannexPropertyBookings(property.id)) };
}
