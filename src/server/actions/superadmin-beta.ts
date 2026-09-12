"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { BETA_HOTEL_STATUSES, betaStatusNeedsReason, nextBetaStartedAt } from "@/lib/superadmin/beta";
import { requirePlatformAdmin } from "@/lib/superadmin/auth";
import { PublicError, toErrorMessage } from "@/server/errors";
import { fail, ok, type ActionResult } from "@/server/types";

const optionalDate = z.string().trim().max(10).optional().transform((value, context) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    context.addIssue({ code: "custom", message: "Проверьте формат даты" });
    return z.NEVER;
  }
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    context.addIssue({ code: "custom", message: "Укажите корректную дату" });
    return z.NEVER;
  }
  return date;
});

const updateBetaHotelSchema = z.object({
  hotelId: z.string().trim().min(1).max(100),
  status: z.enum(BETA_HOTEL_STATUSES),
  assignment: z.enum(["SELF", "UNASSIGNED", "UNCHANGED"]).default("UNCHANGED"),
  startedAt: optionalDate,
  lastContactAt: optionalDate,
  internalNote: z.string().trim().max(2000, "Внутренняя заметка слишком длинная").optional(),
  statusReason: z.string().trim().max(1000, "Причина слишком длинная").optional(),
}).superRefine((value, context) => {
  if (betaStatusNeedsReason(value.status) && !value.statusReason) {
    context.addIssue({ code: "custom", path: ["statusReason"], message: "Укажите причину паузы или выхода" });
  }
});

export async function updateBetaHotelAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = updateBetaHotelSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Проверьте данные");

    const admin = await requirePlatformAdmin();
    const existing = await db.betaHotelProfile.findUnique({
      where: { hotelId: parsed.data.hotelId },
      select: { assignedAdminId: true, startedAt: true },
    });
    const hotel = await db.hotel.findUnique({ where: { id: parsed.data.hotelId }, select: { id: true } });
    if (!hotel) throw new PublicError("Отель не найден");

    const assignedAdminId = parsed.data.assignment === "SELF"
      ? admin.id
      : parsed.data.assignment === "UNASSIGNED"
        ? null
        : existing?.assignedAdminId ?? null;
    const startedAt = parsed.data.status === "ACTIVE"
      ? parsed.data.startedAt ?? nextBetaStartedAt(parsed.data.status, existing?.startedAt ?? null)
      : parsed.data.startedAt;

    await db.betaHotelProfile.upsert({
      where: { hotelId: hotel.id },
      create: {
        hotelId: hotel.id,
        status: parsed.data.status,
        assignedAdminId,
        startedAt,
        lastContactAt: parsed.data.lastContactAt,
        internalNote: parsed.data.internalNote || null,
        statusReason: betaStatusNeedsReason(parsed.data.status) ? parsed.data.statusReason : null,
      },
      update: {
        status: parsed.data.status,
        assignedAdminId,
        startedAt,
        lastContactAt: parsed.data.lastContactAt,
        internalNote: parsed.data.internalNote || null,
        statusReason: betaStatusNeedsReason(parsed.data.status) ? parsed.data.statusReason : null,
      },
    });

    revalidatePath("/superadmin");
    revalidatePath(`/superadmin/hotels/${hotel.id}`);
    return ok(undefined, "Участие в бете обновлено");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
