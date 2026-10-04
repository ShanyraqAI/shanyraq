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
import { enqueueOutbox, isDeviceOffline, isNetworkError } from "@/lib/offline/outbox";

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
type DataOf<K extends OfflineActionKind> = Awaited<ReturnType<ActionOf<K>>> extends ActionResult<infer T> ? T : never;

export type OfflineActionResult<T> = ActionResult<T> & { queued?: boolean };

export const QUEUED_MESSAGE = "Сохранено на устройстве. Отправим, когда появится интернет.";

export function isOfflineActionKind(kind: string): kind is OfflineActionKind {
  return kind in OFFLINE_ACTIONS;
}

/** Calls an action directly; used by the replay loop. Network failures are rethrown. */
export function callOfflineAction(kind: OfflineActionKind, args: unknown[]): Promise<ActionResult<unknown>> {
  const action = OFFLINE_ACTIONS[kind] as unknown as (...input: unknown[]) => Promise<ActionResult<unknown>>;
  return action(...args);
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
  const queue = (): OfflineActionResult<DataOf<K>> => {
    if (!enqueueOutbox({ kind, label, args })) return { ok: false, error: "Нет подключения к интернету. Попробуйте ещё раз." };
    return { ok: true, queued: true, message: QUEUED_MESSAGE };
  };
  if (isDeviceOffline()) return queue();
  try {
    return (await callOfflineAction(kind, args)) as OfflineActionResult<DataOf<K>>;
  } catch (error) {
    if (isNetworkError(error)) return queue();
    throw error;
  }
}
