import assert from "node:assert/strict";
import test from "node:test";
import { apartmentPresentationText } from "./presentation";
test("presentation ignores extra secrets at runtime, not just TypeScript", () => {
  const profile = { name: "Квартира 102", capacity: 2, nightlyPrice: "25 000 KZT",
    address: "SECRET_ADDRESS", wifiPassword: "SECRET_WIFI", code: "SECRET_CODE", guestName: "SECRET_GUEST", documents: ["SECRET_PDF"] };
  const text = apartmentPresentationText(profile);
  assert.ok(text.includes("Квартира 102"));
  assert.ok(!text.includes("SECRET_"));
});
test("no invented amenities, dates, location or photos when absent", () => {
  const text = apartmentPresentationText({ name: "Студия", capacity: 1, nightlyPrice: "10 000 KZT" }, "kk");
  assert.ok(text.includes("Сыйымдылық: 1"));
  assert.ok(!text.includes("undefined"));
  assert.ok(!text.includes("http"));
});
