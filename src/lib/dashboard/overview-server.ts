import "server-only";
import { db } from "@/lib/db";
import { getDashboardStats, getRecentReservations, getChannelHealth, type DashboardDayPoint, type ReservationWithRelations } from "@/lib/stats";
import { todayInTimeZone, formatMediumDate, formatShortDate } from "@/lib/dates";
import { toReservationVM } from "@/lib/types";
import { PRODUCT_AVAILABILITY } from "@/lib/product-availability";
import type { CurrentUser } from "@/lib/tenant";
import type { OverviewBlock, OverviewCore, OverviewData, AttentionItem } from "./overview-types";

interface Hotel { id: string; name: string; timezone: string; currency: string }

export async function readOverviewBlock<K extends OverviewBlock>(block: K, hotel: Hotel, user: CurrentUser, locale: "ru" | "kk"): Promise<OverviewData[K]> {
  let result: OverviewData[OverviewBlock];
  if (block === "core") result = await core(hotel, user, locale);
  else if (block === "attention") result = await attention(hotel, locale);
  else if (block === "recent") result = (await getRecentReservations(hotel.id, 20)).map((reservation) => {
    const row = toReservationVM(reservation);
    // Read-only list projection: no contacts, notes, payment methods, deposits or editor data on device.
    return { id: row.id, sequenceNumber: row.sequenceNumber, guestName: row.guestName, roomNumber: row.roomNumber, checkIn: row.checkIn, checkOut: row.checkOut, channel: row.channel, totalAmount: row.totalAmount, status: row.status };
  });
  else result = PRODUCT_AVAILABILITY.channels ? (await getChannelHealth(hotel.id)).map((row) => ({ ...row, lastSyncAt: row.lastSyncAt?.toISOString() ?? null })) : [];
  return result as OverviewData[K];
}

