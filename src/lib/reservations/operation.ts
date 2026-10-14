import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ActionResult } from "@/server/types";
import type { MutationContext } from "@/lib/offline/mutation-context";
import { PublicError } from "@/server/errors";

export type AfterCommit = (effect: () => void | Promise<void>) => void;
class RejectedResult extends Error {
  constructor(readonly result: ActionResult<unknown>) {
    super("Mutation rejected");
  }
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function operationHash(action: string, input: unknown) {
  return createHash("sha256")
    .update(JSON.stringify([action, canonical(input)]))
    .digest("hex");
}
export function validateMutationContext(
  context: MutationContext | undefined,
  userId: string,
  hotelId: string,
) {
  if (context === undefined) return;
  if (
    !context ||
    typeof context.key !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      context.key,
    ) ||
    context.scope !== `${userId}:${hotelId}`
  ) {
    throw new PublicError(
      "Рабочий контекст изменился. Откройте нужный объект и повторите синхронизацию.",
    );
  }
}
/** Business data, audit and successful replay result commit together. Failed results roll back. */
export async function executeOperation<T>(
  client: PrismaClient,
  identity: { userId: string; hotelId: string },
  context: MutationContext | undefined,
  action: string,
  input: unknown,
  work: (
    tx: Prisma.TransactionClient,
    defer: AfterCommit,
  ) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  validateMutationContext(context, identity.userId, identity.hotelId);
  const effects: Array<() => void | Promise<void>> = [];
  try {
    const result = await client.$transaction(
      async (tx) => {
        const key = context?.key;
        const requestHash = operationHash(action, input);
        if (key) {
          const lock = `operation:${identity.userId}:${identity.hotelId}:${key}`;
          await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${lock}, 0))`;
          const receipt = await tx.operationReceipt.findUnique({
            where: { userId_hotelId_key: { ...identity, key } },
          });
          if (receipt) {
            if (
              receipt.action !== action ||
              receipt.requestHash !== requestHash
            )
              throw new PublicError(
                "Ключ повтора уже использован для другого изменения.",
              );
            return JSON.parse(receipt.resultJson) as ActionResult<T>;
          }
        }
        const response = await work(tx, (effect) => effects.push(effect));
        if (!response.ok) throw new RejectedResult(response);
        if (key)
          await tx.operationReceipt.create({
            data: {
              ...identity,
              key,
              action,
              requestHash,
              resultJson: JSON.stringify(response),
            },
          });
        return response;
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
    // Auxiliary effects cannot turn committed business success into an action failure.
    for (const effect of effects) {
      try {
        await effect();
      } catch {
        console.error("Post-commit effect failed", { action });
      }
    }
    return result;
  } catch (error) {
    if (error instanceof RejectedResult) return error.result as ActionResult<T>;
    throw error;
  }
}
