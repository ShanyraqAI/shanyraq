import type { Prisma, PrismaClient } from "@prisma/client";
import { RESERVATION_INCLUDE } from "@/lib/stats";
import { toReservationVM } from "@/lib/types";
import {
  GUEST_PAGE_SIZE,
  GUEST_DETAIL_PAGE_SIZE,
  pageNumber,
} from "./pagination";
export async function loadGuestPage(
  db: PrismaClient | Prisma.TransactionClient,
  hotelId: string,
  params: {
    page?: string;
    q?: string;
    guest?: string;
    stays?: string;
    notes?: string;
  },
) {
  const initialSelectedId = params.guest ?? null;
  const page = pageNumber(params.page);
  const stays = pageNumber(params.stays);
  const notes = pageNumber(params.notes);
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 160) : "";
  const where = {
    hotelId,
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };
  const include = {
    reservations: {
      where: { status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      orderBy: [{ checkIn: "desc" as const }, { id: "desc" as const }],
      take: 1,
      select: { checkIn: true, sourceChannel: true },
    },
    _count: {
      select: {
        reservations: {
          where: { status: { notIn: ["CANCELLED", "NO_SHOW"] } },
        },
        internalNotes: true,
      },
    },
    internalNotes: {
      where: { guestId: initialSelectedId ?? "" },
      orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
      take: GUEST_DETAIL_PAGE_SIZE,
      skip: (notes - 1) * GUEST_DETAIL_PAGE_SIZE,
      include: { author: { select: { fullName: true } } },
    },
  };
  const [guestsRaw, total, reservationsRaw, selectedRaw, summary] =
    await Promise.all([
      db.guest.findMany({
        where,
        orderBy: [{ sequenceNumber: "desc" }, { id: "desc" }],
        take: GUEST_PAGE_SIZE,
        skip: (page - 1) * GUEST_PAGE_SIZE,
        include,
      }),
      db.guest.count({ where }),
      initialSelectedId
        ? db.reservation.findMany({
            where: { hotelId, guestId: initialSelectedId },
            include: RESERVATION_INCLUDE,
            orderBy: [{ checkIn: "desc" }, { id: "desc" }],
            take: GUEST_DETAIL_PAGE_SIZE,
            skip: (stays - 1) * GUEST_DETAIL_PAGE_SIZE,
          })
        : [],
      initialSelectedId
        ? db.guest.findFirst({
            where: { hotelId, id: initialSelectedId },
            include,
          })
        : null,
      db.$queryRaw<
        Array<{ total: bigint; repeats: bigint }>
      >`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE visits > 1) AS repeats FROM (
      SELECT g.id, COUNT(r.id) AS visits FROM "Guest" g LEFT JOIN "Reservation" r ON r."guestId" = g.id AND r."hotelId" = ${hotelId} AND r.status NOT IN ('CANCELLED', 'NO_SHOW') WHERE g."hotelId" = ${hotelId} GROUP BY g.id
    ) AS guest_counts`,
    ]);
  const reservations = reservationsRaw.map(toReservationVM);
  const visible = [...guestsRaw];
  if (selectedRaw && !visible.some((g) => g.id === selectedRaw.id))
    visible.push(selectedRaw);
  const rows = visible.map((g) => ({
    id: g.id,
    sequenceNumber: g.sequenceNumber,
    fullName: g.fullName,
    email: g.email,
    phone: g.phone,
    country: g.country,
    notes: g.notes,
    internalNotes: g.internalNotes.map((note) => ({
      id: note.id,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
      authorName: note.author.fullName,
    })),
    reservationCount: g._count.reservations,
    lastStay: g.reservations[0]?.checkIn.toISOString().slice(0, 10) ?? null,
    lastChannel: g.reservations[0]?.sourceChannel ?? null,
  }));
  const repeatGuests = Number(summary[0]?.repeats ?? 0);
  const guestTotal = Number(summary[0]?.total ?? 0);
  const repeatRate = guestTotal
    ? Math.round((repeatGuests / guestTotal) * 100)
    : 0;
  const detailCounts = selectedRaw
    ? await db.reservation.count({
        where: { hotelId, guestId: selectedRaw.id },
      })
    : 0;

  return {
    page,
    stays,
    notes,
    q,
    total,
    rows,
    reservations,
    repeatGuests,
    guestTotal,
    repeatRate,
    detailCounts,
    notesTotal: selectedRaw?._count.internalNotes ?? 0,
  };
}