async function core(hotel: Hotel, user: CurrentUser, locale: "ru" | "kk"): Promise<OverviewCore> {
  const day = todayInTimeZone(hotel.timezone);
  const stats = await getDashboardStats(hotel.id, day, hotel.timezone, hotel.currency);
  const kk = locale === "kk";
  const points = (rows: DashboardDayPoint[]) => rows.map((row) => ({ ...row, date: row.date.toISOString() }));
  const todayRow = (row: ReservationWithRelations) => ({
    id: row.id, guest: { fullName: row.guest.fullName }, room: { number: row.room.number }, roomType: { name: row.roomType.name },
    sourceChannel: row.sourceChannel, status: row.status, checkInTime: row.checkInTime, checkOutTime: row.checkOutTime,
  });
  const waiting = stats.arrivalsToday.filter((row) => !["CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(row.status)).length;
  const unusualArrivals = stats.arrivalsToday.filter((r) => !["CANCELLED", "NO_SHOW", "CHECKED_OUT"].includes(r.status) && (r.checkInTime < "14:00" || r.checkInTime > "20:00"))
    .map((r) => ({ label: `${kk ? (r.checkInTime < "14:00" ? "Ерте келу" : "Кеш келу") : (r.checkInTime < "14:00" ? "Ранний заезд" : "Поздний заезд")} · ${r.checkInTime}`, room: r.room.number, guest: r.guest.fullName, href: `/dashboard/reservations/${r.id}` }));
  const unusualDepartures = stats.departuresToday.filter((r) => !["CANCELLED", "NO_SHOW"].includes(r.status) && r.checkOutTime !== "12:00")
    .map((r) => ({ label: `${kk ? (r.checkOutTime < "12:00" ? "Ерте кету" : "Кеш кету") : (r.checkOutTime < "12:00" ? "Ранний выезд" : "Поздний выезд")} · ${r.checkOutTime}`, room: r.room.number, guest: r.guest.fullName, href: `/dashboard/reservations/${r.id}` }));
  const hour = Number(new Intl.DateTimeFormat("ru-RU", { timeZone: hotel.timezone, hour: "2-digit", hour12: false }).format(new Date()));
  return {
    hotelName: hotel.name, currency: hotel.currency, userFirstName: user.firstName,
    greeting: kk ? (hour < 12 ? "Қайырлы таң" : hour < 18 ? "Қайырлы күн" : "Қайырлы кеш") : (hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер"),
    dateLabel: formatMediumDate(day), revenuePeriodLabel: day.getUTCDate() === 1 ? formatShortDate(day) : `1–${formatShortDate(day)}`,
    stats: {
      totalRooms: stats.totalRooms, occupiedTonight: stats.occupiedTonight, occupancyTonight: stats.occupancyTonight,
      availableRoomsTonight: stats.availableRoomsTonight, activeReservations: stats.activeReservations,
      activeReservationsByStatus: stats.activeReservationsByStatus, inHouseGuests: stats.inHouseGuests,
      revenueMonthToDate: stats.revenueMonthToDate, revenueNightsMonthToDate: stats.revenueNightsMonthToDate,
      revenueToday: stats.revenueByDay.find((point) => point.date.getTime() === day.getTime())?.value ?? 0,
      arrivalsToday: stats.arrivalsToday.map(todayRow), departuresToday: stats.departuresToday.map(todayRow), roomsCleaning: stats.roomsCleaning,
      occupancyTrend: points(stats.occupancyTrend), bookingTrend: points(stats.bookingTrend), occupancyForecast: points(stats.occupancyForecast),
    },
    attention: [...unusualDepartures.map((item) => ({ ...item, priority: 2 })), ...unusualArrivals.map((item) => ({ ...item, priority: 3 })), ...(waiting ? [{ priority: 6, label: kk ? `${waiting} қонақ қоныстануды күтуде` : `${waiting} ожидают заселения`, room: kk ? "Келулер" : "Заезды", guest: kk ? "Бүгін" : "Сегодня", href: "/dashboard/reservations?period=arrivals" }] : [])],
  };
}

async function attention(hotel: Hotel, locale: "ru" | "kk"): Promise<AttentionItem[]> {
  const kk = locale === "kk";
  const [rooms, deposits, active] = await Promise.all([
    db.room.findMany({ where: { hotelId: hotel.id, status: { in: ["CLEANING", "MAINTENANCE", "OUT_OF_ORDER"] } }, select: { id: true, number: true, status: true }, orderBy: { number: "asc" }, take: 100 }),
    db.reservation.findMany({ where: { hotelId: hotel.id, status: "CHECKED_OUT", depositAmount: { gt: 0 }, depositCollectedAt: { not: null }, depositReturnedAt: null }, include: { room: { select: { number: true } }, guest: { select: { fullName: true } } }, orderBy: { updatedAt: "asc" }, take: 10 }),
    db.reservation.findMany({ where: { hotelId: hotel.id, status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] }, checkOut: { gt: todayInTimeZone(hotel.timezone) } }, select: { id: true, roomId: true, checkIn: true, checkOut: true, guest: { select: { fullName: true } }, room: { select: { number: true } } }, orderBy: { checkIn: "asc" }, take: 150 }),
  ]);
  const conflicts: AttentionItem[] = [];
  for (let i = 0; i < active.length; i += 1) {
    const current = active[i];
    const other = active.slice(i + 1).find((row) => row.roomId === current.roomId && row.checkIn < current.checkOut && row.checkOut > current.checkIn);
    if (other) conflicts.push({ priority: 1, label: kk ? "Бронь күндері қабаттасуы мүмкін" : "Возможное пересечение броней", room: current.room.number, guest: `${current.guest.fullName} / ${other.guest.fullName}`, href: `/dashboard/reservations/${current.id}` });
  }
  return [
    ...deposits.map((row) => ({ priority: 0, label: kk ? "Қонақ кеткен соң депозит қайтарылмады" : "Депозит не возвращён после выезда", room: row.room.number, guest: row.guest.fullName, href: `/dashboard/reservations/${row.id}` })),
    ...conflicts,
    ...rooms.map((row) => ({ priority: row.status === "CLEANING" ? 5 : 4, label: row.status === "CLEANING" ? (kk ? "Жинау керек" : "Требуется уборка") : (kk ? "Қызмет көрсету керек" : "Требуется обслуживание"), room: row.number, guest: "", href: `/dashboard/rooms?room=${row.id}` })),
  ].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)).slice(0, 12);
}
