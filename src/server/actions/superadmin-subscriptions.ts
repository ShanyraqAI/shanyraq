"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BILLING_PLANS } from "@/lib/billing/policy";
import { endSubscription, grantSubscription } from "@/lib/subscription/grant";
import { GRANT_MONTHS } from "@/lib/subscription/access";
import { requirePlatformAdmin } from "@/lib/superadmin/auth";
import { toErrorMessage } from "@/server/errors";
import { fail, ok, type ActionResult } from "@/server/types";

const grantSchema = z.object({
  organizationId: z.string().trim().min(1).max(100),
  planId: z.enum(BILLING_PLANS.map((plan) => plan.id) as [string, ...string[]]),
  months: z.number().refine((value) => (GRANT_MONTHS as readonly number[]).includes(value), "Выберите срок"),
  note: z.string().trim().max(500, "Заметка слишком длинная").optional(),
});

export async function grantSubscriptionAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = grantSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Проверьте данные");
    const admin = await requirePlatformAdmin();
    const { organizationId, planId, months, note } = parsed.data;

    await grantSubscription({ organizationId, planId, months, note, grantedById: admin.id });

    revalidatePath("/superadmin/subscriptions");
    return ok(undefined, "Подписка выдана");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

/** Ends the current subscription immediately (e.g. a grant issued by mistake). */
export async function endSubscriptionAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = z.object({ organizationId: z.string().trim().min(1).max(100) }).safeParse(input);
    if (!parsed.success) return fail("Проверьте данные");
    await requirePlatformAdmin();
    await endSubscription(parsed.data.organizationId);
    revalidatePath("/superadmin/subscriptions");
    return ok(undefined, "Подписка завершена");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
