import "server-only";

import type { Prisma } from "@prisma/client";
import { addDays, todayInTimeZone } from "@/lib/dates";
import { db } from "@/lib/db";
import { CHANNEX_FULL_SYNC_DAYS } from "./ari";

type QueueDb = typeof db | Prisma.TransactionClient;

export interface ChannexSyncScope {
  rentalPropertyId?: string;
  roomTypeIds?: string[];
  ratePlanIds?: string[];
  from?: Date;
  to?: Date;
  availability?: boolean;
  restrictions?: boolean;
  full?: boolean;
}

// Domain transactions already collapse their own changes into one property job.
// Keep the first attempt immediately claimable by the post-response worker.
const COALESCE_MS = 0;

function stringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function union(left: string[], right: string[]) {
  return [...new Set([...left, ...right])];
}

export async function enqueueChannexSyncs(
  client: QueueDb,
  hotelId: string,
  scope: ChannexSyncScope = {},
): Promise<number> {
  const properties = await client.channexProperty.findMany({
    where: {
      hotelId,
      environment: "STAGING",
      provisioningStatus: "READY",
      propertyId: { not: null },
      ...(scope.rentalPropertyId ? { rentalPropertyId: scope.rentalPropertyId } : {}),
    },
    include: { rentalProperty: { select: { timezone: true } } },
  });

  for (const property of properties) {
    await client.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`channex-sync:${property.id}`}, 0))`;
    const businessToday = todayInTimeZone(property.rentalProperty.timezone);
    const from = scope.from ?? businessToday;
    const to = scope.to ?? addDays(from, CHANNEX_FULL_SYNC_DAYS - 1);
    const deduplicationKey = `channex:${property.id}`;
    const existing = await client.channexSyncJob.findUnique({ where: { deduplicationKey } });
    const roomTypeIds = scope.full ? [] : scope.roomTypeIds ?? [];
    const ratePlanIds = scope.full ? [] : scope.ratePlanIds ?? [];
    const availabilityRequested = scope.availability ?? true;
    const restrictionsRequested = scope.restrictions ?? true;
    const fullSyncRequested = scope.full ?? (!scope.roomTypeIds?.length && !scope.ratePlanIds?.length && !scope.from && !scope.to);
    const availableAt = new Date(Date.now() + COALESCE_MS);

    if (!existing) {
      await client.channexSyncJob.create({
        data: {
          propertyRefId: property.id,
          organizationId: property.organizationId,
          hotelId: property.hotelId,
          rentalPropertyId: property.rentalPropertyId,
          deduplicationKey,
          availabilityRequested,
          restrictionsRequested,
          fullSyncRequested,
          roomTypeIds,
          ratePlanIds,
          dateFrom: from,
          dateTo: to,
          availableAt,
        },
      });
    } else {
      await client.channexSyncJob.update({
        where: { id: existing.id },
        data: {
          status: existing.status === "RUNNING" ? "RUNNING" : "PENDING",
          attempts: existing.status === "FAILED" ? 0 : existing.attempts,
          availabilityRequested: existing.availabilityRequested || availabilityRequested,
          restrictionsRequested: existing.restrictionsRequested || restrictionsRequested,
          fullSyncRequested: existing.fullSyncRequested || fullSyncRequested,
          roomTypeIds: existing.fullSyncRequested || fullSyncRequested ? [] : union(stringArray(existing.roomTypeIds), roomTypeIds),
          ratePlanIds: existing.fullSyncRequested || fullSyncRequested ? [] : union(stringArray(existing.ratePlanIds), ratePlanIds),
          dateFrom: existing.dateFrom < from ? existing.dateFrom : from,
          dateTo: existing.dateTo > to ? existing.dateTo : to,
          availableAt: existing.status === "RUNNING" ? existing.availableAt : availableAt,
          rerunRequested: existing.status === "RUNNING" || existing.rerunRequested,
          finishedAt: null,
        },
      });
    }
    await client.channexProperty.update({ where: { id: property.id }, data: { lastSyncStatus: "QUEUED" } });
  }
  return properties.length;
}

export async function enqueueDueChannexFullSyncs(now = new Date()): Promise<number> {
  const due = await db.channexProperty.findMany({
    where: {
      environment: "STAGING",
      provisioningStatus: "READY",
      propertyId: { not: null },
      OR: [{ lastFullSyncAt: null }, { lastFullSyncAt: { lt: new Date(now.getTime() - 20 * 60 * 60 * 1000) } }],
    },
    select: { hotelId: true, rentalPropertyId: true },
  });
  let queued = 0;
  for (const property of due) {
    queued += await db.$transaction((tx) => enqueueChannexSyncs(tx, property.hotelId, {
      rentalPropertyId: property.rentalPropertyId,
      full: true,
    }));
  }
  return queued;
}
