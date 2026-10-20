import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ChannexApiError, createChannexClient } from "./client";
import { buildChannexAri } from "./ari";

interface ClaimedJob {
  id: string;
  propertyRefId: string;
  attempts: number;
  maxAttempts: number;
  availabilityRequested: boolean;
  restrictionsRequested: boolean;
  fullSyncRequested: boolean;
  roomTypeIds: Prisma.JsonValue;
  ratePlanIds: Prisma.JsonValue;
  dateFrom: Date;
  dateTo: Date;
}

export interface ChannexSyncRun {
  claimed: number;
  succeeded: number;
  retried: number;
  failed: number;
  superseded: number;
}

function stringArray(value: Prisma.JsonValue) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function claim(workerId: string): Promise<ClaimedJob | null> {
  const rows = await db.$queryRaw<ClaimedJob[]>`
    UPDATE "ChannexSyncJob"
    SET "status" = 'RUNNING',
        "attempts" = "attempts" + 1,
        "lockedAt" = CURRENT_TIMESTAMP,
        "lockedBy" = ${workerId},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = (
      SELECT "id" FROM "ChannexSyncJob"
      WHERE ("status" = 'PENDING' AND "availableAt" <= CURRENT_TIMESTAMP)
         OR ("status" = 'RUNNING' AND "lockedAt" < CURRENT_TIMESTAMP - INTERVAL '10 minutes')
      ORDER BY "availableAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING "id", "propertyRefId", "attempts", "maxAttempts",
      "availabilityRequested", "restrictionsRequested", "fullSyncRequested",
      "roomTypeIds", "ratePlanIds", "dateFrom", "dateTo"
  `;
  if (!rows[0]) return null;
  await db.channexProperty.updateMany({ where: { id: rows[0].propertyRefId }, data: { lastSyncStatus: "RUNNING" } });
  return rows[0];
}

function safeFailure(error: unknown) {
  if (error instanceof ChannexApiError) {
    return { code: error.kind, message: error.message, retryable: error.retryable };
  }
  return { code: "SYNC_FAILED", message: "Не удалось синхронизировать данные с Channex.", retryable: true };
}

async function run(job: ClaimedJob) {
  const property = await db.channexProperty.findUnique({
    where: { id: job.propertyRefId },
    select: { id: true, environment: true, propertyId: true },
  });
  if (!property?.propertyId || property.environment !== "STAGING") {
    throw new ChannexApiError("Объект Channex не готов к синхронизации.", "CONFIGURATION");
  }
  const ari = await buildChannexAri({
    propertyRefId: property.id,
    from: job.dateFrom,
    to: job.dateTo,
    roomTypeIds: job.fullSyncRequested ? undefined : stringArray(job.roomTypeIds),
    ratePlanIds: job.fullSyncRequested ? undefined : stringArray(job.ratePlanIds),
  });
  const client = createChannexClient({ environment: "staging" });
  const taskIds: string[] = [];
  if (job.availabilityRequested) taskIds.push(...(await client.pushAvailability(ari.availability)).taskIds);
  if (job.restrictionsRequested) taskIds.push(...(await client.pushRestrictions(ari.restrictions)).taskIds);
  return taskIds;
}

