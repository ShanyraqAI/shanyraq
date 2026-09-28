"use server";

import { revalidatePath } from "next/cache";
import { channexProvisioningMessage, provisionChannexStaging } from "@/lib/channels/channex/provisioning";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSessionHotelId } from "@/server/guards";
import { fail, ok, type ActionResult } from "@/server/types";
import { z } from "zod";
import { wakeChannelSyncWorker } from "@/server/channel-sync";
import { channelSyncEnabled } from "@/lib/channels/runtime-policy";

const rentalPropertyIdSchema = z.string().trim().min(1).max(200);

export async function provisionChannexStagingAction(rentalPropertyIdInput: unknown): Promise<ActionResult<{
  propertyId: string;
  roomTypes: number;
  ratePlans: number;
}>> {
  try {
    if (!channelSyncEnabled()) return fail("Интеграция с каналами не включена для этого окружения.");
    const parsed = rentalPropertyIdSchema.safeParse(rentalPropertyIdInput);
    if (!parsed.success) return fail("Некорректный объект размещения.");
    const hotelId = await requireSessionHotelId();
    await enforceRateLimit("channex-provision", `${hotelId}:${parsed.data}`, 5, 15 * 60_000);
    const result = await provisionChannexStaging(hotelId, parsed.data);
    wakeChannelSyncWorker();
    revalidatePath("/dashboard/channels", "layout");
    return ok(result, "Структура объекта создана в тестовой среде Channex.");
  } catch (error) {
    return fail(channexProvisioningMessage(error));
  }
}
