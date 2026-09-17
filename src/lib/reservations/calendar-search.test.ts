import test from "node:test";
import assert from "node:assert/strict";
import { reservationMatchesCalendarSearch } from "./calendar-search";
import type { ReservationVM } from "@/lib/types";

const reservation: ReservationVM = {
  id: "reservation-1",
  sequenceNumber: 12,
  guestId: "guest-1",
  guestName: "Иван Иванов",
  guestEmail: "ivan@example.com",
  guestPhone: "+7 777 123 45 67",
  roomId: "room-1",
  roomNumber: "302",
  floor: 3,
  roomTypeId: "deluxe",
  roomTypeName: "Делюкс",
  checkIn: "2026-09-14",
  checkOut: "2026-09-17",
  checkInTime: "14:00",
  checkOutTime: "12:00",
  adults: 2,
  children: 0,
  status: "CONFIRMED",
  currency: "KZT",
  totalAmount: 120000,
  ratePlanId: "rate-plan-1",
  pricingMode: "RATE_PLAN",
  channel: "booking",
  externalReservationId: "BK-900",
  notes: null,
  createdAt: "2026-09-01T10:00:00.000Z",
};

test("calendar search finds a reservation by guest, phone, room and sequential ID", () => {
  assert.equal(reservationMatchesCalendarSearch(reservation, "иван"), true);
  assert.equal(reservationMatchesCalendarSearch(reservation, "123 45"), true);
  assert.equal(reservationMatchesCalendarSearch(reservation, "302"), true);
  assert.equal(reservationMatchesCalendarSearch(reservation, "b012"), true);
});

test("calendar search finds external references and rejects unrelated queries", () => {
  assert.equal(reservationMatchesCalendarSearch(reservation, "bk-900"), true);
  assert.equal(reservationMatchesCalendarSearch(reservation, "петров"), false);
});
