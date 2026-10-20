import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

export function privateAdminMessage(message: { chat?: { id?: unknown; type?: unknown }; from?: { id?: unknown; is_bot?: unknown } } | undefined, allowed: Set<string>): boolean {
  return !!message && message.chat?.type === "private" &&
    typeof message.from?.id === "number" && Number.isSafeInteger(message.from.id) &&
    message.chat.id === message.from.id && message.from.is_bot !== true && allowed.has(String(message.from.id));
}

/** The same tx must be used by every mutating command handler. */
export async function executeTelegramUpdate(client: PrismaClient, updateId: number, identity: unknown,
  work: (tx: Prisma.TransactionClient) => Promise<string>): Promise<string> {
  if (!Number.isSafeInteger(updateId) || updateId < 0) throw new Error("Invalid Telegram update id");
  const commandHash = createHash("sha256").update(JSON.stringify(identity)).digest("hex");
  return client.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`telegram-update:${updateId}`}, 0))::text`;
    const key = BigInt(updateId);
    const previous = await tx.telegramCommandReceipt.findUnique({ where: { updateId: key } });
    if (previous) {
      if (previous.commandHash !== commandHash) throw new Error("Telegram update identity mismatch");
      return previous.response;
    }
    const response = await work(tx);
    await tx.telegramCommandReceipt.create({ data: { updateId: key, commandHash, response } });
    return response;
  }, { timeout: 30_000 });
}
