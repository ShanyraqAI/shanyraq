"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionHotelId } from "@/server/guards";
import { createReservationSchema, updateReservationSchema, reservationStatusSchema, firstZodError, type ReservationStatus } from "@/lib/constants";
import {
  createReservation,
  setReservationStatus,
  updateReservationDetails,
} from "@/lib/reservations/service";
import { diffDays, isISODate, parseISODate } from "@/lib/dates";
import { ok, fail, type ActionResult } from "@/server/types";
import { PublicError, toErrorMessage } from "@/server/errors";
import { t } from "@/lib/i18n";
import { parseReservationWorkbook } from "@/lib/reservations/xlsx-import";
import type { ReservationImportPreview, ReservationImportResult, ReservationImportRow } from "@/lib/reservations/import-types";
import { importReservationRows } from "@/lib/reservations/import-service";
import { allowedGoogleSheetRedirect, googleSheetExportUrl } from "@/lib/reservations/google-sheets";
import { wakeChannelSyncWorker } from "@/server/channel-sync";
import { recordCurrentUserEvent } from "@/lib/analytics/service";
import { createHotelNotification } from "@/lib/notifications/service";

function revalidateAll() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard/guests");
  wakeChannelSyncWorker();
}

async function resolveGuest(
  hotelId: string,
  input: { guestId?: string; guestName?: string; guestEmail?: string; guestPhone?: string },
): Promise<{ id: string; created: boolean }> {
  if (input.guestId) {
    const existing = await db.guest.findFirst({ where: { id: input.guestId, hotelId }, select: { id: true } });
    if (existing) return { id: existing.id, created: false };
  }
  const name = input.guestName?.trim();
  if (!name) throw new Error(t.reservations.errors.guestRequired);
  const byName = await db.guest.findFirst({
    where: { hotelId, fullName: { equals: name } },
    select: { id: true },
  });
  if (byName) return { id: byName.id, created: false };
  const created = await db.guest.create({
    data: {
      hotelId,
      fullName: name,
      email: input.guestEmail || null,
      phone: input.guestPhone || null,
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

export async function createReservationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createReservationSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId({ permission: "RESERVATIONS" });
    const data = parsed.data;

    const room = await db.room.findFirst({ where: { id: data.roomId, hotelId }, include: { roomType: true } });
    if (!room) return fail(t.reservations.errors.roomNotFound);

    // При тарифном расчёте тариф обязателен; для ручной цены связь с тарифом не сохраняется.
    let ratePlanId = data.ratePlanId;
    if (data.pricingMode === "MANUAL") {
      ratePlanId = undefined;
    } else if (ratePlanId) {
      const plan = await db.ratePlan.findFirst({ where: { id: ratePlanId, hotelId } });
      if (!plan) return fail(t.reservations.errors.ratePlanNotFound);
      if (plan.roomTypeId !== room.roomTypeId) {
        return fail(t.reservations.errors.planMismatch(room.roomType.name));
      }
    } else {
      const fallbackPlan = await db.ratePlan.findFirst({ where: { roomTypeId: room.roomTypeId, hotelId } });
      if (fallbackPlan) {
        ratePlanId = fallbackPlan.id;
      } else {
        // Создаем временный тариф на лету из базовой цены типа номера
        const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { currency: true } });
        const tempPlan = await db.ratePlan.create({
          data: {
            hotelId,
            roomTypeId: room.roomTypeId,
            name: `Базовый — ${room.roomType.name}`,
            basePrice: room.roomType.basePrice,
            currency: hotel.currency,
          },
        });
        ratePlanId = tempPlan.id;
      }
    }

    const guest = await resolveGuest(hotelId, data);
    const reservation = await createReservation({
      hotelId,
      guestId: guest.id,
      roomId: data.roomId,
      ratePlanId,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      checkInTime: data.checkInTime,
      checkOutTime: data.checkOutTime,
      adults: data.adults,
      children: data.children,
      pricingMode: data.pricingMode,
      manualTotalAmount: data.manualTotalAmount,
      sourceChannel: data.sourceChannel,
      notes: data.notes ?? null,
      paymentMethod: data.paymentMethod,
      status: "CONFIRMED",
    });
    await recordCurrentUserEvent("reservation_created", { type: "Reservation", id: reservation.id }, { source: data.sourceChannel });
    if (guest.created) await recordCurrentUserEvent("guest_created", { type: "Guest", id: guest.id });
    revalidateAll();
    return ok({ id: reservation.id }, t.reservations.toasts.created);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function updateReservationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = updateReservationSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId({ permission: "RESERVATIONS" });
    const data = parsed.data;
    const guest = await resolveGuest(hotelId, data);
    await updateReservationDetails({
      id: data.id,
      hotelId,
      guestId: guest.id,
      roomId: data.roomId,
      ratePlanId: data.ratePlanId,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      checkInTime: data.checkInTime,
      checkOutTime: data.checkOutTime,
      adults: data.adults,
      children: data.children,
      pricingMode: data.pricingMode,
      manualTotalAmount: data.manualTotalAmount,
      notes: data.notes ?? null,
      paymentMethod: data.paymentMethod,
    });
    await recordCurrentUserEvent("reservation_updated", { type: "Reservation", id: data.id });
    if (guest.created) await recordCurrentUserEvent("guest_created", { type: "Guest", id: guest.id });
    revalidateAll();
    return ok({ id: data.id }, t.reservations.toasts.updated);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function setReservationStatusAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = reservationStatusSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId({ permission: "RESERVATIONS" });
    await setReservationStatus(hotelId, parsed.data.id, parsed.data.status as ReservationStatus);
    await recordCurrentUserEvent(
      parsed.data.status === "CANCELLED" ? "reservation_cancelled" : "reservation_updated",
      { type: "Reservation", id: parsed.data.id },
      { status: parsed.data.status },
    );
    revalidateAll();
    return ok(undefined, t.reservations.toasts.statusChanged(t.statuses.reservation[parsed.data.status]));
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function cancelReservationAction(reservationId: string): Promise<ActionResult> {
  try {
    const hotelId = await requireSessionHotelId({ permission: "RESERVATIONS" });
    await setReservationStatus(hotelId, reservationId, "CANCELLED");
    await recordCurrentUserEvent("reservation_cancelled", { type: "Reservation", id: reservationId });
    revalidateAll();
    return ok(undefined, t.reservations.toasts.cancelled);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function moveReservationAction(
  reservationId: string,
  newRoomId: string | undefined,
  newCheckIn: string | undefined,
  newCheckOut: string | undefined,
): Promise<ActionResult> {
  try {
    const hotelId = await requireSessionHotelId({ permission: "RESERVATIONS" });
    const res = await db.reservation.findFirst({ where: { id: reservationId, hotelId } });
    if (!res) return fail(t.reservations.errors.reservationNotFound);
    const roomId = newRoomId ?? res.roomId;
    const checkIn = toISOSafe(newCheckIn ? parseISODate(newCheckIn) : res.checkIn);
    const checkOut = toISOSafe(newCheckOut ? parseISODate(newCheckOut) : res.checkOut);
    if (checkOut <= checkIn) return fail(t.validation.checkoutAfterCheckin);

    const room = await db.room.findFirst({ where: { id: roomId, hotelId }, include: { roomType: true } });
    if (!room) return fail(t.reservations.errors.roomNotFound);
    const manualPricing = res.pricingMode === "MANUAL";
    const plan = manualPricing ? null : await db.ratePlan.findFirst({ where: { roomTypeId: room.roomTypeId, hotelId } });
    if (!manualPricing && !plan) return fail(t.reservations.errors.noPlanForType);

    await updateReservationDetails({
      id: res.id,
      hotelId,
      guestId: res.guestId,
      roomId,
      ratePlanId: plan?.id,
      checkIn,
      checkOut,
      checkInTime: res.checkInTime,
      checkOutTime: res.checkOutTime,
      adults: res.adults,
      children: res.children,
      pricingMode: manualPricing ? "MANUAL" : "RATE_PLAN",
      manualTotalAmount: manualPricing ? Number(res.totalAmount) : undefined,
      notes: res.notes,
    });
    await recordCurrentUserEvent("reservation_updated", { type: "Reservation", id: res.id });
    revalidateAll();
    return ok(undefined, t.reservations.toasts.movedToRoom(room.number));
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

function toISOSafe(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_REMOTE_BYTES = 5 * 1024 * 1024;

async function fetchGoogleSheet(value: string): Promise<Buffer> {
  let url = googleSheetExportUrl(value);
  for (let redirect = 0; redirect <= 3; redirect++) {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new PublicError("Google Sheets вернул некорректное перенаправление");
      const next = new URL(location, url);
      if (!allowedGoogleSheetRedirect(next)) throw new PublicError("Google Sheets перенаправил запрос на недоверенный адрес");
      url = next;
      continue;
    }
    if (!response.ok) throw new PublicError("Не удалось скачать таблицу. Откройте доступ «Все, у кого есть ссылка»");
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_REMOTE_BYTES) throw new PublicError("Google-таблица превышает лимит 5 МБ");
    if (!response.body) throw new PublicError("Google Sheets вернул пустой файл");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      total += chunk.byteLength;
      if (total > MAX_REMOTE_BYTES) {
        await reader.cancel();
        throw new PublicError("Google-таблица превышает лимит 5 МБ");
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  throw new PublicError("Google Sheets выполнил слишком много перенаправлений");
}

export async function previewReservationImportAction(formData: FormData): Promise<ActionResult<ReservationImportPreview>> {
  try {
    const hotelId = await requireSessionHotelId({ permission: "RESERVATIONS" });
    const rooms = await db.room.findMany({ where: { hotelId }, select: { number: true } });
    const sheetName = String(formData.get("sheetName") ?? "").trim() || undefined;
    const source = String(formData.get("source") ?? "file");
    let bytes: Buffer;
    let fileName: string;
    if (source === "google") {
      const link = String(formData.get("googleUrl") ?? "").trim();
      bytes = await fetchGoogleSheet(link);
      fileName = "Google Sheets";
    } else {
      const file = formData.get("file");
      if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return fail("Выберите файл .xlsx");
      if (!file.size || file.size > MAX_UPLOAD_BYTES) return fail("Размер загружаемого файла не должен превышать 3 МБ");
      bytes = Buffer.from(await file.arrayBuffer());
      fileName = file.name;
    }
    return ok(await parseReservationWorkbook(bytes, fileName, rooms.map(room => room.number), sheetName));
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

function validateImportRows(input: unknown): ReservationImportRow[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 100) throw new PublicError("За один раз можно импортировать от 1 до 100 броней");
  return input.map((value, index) => {
    if (!value || typeof value !== "object") throw new PublicError(`Строка ${index + 1}: некорректные данные`);
    const row = value as Partial<ReservationImportRow>;
    const guestName = String(row.guestName ?? "").trim();
    const roomNumber = String(row.roomNumber ?? "").trim();
    const checkIn = String(row.checkIn ?? "");
    const checkOut = String(row.checkOut ?? "");
    const sourceRow = Number(row.sourceRow);
    if (!guestName || guestName.length > 160) throw new PublicError(`Строка ${sourceRow || index + 1}: проверьте имя гостя`);
    if (!roomNumber || roomNumber.length > 40) throw new PublicError(`Строка ${sourceRow || index + 1}: проверьте номер комнаты`);
    if (!isISODate(checkIn) || !isISODate(checkOut) || checkOut <= checkIn || diffDays(parseISODate(checkIn), parseISODate(checkOut)) > 366) {
      throw new PublicError(`Строка ${sourceRow || index + 1}: проверьте даты проживания`);
    }
    return { sourceRow: Number.isInteger(sourceRow) && sourceRow > 0 ? sourceRow : index + 1, guestName, roomNumber, checkIn, checkOut, ...(row.guestPhone ? { guestPhone: String(row.guestPhone).trim().slice(0, 40) } : {}) };
  });
}

export async function confirmReservationImportAction(input: unknown): Promise<ActionResult<ReservationImportResult>> {
  try {
    const hotelId = await requireSessionHotelId({ permission: "RESERVATIONS" });
    const rows = validateImportRows(input);
    const { imported, errors } = await importReservationRows(hotelId, rows);
    if (errors.length) {
      await createHotelNotification({
        hotelId,
        type: "IMPORT_CONFLICT",
        title: `Импорт требует проверки: ${errors.length}`,
        body: `Импортировано ${imported} броней. Строки с конфликтами сохранены в отчёте импорта.`,
        href: "/dashboard/calendar",
        dedupeKey: `import-conflict:${crypto.randomUUID()}`,
      });
    }
    revalidateAll();
    return ok({ imported, errors }, errors.length ? `Импортировано: ${imported}. Требуют проверки: ${errors.length}.` : `Импортировано бронирований: ${imported}.`);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
