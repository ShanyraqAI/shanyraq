import "server-only";

import { db } from "@/lib/db";
import { writeAudit } from "@/lib/reservations/service";
import { PublicError } from "@/server/errors";
import {
  ChannexApiError,
  createChannexClient,
} from "./client";
import { buildPropertyInput, buildRatePlanInput, buildRoomTypeInput } from "./provisioning-inputs";
import { enqueueChannexSyncs } from "./sync-outbox";

const ACTIVE_RUN_MS = 5 * 60_000;

export interface ProvisioningResult {
  propertyId: string;
  roomTypes: number;
  ratePlans: number;
}

type RentalPropertyForProvisioning = Awaited<ReturnType<typeof loadRentalProperty>>;

async function loadRentalProperty(hotelId: string, rentalPropertyId: string) {
  return db.rentalProperty.findFirst({
    where: { id: rentalPropertyId, hotelId },
    include: {
      roomTypes: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { rooms: { select: { id: true } }, ratePlans: { orderBy: { name: "asc" } } },
      },
    },
  });
}

function validateInventory(rentalProperty: NonNullable<RentalPropertyForProvisioning>) {
  if (rentalProperty.roomTypes.length === 0) throw new PublicError("Сначала добавьте тип размещения и единицу размещения.");
  const ratePlanCount = rentalProperty.roomTypes.reduce((total, roomType) => total + roomType.ratePlans.length, 0);
  if (ratePlanCount === 0) throw new PublicError("Сначала добавьте хотя бы один тариф.");
}

function safeFailure(error: unknown) {
  if (error instanceof PublicError) return { code: "VALIDATION", message: error.message };
  if (error instanceof ChannexApiError) {
    const messages: Record<string, string> = {
      CONFIGURATION: "Не настроен серверный ключ тестовой среды Channex.",
      UNAUTHORIZED: "Channex отклонил серверный ключ.",
      FORBIDDEN: "Серверный ключ не имеет нужных прав в Channex.",
      VALIDATION: "Channex отклонил параметры объекта. Проверьте настройки, единицы и тарифы.",
      RATE_LIMITED: "Channex временно ограничил частоту запросов. Повторите позже.",
      UNAVAILABLE: "Тестовая среда Channex временно недоступна.",
      TIMEOUT: "Channex не ответил вовремя. Повторный запуск продолжит настройку.",
      NETWORK: "Не удалось связаться с Channex. Повторный запуск продолжит настройку.",
      NOT_FOUND: "Связанный объект Channex не найден.",
      INVALID_RESPONSE: "Channex вернул неожиданный ответ.",
    };
    return { code: error.kind, message: messages[error.kind] ?? "Не удалось настроить Channex." };
  }
  return { code: "INTERNAL", message: "Не удалось настроить Channex. Повторите попытку." };
}

function uniqueMatch<T>(items: T[], label: string): T | undefined {
  if (items.length > 1) throw new PublicError(`В Channex найдено несколько совпадений для «${label}». Обратитесь в поддержку.`);
  return items[0];
}

function webhookConfig() {
  const rawUrl = process.env.CHANNEX_WEBHOOK_URL?.trim();
  const secret = process.env.CHANNEX_WEBHOOK_SECRET?.trim();
  if (!rawUrl && !secret) return null;
  if (!rawUrl || !secret) throw new PublicError("Для webhook Channex настройте URL и секрет одновременно.");
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PublicError("CHANNEX_WEBHOOK_URL содержит некорректный URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new PublicError("Webhook Channex должен использовать публичный HTTPS URL.");
  }
  return { callbackUrl: url.toString(), secret };
}

