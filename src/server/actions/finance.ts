"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionHotelId } from "@/server/guards";
import { writeAudit } from "@/lib/reservations/service";

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
