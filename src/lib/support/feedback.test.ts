import test from "node:test";
import assert from "node:assert/strict";
import { buildFeedbackTechnicalContext, shouldShowFirstReservationFeedback } from "./feedback";

test("first-reservation feedback waits until onboarding tour is handled", () => {
  assert.equal(shouldShowFirstReservationFeedback({ reservationCount: 1, tourCompleted: false, submitted: false, dismissed: false }), false);
  assert.equal(shouldShowFirstReservationFeedback({ reservationCount: 1, tourCompleted: true, submitted: false, dismissed: false }), true);
});

test("submitted or dismissed feedback is not requested again", () => {
  assert.equal(shouldShowFirstReservationFeedback({ reservationCount: 2, tourCompleted: true, submitted: true, dismissed: false }), false);
  assert.equal(shouldShowFirstReservationFeedback({ reservationCount: 2, tourCompleted: true, submitted: false, dismissed: true }), false);
});

test("technical feedback context contains only allowlisted operational fields", () => {
  const context = JSON.parse(buildFeedbackTechnicalContext({ trigger: "FIRST_RESERVATION", sourcePath: "/dashboard/reservations", appVersion: "abc123" }));
  assert.deepEqual(context, { trigger: "FIRST_RESERVATION", sourcePath: "/dashboard/reservations", appVersion: "abc123" });
});
