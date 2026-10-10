"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionHotelId } from "@/server/guards";
import { writeAudit } from "@/lib/reservations/service";
import { getCurrentUser } from "@/lib/tenant";
import { toErrorMessage } from "@/server/errors";
import { fail, ok, type ActionResult } from "@/server/types";

export async function saveChannelCommissionAction(formData: FormData) {
  const hotelId = await requireSessionHotelId({ permission: "REPORTS" });
  const sourceChannel = String(formData.get("sourceChannel") ?? "").trim().toLowerCase();
  const ratePercent = Number(formData.get("ratePercent"));
  const fixedFee = Number(formData.get("fixedFee"));
  if (!/^[a-z0-9_-]{1,50}$/.test(sourceChannel) || !Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100 || !Number.isFinite(fixedFee) || fixedFee < 0) {
    throw new Error("Проверьте канал и значения комиссии.");
  }
  const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { currency: true } });
  const previous = await db.channelCommissionSetting.findUnique({ where: { hotelId_sourceChannel: { hotelId, sourceChannel } } });
  const setting = await db.channelCommissionSetting.upsert({
    where: { hotelId_sourceChannel: { hotelId, sourceChannel } },
    create: { hotelId, sourceChannel, ratePercent, fixedFee, currency: hotel.currency },
    update: { ratePercent, fixedFee, currency: hotel.currency },
  });
  await writeAudit(hotelId, "finance.channel_commission_updated", "ChannelCommissionSetting", setting.id,
    { sourceChannel }, previous ? { ratePercent: Number(previous.ratePercent), fixedFee: Number(previous.fixedFee), currency: previous.currency } : undefined,
    { ratePercent, fixedFee, currency: hotel.currency });
  revalidatePath("/dashboard/reports");
}

export async function saveIncomeTaxRateAction(formData: FormData) {
  const hotelId = await requireSessionHotelId({ permission: "REPORTS" });
  const raw = String(formData.get("incomeTaxRatePercent") ?? "").trim();
  const rate = raw === "" ? null : Number(raw);
  if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100 || Math.round(rate * 100) !== rate * 100)) {
    throw new Error("Укажите ставку от 0 до 100 с точностью до 0,01%.");
  }
  const previous = await db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { incomeTaxRatePercent: true } });
  await db.hotel.update({ where: { id: hotelId }, data: { incomeTaxRatePercent: rate } });
  await writeAudit(hotelId, "finance.income_tax_rate_updated", "Hotel", hotelId,
    {}, { ratePercent: previous.incomeTaxRatePercent === null ? null : Number(previous.incomeTaxRatePercent) }, { ratePercent: rate });
  revalidatePath("/dashboard/reports");
}

export async function createFinancialOperationAction(formData: FormData) {
  const hotelId = await requireSessionHotelId({ permission: "REPORTS" });
  const reservationId = String(formData.get("reservationId") ?? "");
  const type = String(formData.get("type") ?? "");
  const method = String(formData.get("method") ?? "");
  const amount = Number(formData.get("amount"));
  const occurredAtText = String(formData.get("occurredAt") ?? "");
  const description = String(formData.get("description") ?? "").trim().slice(0, 240);
  const occurredAt = new Date(`${occurredAtText}T12:00:00.000Z`);
  if (!reservationId || !["PAYMENT", "REFUND", "EXPENSE"].includes(type) || !["CASH", "CARD", "BANK_TRANSFER", "OTA", "VCC", "OTHER"].includes(method) || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000 || Math.round(amount * 100) !== amount * 100 || !/^\d{4}-\d{2}-\d{2}$/.test(occurredAtText) || Number.isNaN(occurredAt.getTime()) || occurredAt.toISOString().slice(0, 10) !== occurredAtText) {
    throw new Error("Проверьте сумму, дату, способ и тип операции.");
  }
  const reservation = await db.reservation.findFirst({ where: { id: reservationId, hotelId }, select: { id: true, rentalPropertyId: true, currency: true } });
  if (!reservation) throw new Error("Бронирование не найдено.");
  const organization = await db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { orgId: true } });
  const operation = await db.$transaction(async (tx) => {
    if (type === "REFUND") {
      const paid = await tx.financialOperation.aggregate({ where: { reservationId, hotelId, type: "PAYMENT", status: "COMPLETED", currency: reservation.currency }, _sum: { amount: true } });
      const refunded = await tx.financialOperation.aggregate({ where: { reservationId, hotelId, type: "REFUND", status: "COMPLETED", currency: reservation.currency }, _sum: { amount: true } });
      if (amount > Number(paid._sum.amount ?? 0) - Number(refunded._sum.amount ?? 0)) throw new Error("Возврат не может превышать записанные оплаты.");
    }
    return tx.financialOperation.create({ data: {
      organizationId: organization.orgId, hotelId, rentalPropertyId: reservation.rentalPropertyId, reservationId, amount,
      currency: reservation.currency, occurredAt, status: "COMPLETED", method, type, source: "MANUAL", description: description || null,
    } });
  }, { isolationLevel: "Serializable" });
  await writeAudit(hotelId, "finance.operation_created", "FinancialOperation", operation.id, { reservationId, type, amount, currency: reservation.currency, method, source: "MANUAL" });
  revalidatePath("/dashboard/reports");
  revalidatePath(`/dashboard/reservations/${reservationId}`);
}

export async function createExpenseAction(input: { date: string; amount: number; category: string; comment?: string; roomIds: string[] }): Promise<ActionResult> {
  try {
    const hotelId = await requireSessionHotelId({ permission: "REPORTS" });
    const user = await getCurrentUser();
    const category = String(input?.category ?? "").trim().slice(0, 40);
    const comment = String(input?.comment ?? "").trim().slice(0, 240);
    const amount = Number(input?.amount);
    const occurredAt = new Date(`${input?.date}T12:00:00.000Z`);
    if (!category) return fail("Выберите статью расходов.");
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000 || Math.round(amount * 100) !== amount * 100) return fail("Укажите сумму больше нуля, не более двух знаков после запятой.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input?.date)) || Number.isNaN(occurredAt.getTime()) || occurredAt.toISOString().slice(0, 10) !== input.date) return fail("Укажите корректную дату.");
    const requested = Array.isArray(input.roomIds) ? [...new Set(input.roomIds.map(String))].slice(0, 500) : [];
    const rooms = await db.room.findMany({ where: { hotelId, id: { in: requested } }, select: { id: true } });
    if (rooms.length !== requested.length) return fail("Одна из выбранных квартир не найдена.");
    const expense = await db.expense.create({ data: { hotelId, occurredAt, amount, category, comment: comment || null, roomIds: requested, createdById: user?.id ?? null } });
    await writeAudit(hotelId, "finance.expense_created", "Expense", expense.id, { amount, category, roomCount: requested.length });
    revalidatePath("/dashboard/reports");
    return ok(undefined, "Расход добавлен");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  try {
    const hotelId = await requireSessionHotelId({ permission: "REPORTS" });
    const expense = await db.expense.findFirst({ where: { id: String(id), hotelId }, select: { id: true, amount: true, category: true } });
    if (!expense) return fail("Расход не найден.");
    await db.expense.delete({ where: { id: expense.id } });
    await writeAudit(hotelId, "finance.expense_deleted", "Expense", expense.id, { amount: Number(expense.amount), category: expense.category });
    revalidatePath("/dashboard/reports");
    return ok(undefined, "Расход удалён");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
