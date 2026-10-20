"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionHotelId } from "@/server/guards";
import { writeAudit } from "@/lib/reservations/service";
import { getCurrentUser } from "@/lib/tenant";
import { toErrorMessage, PublicError } from "@/server/errors";
import { fail, ok, type ActionResult } from "@/server/types";
import { executeOperation } from "@/lib/reservations/operation";
import { minorUnits } from "@/lib/security/money";

function requiredKey(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new PublicError("Обновите форму перед сохранением: отсутствует ключ операции.");
  }
  return value;
}
function businessDate(value: string): Date {
  const date = new Date(`${value}T12:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new PublicError("Укажите корректную дату.");
  }
  return date;
}

export async function saveChannelCommissionAction(formData: FormData) {
  const hotelId = await requireSessionHotelId({ permission: "REPORTS" });
  const sourceChannel = String(formData.get("sourceChannel") ?? "").trim().toLowerCase();
  const rate = minorUnits(String(formData.get("ratePercent") ?? "").trim() || "0");
  const fee = minorUnits(String(formData.get("fixedFee") ?? "").trim() || "0");
  if (!/^[a-z0-9_-]{1,50}$/.test(sourceChannel) || rate === null || rate > 10_000 || fee === null || fee > 99_999_999_999_999) {
    throw new PublicError("Проверьте канал и значения комиссии.");
  }
  const ratePercent = rate / 100;
  const fixedFee = fee / 100;
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Hotel" WHERE "id"=${hotelId} FOR UPDATE`;
    const hotel = await tx.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { currency: true } });
    const previous = await tx.channelCommissionSetting.findUnique({ where: { hotelId_sourceChannel: { hotelId, sourceChannel } } });
    const setting = await tx.channelCommissionSetting.upsert({
      where: { hotelId_sourceChannel: { hotelId, sourceChannel } },
      create: { hotelId, sourceChannel, ratePercent, fixedFee, currency: hotel.currency },
      update: { ratePercent, fixedFee, currency: hotel.currency },
    });
    await writeAudit(hotelId, "finance.channel_commission_updated", "ChannelCommissionSetting", setting.id,
      { sourceChannel }, previous ? { ratePercent: Number(previous.ratePercent), fixedFee: Number(previous.fixedFee), currency: previous.currency } : undefined,
      { ratePercent, fixedFee, currency: hotel.currency }, tx);
  });
  revalidatePath("/dashboard/reports");
}

export async function saveIncomeTaxRateAction(formData: FormData) {
  const hotelId = await requireSessionHotelId({ permission: "REPORTS" });
  const raw = String(formData.get("incomeTaxRatePercent") ?? "").trim();
  const units = raw === "" ? 0 : minorUnits(raw);
  if (units === null || units > 10_000) throw new PublicError("Укажите ставку от 0 до 100 с точностью до 0,01%.");
  const rate = raw === "" ? null : units / 100;
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Hotel" WHERE "id"=${hotelId} FOR UPDATE`;
    const previous = await tx.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { incomeTaxRatePercent: true } });
    await tx.hotel.update({ where: { id: hotelId }, data: { incomeTaxRatePercent: rate } });
    await writeAudit(hotelId, "finance.income_tax_rate_updated", "Hotel", hotelId,
      {}, { ratePercent: previous.incomeTaxRatePercent === null ? null : Number(previous.incomeTaxRatePercent) }, { ratePercent: rate }, tx);
  });
  revalidatePath("/dashboard/reports");
}

