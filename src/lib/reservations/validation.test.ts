import assert from "node:assert/strict";
import test from "node:test";
import { updateReservationSchema } from "@/lib/constants";

const update = {
  id: "reservation-1",
  roomId: "room-1",
  checkIn: "2026-09-10",
  checkOut: "2026-09-11",
  adults: 1,
  children: 0,
  ratePlanId: "rate-1",
};

test("reservation edit accepts either an existing guest or a new guest", () => {
  assert.equal(updateReservationSchema.safeParse({ ...update, guestId: "guest-1" }).success, true);
  assert.equal(updateReservationSchema.safeParse({ ...update, guestName: "Новый гость" }).success, true);
  assert.equal(updateReservationSchema.safeParse(update).success, false);
});
