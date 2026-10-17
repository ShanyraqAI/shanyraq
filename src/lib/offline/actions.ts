import type { MutationContext } from "./mutation-context";
import type { ActionResult } from "@/server/types";
import {
  cancelReservationAction,
  collectReservationDepositAction,
  createReservationAction,
  moveReservationAction,
  returnReservationDepositAction,
  setReservationStatusAction,
  updateReservationAction,
} from "@/server/actions/reservations";
import { setRoomStatusAction } from "@/server/actions/rooms";
import { addGuestNoteAction, upsertGuestAction } from "@/server/actions/guests";
import { dispatchOfflineAction } from "./dispatch";
export { QUEUED_MESSAGE } from "./dispatch";

// Server actions that may be queued offline and replayed later with the same arguments.
const OFFLINE_ACTIONS = {
  "reservation.create": createReservationAction,
  "reservation.update": updateReservationAction,
  "reservation.status": setReservationStatusAction,
  "reservation.cancel": cancelReservationAction,
  "reservation.move": moveReservationAction,
  "reservation.depositCollect": collectReservationDepositAction,
  "reservation.depositReturn": returnReservationDepositAction,
  "room.status": setRoomStatusAction,
  "guest.note": addGuestNoteAction,
  "guest.upsert": upsertGuestAction,
} as const;

export type OfflineActionKind = keyof typeof OFFLINE_ACTIONS;
type ActionOf<K extends OfflineActionKind> = (typeof OFFLINE_ACTIONS)[K];
type DataOf<K extends OfflineActionKind> =
  Awaited<ReturnType<ActionOf<K>>> extends ActionResult<infer T> ? T : never;

export type OfflineActionResult<T> = ActionResult<T> & { queued?: boolean };

export function isOfflineActionKind(kind: string): kind is OfflineActionKind {
  return Object.hasOwn(OFFLINE_ACTIONS, kind);
}

/** Calls an action directly; used by the replay loop. Network failures are rethrown. */
export function callOfflineAction(
  kind: OfflineActionKind,
  args: unknown[],
  context: MutationContext,
): Promise<ActionResult<unknown>> {
  const action = OFFLINE_ACTIONS[kind] as unknown as (
    ...input: unknown[]
  ) => Promise<ActionResult<unknown>>;
  const arity = kind === "reservation.move" ? 4 : 1;
  if (args.length > arity)
    throw new Error("Некорректные аргументы офлайн-операции.");
  const original = Array.from({ length: arity }, (_, i) => args[i]);
  return action(...original, context);
}

/**
 * Runs a server action, or saves it to the device outbox when there is no
 * connection. Queued results are `ok` with `queued: true` and no data.
 */
export async function runOfflineAction<K extends OfflineActionKind>(
  kind: K,
  label: string,
  ...args: Parameters<ActionOf<K>>
): Promise<OfflineActionResult<DataOf<K>>> {
  return (await dispatchOfflineAction(kind, label, args, (context) =>
    callOfflineAction(kind, args, context),
  )) as OfflineActionResult<DataOf<K>>;
}