export async function provisionChannexStaging(hotelId: string, rentalPropertyId: string): Promise<ProvisioningResult> {
  const rentalProperty = await loadRentalProperty(hotelId, rentalPropertyId);
  if (!rentalProperty) throw new PublicError("Объект размещения не найден.");
  validateInventory(rentalProperty);
  const propertyInput = buildPropertyInput(rentalProperty);

  const property = await db.channexProperty.upsert({
    where: { rentalPropertyId_environment: { rentalPropertyId, environment: "STAGING" } },
    create: { hotelId, organizationId: rentalProperty.organizationId, rentalPropertyId, environment: "STAGING" },
    update: {},
  });
  const claim = await db.channexProperty.updateMany({
    where: {
      id: property.id,
      hotelId,
      organizationId: rentalProperty.organizationId,
      rentalPropertyId,
      OR: [
        { provisioningStatus: { not: "IN_PROGRESS" } },
        { updatedAt: { lt: new Date(Date.now() - ACTIVE_RUN_MS) } },
      ],
    },
    data: { provisioningStatus: "IN_PROGRESS", provisioningStep: "PROPERTY", lastErrorCode: null, lastErrorMessage: null },
  });
  if (claim.count === 0) throw new PublicError("Настройка Channex уже выполняется. Обновите страницу через несколько минут.");

  try {
    const client = createChannexClient({ environment: "staging" });
    let propertyId = property.propertyId;
    if (!propertyId) {
      const existing = uniqueMatch(
        (await client.listProperties()).properties.filter((item) =>
          item.title === propertyInput.title
          && item.currency === propertyInput.currency
          && item.timezone === propertyInput.timezone
          && item.propertyType === propertyInput.property_type),
        propertyInput.title,
      );
      propertyId = existing?.id ?? (await client.createProperty(propertyInput)).id;
      await db.channexProperty.update({
        where: { id: property.id },
        data: { propertyId, provisioningStep: "ROOM_TYPES" },
      });
      await writeAudit(hotelId, "channex.property_provisioned", "ChannexProperty", property.id, { environment: "STAGING" });
    }

    const externalRoomTypes = await client.listRoomTypes(propertyId);
    const externalRoomTypeIds = new Map<string, string>();
    for (const roomType of rentalProperty.roomTypes) {
      const mapping = await db.channexRoomTypeMapping.upsert({
        where: { propertyRefId_roomTypeId: { propertyRefId: property.id, roomTypeId: roomType.id } },
        create: { propertyRefId: property.id, organizationId: rentalProperty.organizationId, hotelId, rentalPropertyId, roomTypeId: roomType.id },
        update: {},
      });
      try {
        let channexRoomTypeId = mapping.channexRoomTypeId;
        if (!channexRoomTypeId) {
          const existing = uniqueMatch(externalRoomTypes.filter((item) => item.title === roomType.name), roomType.name);
          const input = buildRoomTypeInput(propertyId, {
            name: roomType.name,
            description: roomType.description,
            capacity: roomType.capacity,
            roomCount: roomType.rooms.length,
          });
          channexRoomTypeId = existing?.id ?? (await client.createRoomType(input)).id;
          await db.channexRoomTypeMapping.update({
            where: { id: mapping.id },
            data: { channexRoomTypeId, provisioningStatus: "PROVISIONED", lastProvisionedAt: new Date(), lastErrorCode: null, lastErrorMessage: null },
          });
          await writeAudit(hotelId, "channex.room_type_provisioned", "RoomType", roomType.id, { environment: "STAGING" });
        }
        externalRoomTypeIds.set(roomType.id, channexRoomTypeId);
        if (mapping.provisioningStatus !== "PROVISIONED") {
          await db.channexRoomTypeMapping.update({
            where: { id: mapping.id },
            data: { provisioningStatus: "PROVISIONED", lastProvisionedAt: new Date(), lastErrorCode: null, lastErrorMessage: null },
          });
        }
      } catch (error) {
        const failure = safeFailure(error);
        await db.channexRoomTypeMapping.update({ where: { id: mapping.id }, data: { provisioningStatus: "FAILED", lastErrorCode: failure.code, lastErrorMessage: failure.message } });
        throw error;
      }
    }

    await db.channexProperty.update({ where: { id: property.id }, data: { provisioningStep: "RATE_PLANS" } });
    const externalRatePlans = await client.listRatePlans(propertyId);
    let ratePlanCount = 0;
    for (const roomType of rentalProperty.roomTypes) {
      const channexRoomTypeId = externalRoomTypeIds.get(roomType.id);
      if (!channexRoomTypeId) throw new PublicError("Не удалось определить тип размещения Channex.");
      for (const ratePlan of roomType.ratePlans) {
        ratePlanCount++;
        const mapping = await db.channexRatePlanMapping.upsert({
          where: { propertyRefId_ratePlanId: { propertyRefId: property.id, ratePlanId: ratePlan.id } },
          create: { propertyRefId: property.id, organizationId: rentalProperty.organizationId, hotelId, rentalPropertyId, ratePlanId: ratePlan.id },
          update: {},
        });
        try {
          if (mapping.channexRatePlanId) {
            if (mapping.provisioningStatus !== "PROVISIONED") {
              await db.channexRatePlanMapping.update({
                where: { id: mapping.id },
                data: { provisioningStatus: "PROVISIONED", lastProvisionedAt: new Date(), lastErrorCode: null, lastErrorMessage: null },
              });
            }
            continue;
          }
          const existing = uniqueMatch(
            externalRatePlans.filter((item) => item.title === ratePlan.name && item.roomTypeId === channexRoomTypeId),
            ratePlan.name,
          );
          const input = buildRatePlanInput(propertyId, channexRoomTypeId, {
            name: ratePlan.name,
            currency: ratePlan.currency,
            basePrice: ratePlan.basePrice,
            breakfastIncluded: ratePlan.breakfastIncluded,
            occupancy: roomType.capacity,
          });
          const channexRatePlanId = existing?.id ?? (await client.createRatePlan(input)).id;
          await db.channexRatePlanMapping.update({
            where: { id: mapping.id },
            data: { channexRatePlanId, provisioningStatus: "PROVISIONED", lastProvisionedAt: new Date(), lastErrorCode: null, lastErrorMessage: null },
          });
          await writeAudit(hotelId, "channex.rate_plan_provisioned", "RatePlan", ratePlan.id, { environment: "STAGING" });
        } catch (error) {
          const failure = safeFailure(error);
          await db.channexRatePlanMapping.update({ where: { id: mapping.id }, data: { provisioningStatus: "FAILED", lastErrorCode: failure.code, lastErrorMessage: failure.message } });
          throw error;
        }
      }
    }

    const webhook = webhookConfig();
    let webhookId = property.webhookId;
    if (webhook) {
      await db.channexProperty.update({ where: { id: property.id }, data: { provisioningStep: "WEBHOOK" } });
      if (!webhookId) {
        const existing = uniqueMatch(
          (await client.listWebhooks(propertyId)).filter((item) => item.callbackUrl === webhook.callbackUrl && item.eventMask === "booking"),
          "webhook бронирований",
        );
        webhookId = existing?.id ?? (await client.createWebhook({
          property_id: propertyId,
          callback_url: webhook.callbackUrl,
          event_mask: "booking",
          headers: { "x-shanyraq-webhook-secret": webhook.secret },
          is_active: true,
          send_data: true,
        })).id;
      }
    }

    await db.channexProperty.update({
      where: { id: property.id },
      data: { provisioningStatus: "READY", provisioningStep: "COMPLETE", webhookId, lastProvisionedAt: new Date(), lastErrorCode: null, lastErrorMessage: null },
    });
    await db.$transaction((tx) => enqueueChannexSyncs(tx, hotelId, { rentalPropertyId, full: true }));
    return { propertyId, roomTypes: rentalProperty.roomTypes.length, ratePlans: ratePlanCount };
  } catch (error) {
    const failure = safeFailure(error);
    await db.channexProperty.update({
      where: { id: property.id },
      data: { provisioningStatus: "FAILED", lastErrorCode: failure.code, lastErrorMessage: failure.message },
    }).catch(() => undefined);
    if (!(error instanceof PublicError) && !(error instanceof ChannexApiError)) {
      console.error("Channex provisioning failed", { incidentId: crypto.randomUUID(), hotelId, rentalPropertyId, step: property.provisioningStep ?? "PROPERTY" });
    }
    throw error;
  }
}

export function channexProvisioningMessage(error: unknown) {
  return safeFailure(error).message;
}
