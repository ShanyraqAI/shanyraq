import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { addDays, diffDays, isISODate, parseISODate, todayInTimeZone, toISODate } from "@/lib/dates";
import { buildCsv, buildXlsx, type ExportDocument } from "@/lib/exports/workbook";
import { requireSessionHotelId } from "@/server/guards";
import { AuthenticationError, AuthorizationError, PublicError, toErrorMessage } from "@/server/errors";
import type { HotelPermission } from "@/lib/access";
import { parseReportFilters } from "@/lib/reports/performance";
import { getHotelPerformanceReport } from "@/lib/reports/service";
import { channelLabel } from "@/lib/i18n";
import { guestDisplayId, reservationDisplayId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 10_000;
const DATASETS = ["calendar", "reservations", "guests", "reports"] as const;
type Dataset = (typeof DATASETS)[number];

const DATASET_PERMISSIONS: Record<Dataset, HotelPermission> = {
  calendar: "CALENDAR",
  reservations: "RESERVATIONS",
  guests: "GUESTS",
  reports: "REPORTS",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Ожидает подтверждения",
  CONFIRMED: "Подтверждено",
  CANCELLED: "Отменено",
  CHECKED_IN: "Заселён",
  CHECKED_OUT: "Выселен",
  NO_SHOW: "Не заехал",
};

const CHANNEL_LABELS: Record<string, string> = {
  direct: "Прямое бронирование",
  booking: "Booking.com",
  ostrovok: "Ostrovok",
  krisha: "Krisha.kz",
};

function asDataset(value: string): Dataset | null {
  return DATASETS.includes(value as Dataset) ? (value as Dataset) : null;
}

function reservationRows(reservations: Awaited<ReturnType<typeof loadReservations>>) {
  return reservations.map((reservation) => ({
    id: reservationDisplayId(reservation.sequenceNumber),
    guest: reservation.guest.fullName,
    email: reservation.guest.email,
    phone: reservation.guest.phone,
    room: reservation.room.number,
    roomType: reservation.roomType.name,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    nights: diffDays(reservation.checkIn, reservation.checkOut),
    adults: reservation.adults,
    children: reservation.children,
    status: STATUS_LABELS[reservation.status] ?? reservation.status,
    source: CHANNEL_LABELS[reservation.sourceChannel] ?? reservation.sourceChannel,
    rate: reservation.ratePlan?.name ?? "—",
    amount: Number(reservation.totalAmount),
    currency: reservation.currency,
    notes: reservation.notes,
    createdAt: reservation.createdAt,
  }));
}

async function loadReservations(hotelId: string, range?: { from: Date; toExclusive: Date }) {
  const rows = await db.reservation.findMany({
    where: {
      hotelId,
      ...(range ? { status: { not: "CANCELLED" }, checkIn: { lt: range.toExclusive }, checkOut: { gt: range.from } } : {}),
    },
    include: {
      guest: { select: { fullName: true, email: true, phone: true } },
      room: { select: { number: true } },
      roomType: { select: { name: true } },
      ratePlan: { select: { name: true } },
    },
    orderBy: [{ checkIn: "asc" }, { room: { number: "asc" } }],
    take: MAX_ROWS + 1,
  });
  if (rows.length > MAX_ROWS) throw new PublicError(`Экспорт ограничен ${MAX_ROWS.toLocaleString("ru-RU")} строками. Сузьте период.`);
  return rows;
}

function reservationColumns(includeCreated = true) {
  const columns = [
    { header: "ID брони", key: "id", width: 28 },
    { header: "Гость", key: "guest", width: 24 },
    { header: "Email", key: "email", width: 28 },
    { header: "Телефон", key: "phone", width: 18 },
    { header: "Номер", key: "room", width: 12 },
    { header: "Категория", key: "roomType", width: 20 },
    { header: "Заезд", key: "checkIn", width: 13, numberFormat: "dd.mm.yyyy" },
    { header: "Выезд", key: "checkOut", width: 13, numberFormat: "dd.mm.yyyy" },
    { header: "Ночей", key: "nights", width: 10, numberFormat: "0" },
    { header: "Взрослых", key: "adults", width: 11, numberFormat: "0" },
    { header: "Детей", key: "children", width: 9, numberFormat: "0" },
    { header: "Статус", key: "status", width: 20 },
    { header: "Источник", key: "source", width: 20 },
    { header: "Тариф", key: "rate", width: 20 },
    { header: "Сумма", key: "amount", width: 15, numberFormat: "#,##0.00" },
    { header: "Валюта", key: "currency", width: 10 },
    { header: "Комментарий", key: "notes", width: 34 },
  ];
  if (includeCreated) columns.push({ header: "Создано", key: "createdAt", width: 18, numberFormat: "dd.mm.yyyy hh:mm" });
  return columns;
}

async function calendarDocument(hotelId: string, url: URL): Promise<ExportDocument> {
  const fromText = url.searchParams.get("from") ?? "";
  const toText = url.searchParams.get("to") ?? "";
  if (!isISODate(fromText) || !isISODate(toText)) throw new PublicError("Укажите корректный период экспорта.");
  const from = parseISODate(fromText);
  const to = parseISODate(toText);
  if (to < from) throw new PublicError("Конечная дата не может быть раньше начальной.");
  if (diffDays(from, to) > 366) throw new PublicError("За один раз можно экспортировать максимум 367 дней.");
  const reservations = await loadReservations(hotelId, { from, toExclusive: addDays(to, 1) });
  return {
    title: "Календарь бронирований",
    subtitle: `Период: ${fromText} — ${toText} · отменённые брони не включены`,
    sheetName: "Календарь",
    columns: reservationColumns(false),
    rows: reservationRows(reservations),
  };
}

async function reservationsDocument(hotelId: string): Promise<ExportDocument> {
  const reservations = await loadReservations(hotelId);
  return {
    title: "Бронирования",
    subtitle: `Все бронирования отеля · сформировано ${new Date().toLocaleDateString("ru-RU")}`,
    sheetName: "Бронирования",
    columns: reservationColumns(),
    rows: reservationRows(reservations),
  };
}

async function guestsDocument(hotelId: string): Promise<ExportDocument> {
  const guests = await db.guest.findMany({
    where: { hotelId },
    include: {
      reservations: {
        where: { status: { notIn: ["CANCELLED", "NO_SHOW"] } },
        select: { checkIn: true, sourceChannel: true },
        orderBy: { checkIn: "desc" },
      },
    },
    orderBy: { fullName: "asc" },
    take: MAX_ROWS + 1,
  });
  if (guests.length > MAX_ROWS) throw new PublicError(`Экспорт ограничен ${MAX_ROWS.toLocaleString("ru-RU")} строками.`);
  return {
    title: "Гости",
    subtitle: `Гостевая база отеля · сформировано ${new Date().toLocaleDateString("ru-RU")}`,
    sheetName: "Гости",
    columns: [
      { header: "ID гостя", key: "id", width: 12 },
      { header: "ФИО", key: "fullName", width: 28 },
      { header: "Email", key: "email", width: 30 },
      { header: "Телефон", key: "phone", width: 20 },
      { header: "Страна", key: "country", width: 18 },
      { header: "Бронирований", key: "reservationCount", width: 15, numberFormat: "0" },
      { header: "Последний заезд", key: "lastStay", width: 17, numberFormat: "dd.mm.yyyy" },
      { header: "Последний источник", key: "lastSource", width: 22 },
      { header: "Комментарий", key: "notes", width: 38 },
    ],
    rows: guests.map((guest) => ({
      id: guestDisplayId(guest.sequenceNumber),
      fullName: guest.fullName,
      email: guest.email,
      phone: guest.phone,
      country: guest.country,
      reservationCount: guest.reservations.length,
      lastStay: guest.reservations[0]?.checkIn ?? null,
      lastSource: guest.reservations[0] ? CHANNEL_LABELS[guest.reservations[0].sourceChannel] ?? guest.reservations[0].sourceChannel : null,
      notes: guest.notes,
    })),
  };
}

async function reportDocument(hotelId: string, url: URL): Promise<ExportDocument> {
  const fromText = url.searchParams.get("from") ?? "";
  const toText = url.searchParams.get("to") ?? "";
  if (!isISODate(fromText) || !isISODate(toText)) throw new PublicError("Укажите корректный период экспорта.");
  const from = parseISODate(fromText);
  const to = parseISODate(toText);
  const hotel = await db.hotel.findUnique({ where: { id: hotelId }, select: { timezone: true } });
  if (!hotel) throw new PublicError("Отель не найден.");
  const currentDate = todayInTimeZone(hotel.timezone);
  if (to < from) throw new PublicError("Конечная дата не может быть раньше начальной.");
  if (to > currentDate || from > currentDate) throw new PublicError("Отчёт можно сформировать только по завершённым датам.");
  if (diffDays(from, to) > 366) throw new PublicError("За один раз можно экспортировать максимум 367 дней.");
  const parsed = parseReportFilters({ from: fromText, to: toText, source: url.searchParams.get("source") ?? "all" }, currentDate);
  const report = await getHotelPerformanceReport(hotelId, parsed);
  return {
    title: "Показатели отеля",
    subtitle: `${fromText} — ${toText} · ${parsed.source ? channelLabel(parsed.source) : "все источники"} · ${report.currency}`,
    sheetName: "Отчёт",
    columns: [
      { header: "Дата", key: "date", width: 14, numberFormat: "dd.mm.yyyy" },
      { header: "Занято номеров", key: "occupied", width: 18, numberFormat: "0" },
      { header: "Доступно номеров", key: "available", width: 20, numberFormat: "0" },
      { header: "Загрузка", key: "occupancy", width: 14, numberFormat: "0.0%" },
      { header: "Выручка", key: "revenue", width: 16, numberFormat: "#,##0.00" },
      { header: "ADR", key: "adr", width: 16, numberFormat: "#,##0.00" },
      { header: "RevPAR", key: "revpar", width: 16, numberFormat: "#,##0.00" },
    ],
    rows: report.daily.map((day) => ({
      date: day.date,
      occupied: day.occupiedRooms,
      available: day.availableRooms,
      occupancy: day.occupancy,
      revenue: Math.round(day.revenue * 100) / 100,
      adr: Math.round(day.adr * 100) / 100,
      revpar: Math.round(day.revpar * 100) / 100,
    })),
  };
}

export async function GET(request: Request, context: { params: Promise<{ dataset: string }> }) {
  try {
    const { dataset: rawDataset } = await context.params;
    const dataset = asDataset(rawDataset);
    if (!dataset) return NextResponse.json({ error: "Неизвестный тип экспорта." }, { status: 404 });
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "xlsx";
    if (format !== "xlsx" && format !== "csv") return NextResponse.json({ error: "Неизвестный формат экспорта." }, { status: 400 });

    const hotelId = await requireSessionHotelId({ permission: DATASET_PERMISSIONS[dataset], allowExpiredSync: true });
    const document = dataset === "calendar"
      ? await calendarDocument(hotelId, url)
      : dataset === "reservations"
        ? await reservationsDocument(hotelId)
        : dataset === "guests"
          ? await guestsDocument(hotelId)
          : await reportDocument(hotelId, url);
    const bytes = format === "xlsx" ? await buildXlsx(document) : buildCsv(document);
    const stamp = toISODate(new Date());
    const extension = format === "xlsx" ? "xlsx" : "csv";
    return new Response(Uint8Array.from(bytes), {
      headers: {
        "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="shanyraq-${dataset}-${stamp}.${extension}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status = error instanceof AuthenticationError ? 401 : error instanceof AuthorizationError ? 403 : error instanceof PublicError ? 400 : 500;
    return NextResponse.json({ error: toErrorMessage(error) }, { status });
  }
}
