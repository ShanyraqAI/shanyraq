import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { safeAnalyticsMetadata, type AnalyticsEventType } from "@/lib/analytics/events";

type AnalyticsClient = Prisma.TransactionClient | typeof db;

export interface AnalyticsEventInput {
  eventType: AnalyticsEventType;
  userId?: string | null;
  organizationId?: string | null;
  hotelId?: string | null;
  sessionId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

function short(value: string | null | undefined, max = 120): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, max) : null;
}

/** Strict writer for use inside an existing business transaction. */
export async function recordAnalyticsEvent(input: AnalyticsEventInput, client: AnalyticsClient = db) {
  const metadata = safeAnalyticsMetadata(input.metadata);
  return client.analyticsEvent.create({
    data: {
      eventType: input.eventType,
      userId: input.userId ?? null,
      organizationId: input.organizationId ?? null,
      hotelId: input.hotelId ?? null,
      sessionId: short(input.sessionId),
      entityType: short(input.entityType, 60),
      entityId: short(input.entityId),
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    },
    select: { id: true },
  });
}

/** Analytics must never turn a successful hotel operation into a user-visible failure. */
export async function recordAnalyticsEventSafely(input: AnalyticsEventInput): Promise<void> {
  try {
    await recordAnalyticsEvent(input);
  } catch (error) {
    console.error("Analytics event could not be recorded", {
      eventType: input.eventType,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}

export async function recordCurrentUserEvent(
  eventType: AnalyticsEventType,
  entity?: { type: string; id: string },
  metadata?: Record<string, unknown>,
): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  await recordAnalyticsEventSafely({
    eventType,
    userId: user.id,
    organizationId: user.organizationId,
    hotelId: user.hotelId,
    sessionId: user.sessionId,
    entityType: entity?.type,
    entityId: entity?.id,
    metadata,
  });
}
