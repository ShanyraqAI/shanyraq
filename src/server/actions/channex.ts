"use server";

import { revalidatePath } from "next/cache";
import { channexProvisioningMessage, provisionChannexStaging } from "@/lib/channels/channex/provisioning";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { requireSessionHotelId } from "@/server/guards";
import { fail, ok, type ActionResult } from "@/server/types";
import { z } from "zod";
import { wakeChannelSyncWorker } from "@/server/channel-sync";
import { channelSyncEnabled } from "@/lib/channels/runtime-policy";
import { createChannexClient } from "@/lib/channels/channex/client";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

const rentalPropertyIdSchema = z.string().trim().min(1).max(200);
const integrationPropertySchema = z.object({
  name: z.string().trim().min(2).max(120),
  propertyType: z.enum(["APARTMENT", "HOUSE", "APARTHOTEL", "GUEST_HOUSE"]),
  city: z.string().trim().min(2).max(100),
  address: z.string().trim().min(3).max(240),
  unitCount: z.coerce.number().int().min(1).max(100),
  capacity: z.coerce.number().int().min(1).max(30),
  basePrice: z.coerce.number().positive().max(100_000_000),
});

export async function createIntegrationPropertyAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = integrationPropertySchema.safeParse(input);
    if (!parsed.success) return fail("Проверьте название, адрес, количество единиц и базовую цену.");
    const hotelId = await requireSessionHotelId();
    await enforceRateLimit("integration-property-create", hotelId, 8, 60 * 60_000);
    const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { orgId: true, timezone: true, currency: true, country: true } });
    const duplicate = await db.rentalProperty.findFirst({ where: { hotelId, publicName: { equals: parsed.data.name, mode: "insensitive" }, status: { not: "ARCHIVED" } }, select: { id: true } });
    if (duplicate) return fail("Объект с таким названием уже существует.");

    const created = await db.$transaction(async (tx) => {
      const property = await tx.rentalProperty.create({
        data: {
          organizationId: hotel.orgId,
          hotelId,
          internalName: parsed.data.name,
          publicName: parsed.data.name,
          propertyType: parsed.data.propertyType,
          inventoryMode: parsed.data.unitCount === 1 ? "SINGLE_UNIT" : "GROUPED_UNITS",
          address: parsed.data.address,
          city: parsed.data.city,
          country: hotel.country ?? "Казахстан",
          timezone: hotel.timezone,
          currency: hotel.currency,
        },
      });
      const roomType = await tx.roomType.create({
        data: { hotelId, rentalPropertyId: property.id, name: `${parsed.data.name} · Основной`, capacity: parsed.data.capacity, basePrice: parsed.data.basePrice },
      });
      const prefix = parsed.data.name.replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).map((part) => part[0]).join("").toUpperCase().slice(0, 5) || "UNIT";
      const existingNumbers = new Set((await tx.room.findMany({ where: { hotelId, number: { startsWith: prefix } }, select: { number: true } })).map((room) => room.number));
      let offset = 1;
      const numbers: string[] = [];
      while (numbers.length < parsed.data.unitCount) {
        const number = `${prefix}-${offset}`;
        if (!existingNumbers.has(number)) numbers.push(number);
        offset += 1;
      }
      await tx.room.createMany({ data: numbers.map((number, index) => ({ hotelId, rentalPropertyId: property.id, roomTypeId: roomType.id, number, floor: 1, sortOrder: index })) });
      await tx.ratePlan.create({
        data: { hotelId, rentalPropertyId: property.id, roomTypeId: roomType.id, name: `${parsed.data.name} · Базовый`, basePrice: parsed.data.basePrice, currency: hotel.currency },
      });
      return property;
    });
    revalidatePath("/dashboard/channels", "layout");
    revalidatePath("/dashboard/rooms", "layout");
    return ok({ id: created.id }, "Объект создан и готов к подключению каналов.");
  } catch (error) {
    return fail(channexProvisioningMessage(error));
  }
}

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

const SELF_SERVICE_CHANNELS = ["BDC", "ABB", "OVK"] as const;

export async function createIntegrationManagerSessionAction(rentalPropertyIdInput: unknown): Promise<ActionResult<{ url: string }>> {
  try {
    if (!channelSyncEnabled()) return fail("Интеграции не включены для этого окружения.");
    const parsed = rentalPropertyIdSchema.safeParse(rentalPropertyIdInput);
    if (!parsed.success) return fail("Некорректный объект размещения.");
    const hotelId = await requireSessionHotelId();
    const user = await getSessionUser();
    if (!user) return fail("Требуется вход в аккаунт.");

    await enforceRateLimit("integration-manager", `${hotelId}:${parsed.data}`, 8, 15 * 60_000);
    let property = await db.channexProperty.findFirst({
      where: { hotelId, rentalPropertyId: parsed.data, environment: "STAGING" },
      select: { propertyId: true, provisioningStatus: true },
    });
    if (!property?.propertyId || property.provisioningStatus !== "READY") {
      await provisionChannexStaging(hotelId, parsed.data);
      property = await db.channexProperty.findFirst({
        where: { hotelId, rentalPropertyId: parsed.data, environment: "STAGING" },
        select: { propertyId: true, provisioningStatus: true },
      });
    }
    if (!property?.propertyId || property.provisioningStatus !== "READY") {
      return fail("Не удалось подготовить объект для подключения каналов.");
    }

    const client = createChannexClient({ environment: "staging" });
    const { token } = await client.createOneTimeToken({
      property_id: property.propertyId,
      username: user.fullName || "Shanyraq user",
    });
    const url = new URL("https://staging.channex.io/auth/exchange");
    url.searchParams.set("oauth_session_key", token);
    url.searchParams.set("app_mode", "headless");
    url.searchParams.set("redirect_to", "/channels");
    url.searchParams.set("property_id", property.propertyId);
    url.searchParams.set("available_channels", SELF_SERVICE_CHANNELS.join(","));
    url.searchParams.set("channels_filter", SELF_SERVICE_CHANNELS.join(","));
    url.searchParams.set("lng", "ru");
    return ok({ url: url.toString() });
  } catch (error) {
    return fail(channexProvisioningMessage(error));
  }
}
