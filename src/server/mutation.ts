import { db } from "@/lib/db";
import { getCurrentMembership } from "@/lib/tenant";
import type { HotelPermission } from "@/lib/access";
import { requireSessionHotelId } from "@/server/guards";
import { AuthenticationError } from "@/server/errors";
import type { ActionResult } from "@/server/types";
import type { MutationContext } from "@/lib/offline/mutation-context";
import {
  executeOperation,
  type AfterCommit,
} from "@/lib/reservations/operation";
import type { Prisma } from "@prisma/client";
export async function runMutation<T>(
  context: MutationContext | undefined,
  permission: HotelPermission,
  action: string,
  input: unknown,
  work: (
    tx: Prisma.TransactionClient,
    hotelId: string,
    defer: AfterCommit,
  ) => Promise<ActionResult<T>>,
) {
  // Always reauthorize, even on a receipt hit. Client scope is only an expectation.
  const hotelId = await requireSessionHotelId({ permission });
  const member = await getCurrentMembership();
  if (!member || member.hotelId !== hotelId) throw new AuthenticationError();
  return executeOperation(
    db,
    { userId: member.userId, hotelId },
    context,
    action,
    input,
    (tx, defer) => work(tx, hotelId, defer),
  );
}
