"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/tenant";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { recordCurrentUserEvent } from "@/lib/analytics/service";
import { fail, ok, type ActionResult } from "@/server/types";
import { toErrorMessage } from "@/server/errors";
import { buildFeedbackTechnicalContext } from "@/lib/support/feedback";

const supportRequestSchema = z.object({
  category: z.enum(["QUESTION", "PROBLEM", "SUGGESTION"]),
  message: z.string().trim().min(10, "Опишите вопрос хотя бы в 10 символах").max(2000, "Сообщение слишком длинное"),
  sourcePath: z.string().trim().regex(/^\/[^\s]*$/, "Некорректная страница").max(300),
});

const contextualFeedbackSchema = z.object({
  category: z.enum(["PROBLEM", "CONFUSING", "SUGGESTION"]),
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().max(2000, "Комментарий слишком длинный").default(""),
  sourcePath: z.string().trim().regex(/^\/[^\s]*$/, "Некорректная страница").max(300),
  trigger: z.literal("FIRST_RESERVATION"),
}).refine((value) => !value.message || value.message.length >= 3, {
  message: "Комментарий должен содержать хотя бы 3 символа",
  path: ["message"],
});

const dismissFeedbackSchema = z.object({ trigger: z.literal("FIRST_RESERVATION") });

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

export async function submitContextualFeedbackAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = contextualFeedbackSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Проверьте оценку");
    const user = await getCurrentUser();
    if (!user?.hotelId || !user.organizationId) return fail("Требуется вход в аккаунт");
    await enforceRateLimit("contextual-feedback", `${user.id}:${user.hotelId}`, 5, 24 * 60 * 60_000);

    const technicalContextJson = buildFeedbackTechnicalContext({
      trigger: parsed.data.trigger,
      sourcePath: parsed.data.sourcePath,
      appVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
    });

    const request = await db.$transaction(async (tx) => {
      const feedback = await tx.supportRequest.create({
        data: {
          userId: user.id,
          organizationId: user.organizationId,
          hotelId: user.hotelId,
          category: parsed.data.category,
          message: parsed.data.message || `Оценка первого бронирования: ${parsed.data.rating}/5`,
          sourcePath: parsed.data.sourcePath,
          rating: parsed.data.rating,
          feedbackTrigger: parsed.data.trigger,
          technicalContextJson,
        },
        select: { id: true },
      });
      await tx.productExperience.upsert({
        where: { userId_hotelId: { userId: user.id, hotelId: user.hotelId! } },
        create: { userId: user.id, hotelId: user.hotelId!, feedbackSubmittedAt: new Date() },
        update: { feedbackSubmittedAt: new Date() },
      });
      return feedback;
    });

    await recordCurrentUserEvent(
      parsed.data.category === "PROBLEM" ? "bug_reported" : "feedback_submitted",
      { type: "SupportRequest", id: request.id },
      { source: parsed.data.trigger, status: String(parsed.data.rating) },
    );
    return ok(undefined, "Спасибо — оценка поможет улучшить Shanyraq");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function dismissContextualFeedbackAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = dismissFeedbackSchema.safeParse(input);
    if (!parsed.success) return fail("Некорректный опрос");
    const user = await getCurrentUser();
    if (!user?.hotelId) return fail("Требуется вход в аккаунт");
    await db.productExperience.upsert({
      where: { userId_hotelId: { userId: user.id, hotelId: user.hotelId } },
      create: { userId: user.id, hotelId: user.hotelId, feedbackDismissedAt: new Date() },
      update: { feedbackDismissedAt: new Date() },
    });
    return ok();
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
