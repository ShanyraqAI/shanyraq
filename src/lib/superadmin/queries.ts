import "server-only";

import { db } from "@/lib/db";
import { calculateActivationFunnel, hotelActivationStatus } from "@/lib/superadmin/activation";
import { requirePlatformAdmin } from "@/lib/superadmin/auth";

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getSuperAdminOverview() {
  await requirePlatformAdmin();
  const now = new Date();
  const today = startOfUtcDay(now);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [totalUsers, totalHotels, newUsersToday, totalRooms, totalReservations, reservationsToday, feedbackCount, bugReportCount, activeBetaHotels, users, hotels, supportRequests] = await Promise.all([
    db.user.count(),
    db.hotel.count(),
    db.user.count({ where: { createdAt: { gte: today } } }),
    db.room.count(),
    db.reservation.count(),
    db.reservation.count({ where: { createdAt: { gte: today } } }),
    db.supportRequest.count(),
    db.supportRequest.count({ where: { category: "PROBLEM", status: { not: "RESOLVED" } } }),
    db.betaHotelProfile.count({ where: { status: "ACTIVE" } }),
    db.user.findMany({
      select: {
        createdAt: true,
        memberships: {
          select: { hotel: { select: { _count: { select: { rooms: true, reservations: true } } } } },
        },
        analyticsEvents: { select: { occurredAt: true } },
      },
    }),
    db.hotel.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        createdAt: true,
        memberships: {
          where: { role: "OWNER" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { user: { select: { fullName: true, email: true, phone: true } } },
        },
        _count: { select: { rooms: true, reservations: true } },
        analyticsEvents: { orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
        betaProfile: { select: { status: true, assignedAdmin: { select: { fullName: true } } } },
      },
    }),
    db.supportRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        category: true,
        message: true,
        sourcePath: true,
        name: true,
        contact: true,
        status: true,
        rating: true,
        feedbackTrigger: true,
        resolvedAt: true,
        createdAt: true,
        hotel: { select: { id: true, name: true } },
        user: { select: { fullName: true, email: true, phone: true } },
        assignedTo: { select: { id: true, fullName: true } },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            type: true,
            fromStatus: true,
            toStatus: true,
            note: true,
            createdAt: true,
            actor: { select: { fullName: true } },
          },
        },
      },
    }),
  ]);

  const funnel = calculateActivationFunnel(users.map((user) => ({
    createdAt: user.createdAt,
    hasHotel: user.memberships.length > 0,
    hasRoom: user.memberships.some((membership) => membership.hotel._count.rooms > 0),
    hasReservation: user.memberships.some((membership) => membership.hotel._count.reservations > 0),
    activityDates: user.analyticsEvents.map((event) => event.occurredAt),
  })), now);
  const activeToday = users.filter((user) => user.analyticsEvents.some((event) => event.occurredAt >= today)).length;
  const activeSevenDays = users.filter((user) => user.analyticsEvents.some((event) => event.occurredAt >= sevenDaysAgo)).length;

  const calendarHotelIds = new Set((await db.analyticsEvent.findMany({
    where: { eventType: "calendar_opened", hotelId: { in: hotels.map((hotel) => hotel.id) } },
    distinct: ["hotelId"],
    select: { hotelId: true },
  })).flatMap((event) => event.hotelId ? [event.hotelId] : []));

  return {
    metrics: { totalUsers, totalHotels, newUsersToday, activeToday, activeSevenDays, totalRooms, totalReservations, reservationsToday, feedbackCount, bugReportCount, activeBetaHotels },
    funnel,
    hotels: hotels.map((hotel) => ({
      id: hotel.id,
      name: hotel.name,
      owner: hotel.memberships[0]?.user ?? null,
      roomCount: hotel._count.rooms,
      reservationCount: hotel._count.reservations,
      createdAt: hotel.createdAt,
      lastActivityAt: hotel.analyticsEvents[0]?.occurredAt ?? hotel.createdAt,
      activationStatus: hotelActivationStatus({ roomCount: hotel._count.rooms, reservationCount: hotel._count.reservations, openedCalendar: calendarHotelIds.has(hotel.id) }),
      betaStatus: hotel.betaProfile?.status ?? "NOT_ENROLLED",
      betaAdminName: hotel.betaProfile?.assignedAdmin?.fullName ?? null,
    })),
    supportRequests,
  };
}

export async function getSuperAdminHotel(hotelId: string) {
  await requirePlatformAdmin();
  return db.hotel.findUnique({
    where: { id: hotelId },
    select: {
      id: true,
      name: true,
      propertyType: true,
      city: true,
      country: true,
      timezone: true,
      currency: true,
      createdAt: true,
      organization: { select: { id: true, name: true } },
      memberships: {
        orderBy: { createdAt: "asc" },
        select: { role: true, accessLevel: true, createdAt: true, user: { select: { id: true, fullName: true, email: true, phone: true } } },
      },
      _count: { select: { rooms: true, roomTypes: true, reservations: true, guests: true, connections: true } },
      analyticsEvents: {
        orderBy: { occurredAt: "desc" },
        take: 50,
        select: { id: true, eventType: true, entityType: true, entityId: true, occurredAt: true, user: { select: { fullName: true } } },
      },
      betaProfile: {
        select: {
          status: true,
          startedAt: true,
          lastContactAt: true,
          internalNote: true,
          statusReason: true,
          assignedAdmin: { select: { id: true, fullName: true } },
        },
      },
    },
  });
}
