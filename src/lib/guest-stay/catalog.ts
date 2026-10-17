import type { PrismaClient, Prisma } from "@prisma/client";
import { PublicError, AuthorizationError } from "@/server/errors";
import type { CurrentMembership } from "@/lib/tenant";
import { publicUnitAvailability } from "@/lib/availability/service";
import { computeStayTotal } from "@/lib/reservations/service";
import { parseISODate } from "@/lib/dates";
import { range, disabled, listingInput, id, httpsUrl } from "./policy";
import type { z } from "zod";
export type Tx = Prisma.TransactionClient;
export const tenant = (m: CurrentMembership) => ({
  organizationId: m.organizationId,
  hotelId: m.hotelId,
});
export const scope = (m: CurrentMembership) =>
  `${m.userId}:${m.organizationId}:${m.hotelId}`;
export async function owner(tx: Tx, m: CurrentMembership) {
  const row = await tx.membership.findFirst({
    where: {
      id: m.id,
      userId: m.userId,
      organizationId: m.organizationId,
      hotelId: m.hotelId,
      role: "OWNER",
      hotel: { orgId: m.organizationId },
    },
  });
  if (!row) throw new AuthorizationError();
}
export async function ownedRoom(tx: Tx, m: CurrentMembership, roomId: string) {
  const room = await tx.room.findFirst({
    where: {
      id: roomId,
      hotelId: m.hotelId,
      hotel: { orgId: m.organizationId },
    },
    include: { rentalProperty: true, roomType: true },
  });
  if (!room) throw new PublicError("Квартира не найдена.");
  return room;
}
export async function saveListing(
  tx: Tx,
  m: CurrentMembership,
  roomId: string,
  version: number,
  input: z.infer<typeof listingInput>,
) {
  disabled("PUBLIC_CATALOG_ENABLED");
  await owner(tx, m);
  const room = await ownedRoom(tx, m, roomId);
  await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "id"=${room.id} AND "hotelId"=${m.hotelId} FOR UPDATE`;
  const old = await tx.catalogListing.findUnique({ where: { roomId } });
  if ((old?.version ?? 0) !== version)
    throw new PublicError("Публикация изменилась. Обновите страницу.");
  const { publicContentConfirmed: confirmed, ...data } =
    listingInput.parse(input);
  if (!confirmed || new Set(data.photoIds).size !== data.photoIds.length)
    throw new PublicError("Проверьте публичные данные.");
  if (
    (await tx.communicationPhoto.count({
      where: {
        ...tenant(m),
        roomId,
        archivedAt: null,
        id: { in: data.photoIds },
      },
    })) !== data.photoIds.length
  )
    throw new PublicError("Фотографии не найдены.");
  if (
    data.ratePlanId &&
    !(await tx.ratePlan.findFirst({
      where: {
        id: data.ratePlanId,
        hotelId: m.hotelId,
        rentalPropertyId: room.rentalPropertyId,
        roomTypeId: room.roomTypeId,
      },
    }))
  )
    throw new PublicError("Неверный тариф.");
  const listing = old
    ? await tx.catalogListing.update({
        where: { id: old.id },
        data: { ...data, version: { increment: 1 } },
      })
    : await tx.catalogListing.create({
        data: { ...tenant(m), roomId, ...data },
      });
  await tx.auditLog.create({
    data: {
      hotelId: m.hotelId,
      actorUserId: m.userId,
      actor: m.userId,
      action: data.published ? "catalog.published" : "catalog.unpublished",
      entity: "CatalogListing",
      entityId: listing.id,
    },
  });
  return { id: listing.id, version: listing.version };
}
export async function catalogView(
  db: PrismaClient,
  slug: string,
  listingId?: string,
  selection?: z.infer<typeof range>,
  preview?: CurrentMembership,
) {
  disabled("PUBLIC_CATALOG_ENABLED");
  id.parse(slug);
  if (listingId) id.parse(listingId);
  if (selection) range.parse(selection);
  if (preview) await owner(db, preview);
  const rows = await db.catalogListing.findMany({
    where: {
      ...(listingId ? { id: listingId } : {}),
      ...(!preview ? { published: true } : tenant(preview)),
      hotel: { slug },
      room: { rentalProperty: { status: "ACTIVE" } },
    },
    include: {
      room: {
        select: {
          roomType: { select: { capacity: true } },
          rentalProperty: { select: { timezone: true } },
        },
      },
      hotel: {
        select: { defaultCheckInTime: true, defaultCheckOutTime: true },
      },
    },
    orderBy: { id: "asc" },
    take: 100,
  });
  const cards = await Promise.all(
    rows.map(async (l) => {
      let availability: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN" = "UNKNOWN";
      let price: { total: number; currency: string } | null = null;
      if (selection) {
        availability = await publicUnitAvailability(
          l.hotelId,
          l.roomId,
          parseISODate(selection.checkIn),
          parseISODate(selection.checkOut),
          selection.guests,
          l.ratePlanId,
          db,
        );
        if (l.ratePlanId) {
          const room = await db.room.findFirstOrThrow({
            where: { id: l.roomId, hotelId: l.hotelId },
            select: { roomTypeId: true },
          });
          // Explicit tariff selected by owner; the existing engine supplies nightly fallback.
          try {
            price = await computeStayTotal(
              l.hotelId,
              l.ratePlanId,
              room.roomTypeId,
              parseISODate(selection.checkIn),
              parseISODate(selection.checkOut),
              db,
            );
          } catch {
            price = null;
          }
        }
      }
      const photos = await db.communicationPhoto.findMany({
        where: {
          id: { in: l.photoIds },
          hotelId: l.hotelId,
          organizationId: l.organizationId,
          roomId: l.roomId,
          archivedAt: null,
        },
        select: { id: true },
      });
      return {
        id: l.id,
        title: l.title,
        description: l.description,
        publicLocation: l.publicLocation,
        amenities: l.amenities,
        restrictions: l.restrictions,
        contactUrl: httpsUrl.safeParse(l.contactUrl).success
          ? l.contactUrl
          : "",
        capacity: l.room.roomType.capacity,
        checkInTime: l.hotel.defaultCheckInTime,
        checkOutTime: l.hotel.defaultCheckOutTime,
        timezone: l.room.rentalProperty.timezone,
        photoPositions: l.photoIds
          .map((v, i) => (photos.some((p) => p.id === v) ? i : -1))
          .filter((v) => v >= 0),
        availability,
        price,
      };
    }),
  );
  return { cards, selection: selection ?? null };
}
export async function catalogPhoto(
  db: PrismaClient,
  listingId: string,
  position: number,
) {
  disabled("PUBLIC_CATALOG_ENABLED");
  const listing = await db.catalogListing.findFirst({
    where: {
      id: id.parse(listingId),
      published: true,
      room: { rentalProperty: { status: "ACTIVE" } },
    },
  });
  if (
    !listing ||
    !Number.isInteger(position) ||
    position < 0 ||
    position >= listing.photoIds.length
  )
    return null;
  return db.communicationPhoto.findFirst({
    where: {
      id: listing.photoIds[position],
      hotelId: listing.hotelId,
      organizationId: listing.organizationId,
      roomId: listing.roomId,
      archivedAt: null,
    },
    select: { bytes: true, contentType: true },
  });
}
export type CatalogView = Awaited<ReturnType<typeof catalogView>>;
