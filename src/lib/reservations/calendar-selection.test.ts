import assert from "node:assert/strict";
import test from "node:test";
import { findSelectedReservation } from "./calendar-selection";
import type { ReservationVM } from "@/lib/types";

function reservation(id: string, guestName: string): ReservationVM {
  return {
    id,
    guestId: `guest-${id}`,
    guestName,
    guestEmail: null,
    guestPhone: null,
    roomId: "room-1",
    roomNumber: "101",
    floor: 1,
    roomTypeId: "type-1",
    roomTypeName: "Стандарт",
    checkIn: "2026-09-10",
    checkOut: "2026-09-11",
    adults: 1,
    children: 0,
    status: "CONFIRMED",
    currency: "KZT",
    totalAmount: 25_000,
    channel: "direct",
    externalReservationId: null,
    notes: null,
    createdAt: "2026-09-01T00:00:00.000Z",
  };
}

test("selected reservation resolves from refreshed data instead of a stale snapshot", () => {
  const before = [reservation("reservation-1", "Старое имя")];
  const after = [reservation("reservation-1", "Новое имя")];
  assert.equal(findSelectedReservation(before, "reservation-1")?.guestName, "Старое имя");
  assert.equal(findSelectedReservation(after, "reservation-1")?.guestName, "Новое имя");
  assert.equal(findSelectedReservation(after, "missing"), null);
});