async function succeed(job: ClaimedJob, taskIds: string[], workerId: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`channex-sync:${job.propertyRefId}`}, 0))::text`;
    await tx.$queryRaw`SELECT "id" FROM "ChannexSyncJob" WHERE "id"=${job.id} FOR UPDATE`;
    const current = await tx.channexSyncJob.findUniqueOrThrow({ where: { id: job.id }, select: { rerunRequested: true, status: true, lockedBy: true } });
    if (current.status !== "RUNNING" || current.lockedBy !== workerId) return "superseded" as const;
    const failedRevisions = await tx.channexBookingRevision.count({
      where: { propertyRefId: job.propertyRefId, processingStatus: "FAILED", acknowledgedAt: null },
  });
  const now = new Date();
  if (current.rerunRequested) {
    await Promise.all([
      tx.channexSyncJob.update({
        where: { id: job.id },
        data: {
          status: "PENDING", attempts: 0, rerunRequested: false,
          availableAt: now, lockedAt: null, lockedBy: null,
          lastTaskIds: taskIds, lastErrorCode: null, lastErrorMessage: null,
        },
      }),
      tx.channexProperty.update({ where: { id: job.propertyRefId }, data: { lastSyncStatus: "QUEUED", lastSyncAt: now } }),
    ]);
    return "retried" as const;
  }
  await Promise.all([
    tx.channexSyncJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCEEDED", deduplicationKey: null, finishedAt: now,
        lockedAt: null, lockedBy: null, lastTaskIds: taskIds,
        lastErrorCode: null, lastErrorMessage: null,
      },
    }),
    tx.channexProperty.update({
      where: { id: job.propertyRefId },
      data: {
        lastSyncStatus: "SUCCESS", lastSyncAt: now,
        ...(job.fullSyncRequested ? { lastFullSyncAt: now } : {}),
        ...(failedRevisions === 0 ? { lastErrorCode: null, lastErrorMessage: null } : {}),
      },
    }),
  ]);
  return "succeeded" as const;
  });
}

async function fail(job: ClaimedJob, error: unknown, workerId: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`channex-sync:${job.propertyRefId}`}, 0))::text`;
    await tx.$queryRaw`SELECT "id" FROM "ChannexSyncJob" WHERE "id"=${job.id} FOR UPDATE`;
    const failure = safeFailure(error);
    const current = await tx.channexSyncJob.findUniqueOrThrow({ where: { id: job.id }, select: { rerunRequested: true, status: true, lockedBy: true } });
    if (current.status !== "RUNNING" || current.lockedBy !== workerId) return "superseded" as const;
    if (current.rerunRequested) {
      await Promise.all([
        tx.channexSyncJob.update({
          where: { id: job.id },
          data: {
            status: "PENDING", attempts: 0, rerunRequested: false,
            availableAt: new Date(Date.now() + 60_000), lockedAt: null, lockedBy: null,
            lastErrorCode: failure.code, lastErrorMessage: failure.message,
          },
        }),
        tx.channexProperty.update({
          where: { id: job.propertyRefId },
          data: { lastSyncStatus: "QUEUED", lastErrorCode: failure.code, lastErrorMessage: failure.message },
        }),
      ]);
      return "retried" as const;
    }
    const retry = failure.retryable && job.attempts < job.maxAttempts;
    if (retry) {
      const delay = Math.min(60_000 * 2 ** Math.max(0, job.attempts - 1), 30 * 60_000);
      await Promise.all([
        tx.channexSyncJob.update({
          where: { id: job.id },
          data: {
            status: "PENDING", availableAt: new Date(Date.now() + delay),
            lockedAt: null, lockedBy: null, lastErrorCode: failure.code, lastErrorMessage: failure.message,
          },
        }),
        tx.channexProperty.update({
          where: { id: job.propertyRefId },
          data: { lastSyncStatus: "QUEUED", lastErrorCode: failure.code, lastErrorMessage: failure.message },
        }),
      ]);
      return "retried" as const;
    }
    await Promise.all([
      tx.channexSyncJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED", deduplicationKey: null, finishedAt: new Date(),
          lockedAt: null, lockedBy: null, lastErrorCode: failure.code, lastErrorMessage: failure.message,
        },
      }),
      tx.channexProperty.update({
        where: { id: job.propertyRefId },
        data: { lastSyncStatus: "FAILED", lastErrorCode: failure.code, lastErrorMessage: failure.message },
      }),
    ]);
    return "failed" as const;
  });
}

export async function processChannexSyncJobs(limit = 10): Promise<ChannexSyncRun> {
  const result: ChannexSyncRun = { claimed: 0, succeeded: 0, retried: 0, failed: 0, superseded: 0 };
  const workerId = crypto.randomUUID();
  for (let index = 0; index < Math.max(1, Math.min(limit, 20)); index++) {
    const job = await claim(workerId);
    if (!job) break;
    result.claimed++;
    try {
      const outcome = await succeed(job, await run(job), workerId);
      result[outcome]++;
    } catch (error) {
      const incidentId = crypto.randomUUID();
      console.error("Channex ARI sync failed", { incidentId, jobId: job.id, propertyRefId: job.propertyRefId });
      const outcome = await fail(job, error, workerId);
      result[outcome]++;
    }
  }
  return result;
}
