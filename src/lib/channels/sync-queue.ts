import { db } from "@/lib/db";
import { syncFailureMessage } from "./sync-errors";
import { runChannelSync } from "./sync-service";
import {
  channelSyncBatchSize,
  channelSyncRetryDelayMs,
} from "./queue-policy";
import { channelSyncEnabled } from "./runtime-policy";

interface ClaimedSyncJob {
  id: string;
  hotelId: string;
  connectionId: string;
  attempts: number;
  maxAttempts: number;
}

export interface SyncQueueRun {
  claimed: number;
  succeeded: number;
  retried: number;
  failed: number;
}

/**
 * Claim due work with PostgreSQL SKIP LOCKED so multiple serverless workers
 * cannot run the same job. A ten-minute lease makes crashed work recoverable.
 */
async function claimNextChannelSyncJob(workerId: string): Promise<ClaimedSyncJob | null> {
  const rows = await db.$queryRaw<ClaimedSyncJob[]>`
    UPDATE "ChannelSyncJob"
    SET
      "status" = 'RUNNING',
      "attempts" = "attempts" + 1,
      "rerunRequested" = FALSE,
      "lockedAt" = CURRENT_TIMESTAMP,
      "lockedBy" = ${workerId},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = (
      SELECT "id"
      FROM "ChannelSyncJob"
      WHERE
        ("status" = 'PENDING' AND "availableAt" <= CURRENT_TIMESTAMP)
        OR
        ("status" = 'RUNNING' AND "lockedAt" < CURRENT_TIMESTAMP - INTERVAL '10 minutes')
      ORDER BY "availableAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING "id", "hotelId", "connectionId", "attempts", "maxAttempts"
  `;
  return rows[0] ?? null;
}

async function completeSyncJob(jobId: string): Promise<"succeeded" | "retried"> {
  const completed = await db.channelSyncJob.updateMany({
    where: { id: jobId, status: "RUNNING", rerunRequested: false },
    data: {
      status: "SUCCEEDED",
      deduplicationKey: null,
      lockedAt: null,
      lockedBy: null,
      finishedAt: new Date(),
      lastError: null,
    },
  });
  if (completed.count === 1) return "succeeded";

  // New domain data arrived after this worker claimed the job. Keep the same
  // deduplication key and immediately run once more instead of losing it.
  await db.channelSyncJob.update({
    where: { id: jobId },
    data: {
      status: "PENDING",
      attempts: 0,
      rerunRequested: false,
      availableAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      finishedAt: null,
      lastError: null,
    },
  });
  return "retried";
}

async function failOrRetrySyncJob(job: ClaimedSyncJob, safeError: string): Promise<"retried" | "failed"> {
  if (job.attempts < job.maxAttempts) {
    const availableAt = new Date(Date.now() + channelSyncRetryDelayMs(job.attempts));
    await db.$transaction([
      db.channelSyncJob.update({
        where: { id: job.id },
        data: {
          status: "PENDING",
          attempts: job.attempts,
          rerunRequested: false,
          availableAt,
          lockedAt: null,
          lockedBy: null,
          lastError: safeError,
        },
      }),
      db.channelConnection.updateMany({
        where: { id: job.connectionId, hotelId: job.hotelId },
        data: { lastSyncStatus: "QUEUED", lastError: safeError },
      }),
    ]);
    return "retried";
  }

  return db.$transaction(async (tx) => {
    const terminal = await tx.channelSyncJob.updateMany({
      where: { id: job.id, status: "RUNNING", rerunRequested: false },
      data: {
        status: "FAILED",
        deduplicationKey: null,
        lockedAt: null,
        lockedBy: null,
        finishedAt: new Date(),
        lastError: safeError,
      },
    });
    if (terminal.count === 1) {
      await tx.channelConnection.updateMany({
        where: { id: job.connectionId, hotelId: job.hotelId },
        data: { status: "ERROR", lastSyncStatus: "FAILED", lastError: safeError },
      });
      return "failed" as const;
    }

    // A new change arrived during the final attempt. Its delivery intent wins
    // over the terminal failure and receives a fresh retry budget.
    await tx.channelSyncJob.update({
      where: { id: job.id },
      data: {
        status: "PENDING",
        attempts: 0,
        rerunRequested: false,
        availableAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        finishedAt: null,
        lastError: safeError,
      },
    });
    await tx.channelConnection.updateMany({
      where: { id: job.connectionId, hotelId: job.hotelId },
      data: { lastSyncStatus: "QUEUED", lastError: safeError },
    });
    return "retried" as const;
  });
}

export async function processChannelSyncJobs(options: { limit?: number } = {}): Promise<SyncQueueRun> {
  if (!channelSyncEnabled()) return { claimed: 0, succeeded: 0, retried: 0, failed: 0 };
  const limit = channelSyncBatchSize(options.limit ?? 1);
  const workerId = crypto.randomUUID();
  const result: SyncQueueRun = { claimed: 0, succeeded: 0, retried: 0, failed: 0 };

  for (let index = 0; index < limit; index++) {
    const job = await claimNextChannelSyncJob(workerId);
    if (!job) break;
    result.claimed++;

    try {
      // A reclaimed job can leave the connection marked RUNNING. The queue
      // lease is now authoritative, so make the sync service claimable again.
      await db.channelConnection.updateMany({
        where: { id: job.connectionId, hotelId: job.hotelId, lastSyncStatus: "RUNNING" },
        data: { lastSyncStatus: "QUEUED" },
      });

      const summary = await runChannelSync(job.connectionId, job.hotelId);
      if (summary.status === "FAILED") {
        const outcome = await failOrRetrySyncJob(
          job,
          summary.message ?? syncFailureMessage(summary.incidentId),
        );
        result[outcome]++;
      } else {
        const outcome = await completeSyncJob(job.id);
        result[outcome]++;
      }
    } catch {
      const incidentId = crypto.randomUUID();
      console.error("Channel sync queue worker failed", { incidentId, jobId: job.id });
      const outcome = await failOrRetrySyncJob(job, syncFailureMessage(incidentId));
      result[outcome]++;
    }
  }

  return result;
}
