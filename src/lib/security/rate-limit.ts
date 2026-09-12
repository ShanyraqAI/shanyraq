import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { RateLimitError } from "@/server/errors";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function requestAddress(): Promise<string> {
  const values = await headers();
  return values.get("x-real-ip") ?? values.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function enforceRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const ip = await requestAddress();
  const key = `${scope}:${digest(`${ip}:${identifier.trim().toLowerCase()}`)}`;
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
    const bucket = await tx.rateLimitBucket.findUnique({ where: { key } });
    if (!bucket || bucket.resetAt <= now) {
      await tx.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
      return;
    }
    if (bucket.count >= limit) throw new RateLimitError();
    await tx.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } });
  });

  // Cheap opportunistic cleanup; failures must never block a valid request.
  if (Math.random() < 0.01) {
    void db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: now } } }).catch(() => undefined);
  }
}
