"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/server/types";
import { toErrorMessage } from "@/server/errors";

const tourOutcomeSchema = z.enum(["completed", "skipped"]);

export async function markProductTourAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = tourOutcomeSchema.safeParse(input);
    if (!parsed.success) return fail("Некорректный результат тура");
    const user = await getCurrentUser();
    if (!user?.hotelId || !user.onboardingCompleted) return fail("Сначала завершите настройку отеля");
    const now = new Date();
    await db.productExperience.upsert({
      where: { userId_hotelId: { userId: user.id, hotelId: user.hotelId } },
      create: {
        userId: user.id,
        hotelId: user.hotelId,
        setupStep: 3,
        setupCompletedAt: now,
        tourCompletedAt: parsed.data === "completed" ? now : null,
        tourSkippedAt: parsed.data === "skipped" ? now : null,
        lastSeenAt: now,
      },
      update: {
        tourCompletedAt: parsed.data === "completed" ? now : null,
        tourSkippedAt: parsed.data === "skipped" ? now : null,
        lastSeenAt: now,
      },
    });
    revalidatePath("/dashboard", "layout");
    return ok();
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

