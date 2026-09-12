import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PublicError } from "@/server/errors";
import { channelSyncDeduplicationKey } from "./queue-policy";

const DEFAULT_MAX_ATTEMPTS = 6;
type QueueTransaction = Prisma.TransactionClient;

export interface EnqueuedSyncJob {
  id: string;
  connectionId: string;
  channelId: string;
  status: string;
}

/** Persist one synchronization request for a connection. */
export async function enqueueChannelSync(
  connectionId: string,
  hotelId: string,
): Promise<EnqueuedSyncJob> {
  return db.$transaction(async (tx) => {
    const connection = await tx.channelConnection.findFirst({
      where: {
        id: connectionId,
        hotelId,
        channel: { isInternal: false },
        status: { in: ["CONNECTED", "ERROR"] },
      },
      select: { id: true },
    });
    if (!connection) throw new PublicError("Подключение недоступно для синхронизации.");

    const deduplicationKey = channelSyncDeduplicationKey(connection.id);
    const job = await tx.channelSyncJob.upsert({
      where: { deduplicationKey },
      update: { availableAt: new Date(), rerunRequested: true },
      create: {
        hotelId,
        connectionId: connection.id,
        deduplicationKey,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
      },
      select: {
        id: true,
        connectionId: true,
        status: true,
        connection: { select: { channelId: true } },
      },
    });

    // Do not replace RUNNING with QUEUED when a worker already owns the lease.
    await tx.channelConnection.updateMany({
      where: {
        id: connection.id,
        hotelId,
        OR: [{ lastSyncStatus: null }, { lastSyncStatus: { not: "RUNNING" } }],
      },
      data: { lastSyncStatus: "QUEUED" },
    });

    return {
      id: job.id,
      connectionId: job.connectionId,
      channelId: job.connection.channelId,
      status: job.status,
    };
  });
}

/**
 * Add one active job for every connected OTA in the caller's transaction.
 * Domain data and its delivery intent therefore commit or roll back together.
 */
export async function enqueueHotelChannelSyncs(
  tx: QueueTransaction,
  hotelId: string,
): Promise<number> {
  const connections = await tx.channelConnection.findMany({
    where: {
      hotelId,
      status: { in: ["CONNECTED", "ERROR"] },
      channel: { isInternal: false },
    },
    select: { id: true },
  });

  const now = new Date();
  for (const connection of connections) {
    await tx.channelSyncJob.upsert({
      where: { deduplicationKey: channelSyncDeduplicationKey(connection.id) },
      update: { availableAt: now, rerunRequested: true },
      create: {
        hotelId,
        connectionId: connection.id,
        deduplicationKey: channelSyncDeduplicationKey(connection.id),
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
      },
    });
    await tx.channelConnection.updateMany({
      where: {
        id: connection.id,
        hotelId,
        OR: [{ lastSyncStatus: null }, { lastSyncStatus: { not: "RUNNING" } }],
      },
      data: { lastSyncStatus: "QUEUED" },
    });
  }
  return connections.length;
}

export async function enqueueAllChannelSyncs(hotelId: string): Promise<EnqueuedSyncJob[]> {
  const connections = await db.channelConnection.findMany({
    where: {
      hotelId,
      status: { in: ["CONNECTED", "ERROR"] },
      channel: { isInternal: false },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const jobs: EnqueuedSyncJob[] = [];
  for (const connection of connections) {
    jobs.push(await enqueueChannelSync(connection.id, hotelId));
  }
  return jobs;
}
