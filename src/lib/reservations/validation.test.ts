import assert from "node:assert/strict";
import test from "node:test";
import { createReservationSchema, updateReservationSchema, upsertGuestSchema } from "@/lib/constants";

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

test("guest contact fields are optional and payment method is independent of status", () => {
  assert.equal(upsertGuestSchema.safeParse({ fullName: "Гость без контактов" }).success, true);
  assert.equal(upsertGuestSchema.safeParse({ fullName: "Гость", email: "", country: "" }).success, true);
  const booking = { guestName: "Гость", roomId: "room-1", checkIn: "2026-09-10", checkOut: "2026-09-11", adults: 1, pricingMode: "MANUAL", manualTotalAmount: 10000 };
  assert.equal(createReservationSchema.safeParse({ ...booking, paymentMethod: "CASH" }).success, true);
  assert.equal(createReservationSchema.safeParse({ ...booking, paymentMethod: "ONLINE" }).success, true);
  assert.equal(createReservationSchema.safeParse({ ...booking, paymentMethod: "CARD" }).success, false);
});
