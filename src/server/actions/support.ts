"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/tenant";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { recordCurrentUserEvent } from "@/lib/analytics/service";
import { fail, ok, type ActionResult } from "@/server/types";
import { toErrorMessage } from "@/server/errors";

const supportRequestSchema = z.object({
  category: z.enum(["QUESTION", "PROBLEM", "SUGGESTION"]),
  message: z.string().trim().min(10, "Опишите вопрос хотя бы в 10 символах").max(2000, "Сообщение слишком длинное"),
  sourcePath: z.string().trim().regex(/^\/[^\s]*$/, "Некорректная страница").max(300),
});

export async function submitSupportRequestAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = supportRequestSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Проверьте сообщение");
    const user = await getCurrentUser();
    if (!user?.hotelId || !user.organizationId) return fail("Требуется вход в аккаунт");
    await enforceRateLimit("support-request", `${user.id}:${user.hotelId}`, 5, 60 * 60_000);
    const request = await db.supportRequest.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        hotelId: user.hotelId,
        category: parsed.data.category,
        message: parsed.data.message,
        sourcePath: parsed.data.sourcePath,
      },
      select: { id: true },
    });
    await recordCurrentUserEvent(
      parsed.data.category === "PROBLEM" ? "bug_reported" : "feedback_submitted",
      { type: "SupportRequest", id: request.id },
    );
    return ok(undefined, "Сообщение отправлено суперадминистратору");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