export async function createFinancialOperationAction(formData: FormData) {
  const hotelId = await requireSessionHotelId({ permission: "REPORTS" });
  const user = await getCurrentUser();
  if (!user || user.hotelId !== hotelId) throw new PublicError("Рабочий контекст изменился. Обновите страницу.");
  const key = requiredKey(formData.get("operationKey"));
  const reservationId = String(formData.get("reservationId") ?? "");
  const type = String(formData.get("type") ?? "");
  const method = String(formData.get("method") ?? "");
  const units = minorUnits(formData.get("amount"));
  const date = String(formData.get("occurredAt") ?? "");
  const occurredAt = businessDate(date);
  const description = String(formData.get("description") ?? "").trim().slice(0, 240);
  if (!reservationId || !["PAYMENT", "REFUND", "EXPENSE"].includes(type) || !["CASH", "CARD", "BANK_TRANSFER", "OTA", "VCC", "OTHER"].includes(method) || units === null || units <= 0 || units > 99_999_999_999_999) {
    throw new PublicError("Проверьте сумму, способ и тип операции.");
  }
  const amount = units / 100;
  const result = await executeOperation(db, { userId: user.id, hotelId }, { key, scope: `${user.id}:${hotelId}` },
    "finance.operation.create", { reservationId, type, method, units, date, description }, async (tx) => {
      // All manual ledger writes for a booking serialize with refund balance checks.
      await tx.$queryRaw`SELECT "id" FROM "Reservation" WHERE "id"=${reservationId} AND "hotelId"=${hotelId} FOR UPDATE`;
      const reservation = await tx.reservation.findFirst({ where: { id: reservationId, hotelId }, select: { id: true, rentalPropertyId: true, currency: true } });
      if (!reservation) throw new PublicError("Бронирование не найдено.");
      const organization = await tx.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { orgId: true } });
      if (!organization.orgId) throw new PublicError("Организация не найдена.");
      if (type === "REFUND") {
        const paid = await tx.financialOperation.aggregate({ where: { reservationId, hotelId, type: "PAYMENT", status: "COMPLETED", currency: reservation.currency }, _sum: { amount: true } });
        const refunded = await tx.financialOperation.aggregate({ where: { reservationId, hotelId, type: "REFUND", status: "COMPLETED", currency: reservation.currency }, _sum: { amount: true } });
        // Aggregates remain Decimal until the final minor-unit comparison.
        const remaining = paid._sum.amount?.minus(refunded._sum.amount ?? 0);
        if (!remaining || remaining.lessThan(amount)) throw new PublicError("Возврат не может превышать записанные оплаты.");
      }
      const operation = await tx.financialOperation.create({ data: {
        organizationId: organization.orgId, hotelId, rentalPropertyId: reservation.rentalPropertyId, reservationId, amount,
        currency: reservation.currency, occurredAt, status: "COMPLETED", method, type, source: "MANUAL", description: description || null,
      } });
      await writeAudit(hotelId, "finance.operation_created", "FinancialOperation", operation.id,
        { reservationId, type, amount, currency: reservation.currency, method, source: "MANUAL" }, undefined, undefined, tx);
      return ok(undefined);
    });
  if (!result.ok) throw new PublicError(result.error ?? "Не удалось сохранить операцию.");
  revalidatePath("/dashboard/reports");
  revalidatePath(`/dashboard/reservations/${reservationId}`);
}

export async function createExpenseAction(input: { key?: string; date: string; amount: number | string; category: string; comment?: string; roomIds: string[] }): Promise<ActionResult> {
  try {
    const hotelId = await requireSessionHotelId({ permission: "REPORTS" });
    const user = await getCurrentUser();
    if (!user || user.hotelId !== hotelId) throw new PublicError("Рабочий контекст изменился. Обновите страницу.");
    const key = requiredKey(input?.key);
    const category = String(input?.category ?? "").trim().slice(0, 40);
    const comment = String(input?.comment ?? "").trim().slice(0, 240);
    const units = minorUnits(input?.amount);
    const occurredAt = businessDate(input?.date);
    if (!category) return fail("Выберите статью расходов.");
    if (units === null || units <= 0 || units > 100_000_000_000) return fail("Укажите сумму больше нуля, не более двух знаков после запятой.");
    const amount = units / 100;
    if (!Array.isArray(input.roomIds) || input.roomIds.length > 500) return fail("Некорректный список квартир.");
    const requested = [...new Set(input.roomIds.map(String))].sort();
    const result = await executeOperation(db, { userId: user.id, hotelId }, { key, scope: `${user.id}:${hotelId}` },
      "finance.expense.create", { date: input.date, units, category, comment, roomIds: requested }, async (tx) => {
        const rooms = await tx.room.findMany({ where: { hotelId, id: { in: requested } }, select: { id: true } });
        if (rooms.length !== requested.length) return fail("Одна из выбранных квартир не найдена.");
        const expense = await tx.expense.create({ data: { hotelId, occurredAt, amount, category, comment: comment || null, roomIds: requested, createdById: user.id } });
        await writeAudit(hotelId, "finance.expense_created", "Expense", expense.id, { amount, category, roomCount: requested.length }, undefined, undefined, tx);
        return ok(undefined, "Расход добавлен");
      });
    if (result.ok) revalidatePath("/dashboard/reports");
    return result;
  } catch (error) { return fail(toErrorMessage(error)); }
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  try {
    const hotelId = await requireSessionHotelId({ permission: "REPORTS" });
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Expense" WHERE "id"=${String(id)} AND "hotelId"=${hotelId} FOR UPDATE`;
      const expense = await tx.expense.findFirst({ where: { id: String(id), hotelId }, select: { id: true, amount: true, category: true } });
      if (!expense) return; // Safe retry after a lost success response.
      await tx.expense.delete({ where: { id: expense.id } });
      await writeAudit(hotelId, "finance.expense_deleted", "Expense", expense.id, { amount: Number(expense.amount), category: expense.category }, undefined, undefined, tx);
    });
    revalidatePath("/dashboard/reports");
    return ok(undefined, "Расход удалён");
  } catch (error) { return fail(toErrorMessage(error)); }
}
