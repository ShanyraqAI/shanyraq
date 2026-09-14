import { db } from "@/lib/db";
import { parseISODate } from "@/lib/dates";
import { sendDailyOperationsDigest, sendNewReservationNotification } from "@/lib/email";

export interface NotificationInput {
  hotelId: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  dedupeKey?: string | null;
}

export async function createHotelNotification(input: NotificationInput): Promise<void> {
  const recipients = await db.membership.findMany({
    where: { hotelId: input.hotelId },
    select: { userId: true },
  });
  if (!recipients.length) return;
  await db.notification.createMany({
    data: recipients.map(({ userId }) => ({
      hotelId: input.hotelId,
      recipientUserId: userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      dedupeKey: input.dedupeKey ?? null,
    })),
    skipDuplicates: true,
  });
}

export async function getNotificationCenter(hotelId: string, userId: string) {
  const [items, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { hotelId, recipientUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, type: true, title: true, body: true, href: true, readAt: true, createdAt: true },
    }),
    db.notification.count({ where: { hotelId, recipientUserId: userId, readAt: null } }),
  ]);
  return { items, unreadCount };
}

export async function sendImmediateReservationEmails(
  hotelId: string,
  reservation: {
    id: string;
    reference: string;
    guestName: string;
    roomNumber: string;
    checkIn: string;
    checkOut: string;
    sourceChannel: string;
    totalAmount: number;
    currency: string;
  },
): Promise<void> {
  const recipients = await db.membership.findMany({
    where: { hotelId, newReservationEmail: true, user: { email: { not: null } } },
    select: { userId: true, user: { select: { email: true, fullName: true } }, hotel: { select: { name: true } } },
  });
  await Promise.all(recipients.map(async (recipient) => {
    if (!recipient.user.email) return;
    await sendNewReservationNotification({
      to: recipient.user.email,
      recipientName: recipient.user.fullName,
      hotelName: recipient.hotel.name,
      ...reservation,
      idempotencyKey: `new-reservation-${reservation.id}-${recipient.userId}`,
    });
    await db.notification.updateMany({
      where: { hotelId, recipientUserId: recipient.userId, dedupeKey: `new-reservation:${reservation.id}` },
      data: { emailSentAt: new Date() },
    });
  }));
}

function hotelClock(now: Date, timezone: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, hour: Number(value("hour")) };
}

function localTimeToUtc(date: string, hour: number, timezone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour);
  let candidate = new Date(desiredAsUtc);

  for (let attempt = 0; attempt < 2; attempt++) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(candidate);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "0";
    const actualAsUtc = Date.UTC(
      Number(value("year")),
      Number(value("month")) - 1,
      Number(value("day")),
      Number(value("hour")),
      Number(value("minute")),
    );
    candidate = new Date(candidate.getTime() + desiredAsUtc - actualAsUtc);
  }

  return candidate;
}

export async function sendScheduledDigests(now = new Date()): Promise<{ sent: number; skipped: number }> {
  const hotels = await db.hotel.findMany({
    where: { memberships: { some: {} } },
    select: {
      id: true,
      name: true,
      timezone: true,
      memberships: {
        select: { userId: true, digestHour: true, dailyDigestEmail: true, user: { select: { email: true, fullName: true } } },
      },
    },
  });
  let sent = 0;
  let skipped = 0;
  for (const hotel of hotels) {
    const clock = hotelClock(now, hotel.timezone);
    const due = hotel.memberships;
    const day = parseISODate(clock.date);
    const [arrivals, departures] = await Promise.all([
      db.reservation.findMany({
        where: { hotelId: hotel.id, checkIn: day, status: { in: ["PENDING", "CONFIRMED"] } },
        select: { room: { select: { number: true } } },
      }),
      db.reservation.findMany({
        where: { hotelId: hotel.id, checkOut: day, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
        select: { room: { select: { number: true } } },
      }),
    ]);
    const title = `План на сегодня: ${arrivals.length} заездов, ${departures.length} выездов`;
    const body = digestBody(arrivals.map((item) => item.room.number), departures.map((item) => item.room.number));
    for (const recipient of due) {
      const dedupeKey = `daily-digest:${clock.date}`;
      const notification = await db.notification.upsert({
        where: { hotelId_recipientUserId_dedupeKey: { hotelId: hotel.id, recipientUserId: recipient.userId, dedupeKey } },
        create: { hotelId: hotel.id, recipientUserId: recipient.userId, type: "DAILY_DIGEST", title, body, href: "/dashboard", dedupeKey },
        update: {},
        select: { id: true, emailSentAt: true },
      });
      if (!recipient.dailyDigestEmail || !recipient.user.email) continue;
      if (notification.emailSentAt) {
        skipped++;
        continue;
      }
      await sendDailyOperationsDigest({
        to: recipient.user.email,
        recipientName: recipient.user.fullName,
        hotelName: hotel.name,
        date: clock.date,
        arrivals: arrivals.map((item) => item.room.number),
        departures: departures.map((item) => item.room.number),
        idempotencyKey: `daily-digest-${notification.id}`,
        scheduledAt: (() => {
          const deliveryTime = localTimeToUtc(clock.date, recipient.digestHour, hotel.timezone);
          return deliveryTime.getTime() > now.getTime() ? deliveryTime : undefined;
        })(),
      });
      await db.notification.update({ where: { id: notification.id }, data: { emailSentAt: new Date() } });
      sent++;
    }
  }
  return { sent, skipped };
}

function digestBody(arrivals: string[], departures: string[]): string {
  const arrivalText = arrivals.length ? `Заезды: номера ${arrivals.join(", ")}.` : "Сегодня заездов нет.";
  const departureText = departures.length ? ` Выезды: номера ${departures.join(", ")}.` : " Сегодня выездов нет.";
  return arrivalText + departureText;
}
