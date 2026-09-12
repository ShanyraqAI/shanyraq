"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/superadmin/auth";
import { SUPPORT_REQUEST_STATUSES, supportResolutionDate } from "@/lib/support/workflow";
import { toErrorMessage } from "@/server/errors";
import { fail, ok, type ActionResult } from "@/server/types";

const updateSupportRequestSchema = z.object({
  requestId: z.string().trim().min(1).max(100),
  status: z.enum(SUPPORT_REQUEST_STATUSES).optional(),
  assignment: z.enum(["SELF", "UNASSIGNED", "UNCHANGED"]).default("UNCHANGED"),
  note: z.string().trim().max(2000, "Внутренняя заметка слишком длинная").optional(),
}).refine((value) => value.status || value.assignment !== "UNCHANGED" || value.note, {
  message: "Выберите действие или добавьте заметку",
});

export async function updateSupportRequestAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = updateSupportRequestSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Проверьте данные");

    const admin = await requirePlatformAdmin();
    const now = new Date();

    await db.$transaction(async (tx) => {
      const request = await tx.supportRequest.findUnique({
        where: { id: parsed.data.requestId },
        select: { id: true, status: true, assignedToId: true },
      });
      if (!request) throw new Error("Support request not found");

      const nextStatus = parsed.data.status ?? request.status;
      const nextAssignee = parsed.data.assignment === "SELF"
        ? admin.id
        : parsed.data.assignment === "UNASSIGNED"
          ? null
          : request.assignedToId;

      await tx.supportRequest.update({
        where: { id: request.id },
        data: {
          status: nextStatus,
          assignedToId: nextAssignee,
          resolvedAt: nextStatus === request.status
            ? undefined
            : supportResolutionDate(nextStatus as (typeof SUPPORT_REQUEST_STATUSES)[number], now),
        },
      });

      const activities = [];
      if (nextStatus !== request.status) {
        activities.push({
          requestId: request.id,
          actorUserId: admin.id,
          type: "STATUS_CHANGE",
          fromStatus: request.status,
          toStatus: nextStatus,
        });
      }
      if (nextAssignee !== request.assignedToId) {
        activities.push({
          requestId: request.id,
          actorUserId: admin.id,
          type: "ASSIGNMENT",
          note: nextAssignee ? "Обращение назначено на администратора" : "Ответственный снят",
        });
      }
      if (parsed.data.note) {
        activities.push({
          requestId: request.id,
          actorUserId: admin.id,
          type: "NOTE",
          note: parsed.data.note,
        });
      }
      if (activities.length > 0) await tx.supportRequestActivity.createMany({ data: activities });
    });

    revalidatePath("/superadmin");
    return ok(undefined, "Обращение обновлено");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
