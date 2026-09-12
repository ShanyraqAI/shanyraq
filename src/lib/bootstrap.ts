import { db } from "@/lib/db";
import { seedSystemData } from "@/lib/system-seed";

/**
 * Runtime database bootstrap — PostgreSQL only.
 *
 * Схема управляется `prisma db push` / `prisma migrate` при деплое.
 * На старте проверяем наличие системных данных (Channel) и сидируем их
 * один раз транзакционно, если их нет.
 */

const globalForBootstrap = globalThis as unknown as {
  __shanyraqDbReady?: Promise<void>;
};

export function ensureDatabaseReady(): Promise<void> {
  globalForBootstrap.__shanyraqDbReady ??= bootstrap().catch((error) => {
    globalForBootstrap.__shanyraqDbReady = undefined;
    throw error;
  });
  return globalForBootstrap.__shanyraqDbReady;
}

async function bootstrap(): Promise<void> {
  let channels: number;
  try {
    channels = await db.channel.count();
  } catch (error) {
    if (error instanceof Error && /does not exist|relation.*does not exist/i.test(error.message)) {
      throw new Error(
        "PostgreSQL tables not found. Apply the reviewed Prisma migrations before starting the application.",
      );
    }
    throw error;
  }

  if (channels === 0) {
    try {
      await db.$transaction(
        async (tx) => {
          await seedSystemData(tx as unknown as import("@prisma/client").PrismaClient);
        },
        { timeout: 60_000, maxWait: 10_000 },
      );
    } catch (error) {
      const [channelsNow] = await Promise.all([db.channel.count()]);
      if (channelsNow === 0) throw error;
    }
  }
}
