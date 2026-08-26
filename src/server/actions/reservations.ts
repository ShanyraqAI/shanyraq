"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionHotelId } from "@/server/guards";
import { createReservationSchema, updateReservationSchema, reservationStatusSchema, firstZodError, type ReservationStatus } from "@/lib/constants";
import {
  createReservation,
  setReservationStatus,
  updateReservationDetails,
} from "@/lib/reservations/service";
import { parseISODate } from "@/lib/dates";
import { ok, fail, type ActionResult } from "@/server/types";
import { toErrorMessage } from "@/server/errors";
import { t } from "@/lib/i18n";

function revalidateAll() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard/guests");
}

async function resolveGuest(
  hotelId: string,
  input: { guestId?: string; guestName?: string; guestEmail?: string; guestPhone?: string },
): Promise<string> {
  if (input.guestId) {
    const existing = await db.guest.findFirst({ where: { id: input.guestId, hotelId }, select: { id: true } });
    if (existing) return existing.id;
  }
  const name = input.guestName?.trim();
  if (!name) throw new Error(t.reservations.errors.guestRequired);
  const byName = await db.guest.findFirst({
    where: { hotelId, fullName: { equals: name } },
    select: { id: true },
  });
  if (byName) return byName.id;
  const created = await db.guest.create({
    data: {
      hotelId,
      fullName: name,
      email: input.guestEmail || null,
      phone: input.guestPhone || null,
    },
    select: { id: true },
  });
  return created.id;
}

export async function createReservationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createReservationSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId();
    const data = parsed.data;

    // Room-type consistency for the rate plan.
    const room = await db.room.findFirst({ where: { id: data.roomId, hotelId }, include: { roomType: true } });
    if (!room) return fail(t.reservations.errors.roomNotFound);
    const plan = await db.ratePlan.findFirst({ where: { id: data.ratePlanId, hotelId } });
    if (!plan) return fail(t.reservations.errors.ratePlanNotFound);
    if (plan.roomTypeId !== room.roomTypeId) {
      return fail(t.reservations.errors.planMismatch(room.roomType.name));
    }

    const guestId = await resolveGuest(hotelId, data);
    const reservation = await createReservation({
      hotelId,
      guestId,
      roomId: data.roomId,
      ratePlanId: data.ratePlanId,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      adults: data.adults,
      children: data.children,
      sourceChannel: data.sourceChannel,
      notes: data.notes ?? null,
      status: "CONFIRMED",
    });
    revalidateAll();
    return ok({ id: reservation.id }, t.reservations.toasts.created);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function updateReservationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = updateReservationSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId();
    const data = parsed.data;
    await updateReservationDetails({
      id: data.id,
      hotelId,
      guestId: data.guestId,
      roomId: data.roomId,
      ratePlanId: data.ratePlanId,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      adults: data.adults,
      children: data.children,
      notes: data.notes ?? null,
    });
    revalidateAll();
    return ok({ id: data.id }, t.reservations.toasts.updated);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function setReservationStatusAction(input: unknown): Promise<ActionResult> {
  try {
    const parsed = reservationStatusSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId();
    await setReservationStatus(hotelId, parsed.data.id, parsed.data.status as ReservationStatus);
    revalidateAll();
    return ok(undefined, t.reservations.toasts.statusChanged(t.statuses.reservation[parsed.data.status]));
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function cancelReservationAction(reservationId: string): Promise<ActionResult> {
  try {
    const hotelId = await requireSessionHotelId();
    await setReservationStatus(hotelId, reservationId, "CANCELLED");
    revalidateAll();
    return ok(undefined, t.reservations.toasts.cancelled);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function moveReservationAction(
  reservationId: string,
  newRoomId: string | undefined,
  newCheckIn: string | undefined,
  newCheckOut: string | undefined,
): Promise<ActionResult> {
  try {
    const hotelId = await requireSessionHotelId();
    const res = await db.reservation.findFirst({ where: { id: reservationId, hotelId } });
    if (!res) return fail(t.reservations.errors.reservationNotFound);
    const roomId = newRoomId ?? res.roomId;
    const checkIn = toISOSafe(newCheckIn ? parseISODate(newCheckIn) : res.checkIn);
    const checkOut = toISOSafe(newCheckOut ? parseISODate(newCheckOut) : res.checkOut);
    if (checkOut <= checkIn) return fail(t.validation.checkoutAfterCheckin);

    const room = await db.room.findFirst({ where: { id: roomId, hotelId }, include: { roomType: true } });
    if (!room) return fail(t.reservations.errors.roomNotFound);
    const plan = await db.ratePlan.findFirst({ where: { roomTypeId: room.roomTypeId, hotelId } });
    if (!plan) return fail(t.reservations.errors.noPlanForType);

    await updateReservationDetails({
      id: res.id,
      hotelId,
      guestId: res.guestId,
      roomId,
      ratePlanId: plan.id,
      checkIn,
      checkOut,
      adults: res.adults,
      children: res.children,
      notes: res.notes,
    });
    revalidateAll();
    return ok(undefined, t.reservations.toasts.movedToRoom(room.number));
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

function toISOSafe(date: Date): string {
  return date.toISOString().slice(0, 10);
}
