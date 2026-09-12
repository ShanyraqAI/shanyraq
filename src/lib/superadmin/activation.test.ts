import assert from "node:assert/strict";
import test from "node:test";
import { calculateActivationFunnel, hotelActivationStatus } from "./activation";
import { isPlatformAdminRole } from "./roles";

test("only the explicit platform role authorizes superadmin", () => {
  assert.equal(isPlatformAdminRole("SUPER_ADMIN"), true);
  assert.equal(isPlatformAdminRole("OWNER"), false);
  assert.equal(isPlatformAdminRole(null), false);
});

test("activation funnel uses later-day return and rolling seven-day activity", () => {
  const now = new Date("2026-09-11T12:00:00.000Z");
  const result = calculateActivationFunnel([
    { createdAt: new Date("2026-09-09T10:00:00Z"), hasHotel: true, hasRoom: true, hasReservation: true, activityDates: [new Date("2026-09-10T08:00:00Z")] },
    { createdAt: new Date("2026-08-01T10:00:00Z"), hasHotel: true, hasRoom: false, hasReservation: false, activityDates: [new Date("2026-08-02T08:00:00Z")] },
  ], now);
  assert.deepEqual(result, { signup: 2, hotel: 2, room: 1, firstReservation: 1, returnedUser: 2, activeSevenDays: 1 });
});

test("hotel activation requires inventory, a reservation and calendar usage", () => {
  assert.equal(hotelActivationStatus({ roomCount: 1, reservationCount: 1, openedCalendar: true }), "Активирован");
  assert.equal(hotelActivationStatus({ roomCount: 1, reservationCount: 0, openedCalendar: false }), "Добавлены номера");
});
