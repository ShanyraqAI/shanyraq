import assert from "node:assert/strict";
import test from "node:test";
import { canReceiveNotification, hiddenNotificationTypes, isAllowedPushEndpoint } from "./policy";

test("push endpoints are limited to browser push services", () => {
  for (const endpoint of [
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
    "https://web.push.apple.com/abc",
  ]) assert.equal(isAllowedPushEndpoint(endpoint), true, endpoint);
  for (const endpoint of [
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/push",
    "https://10.0.0.5/push",
    "https://fcm.googleapis.com.evil.example/push",
    "https://evilpush.services.mozilla.com.example/x",
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com:8443/fcm/send/abc",
    "https://user:pass@fcm.googleapis.com/fcm/send/abc",
    "not a url",
  ]) assert.equal(isAllowedPushEndpoint(endpoint), false, endpoint);
});

test("reservation notifications require reservation access", () => {
  assert.equal(canReceiveNotification({ role: "STAFF", permissions: ["ROOMS"] }, "NEW_RESERVATION"), false);
  assert.equal(canReceiveNotification({ role: "STAFF", permissions: ["RESERVATIONS"] }, "NEW_RESERVATION"), true);
  assert.equal(canReceiveNotification({ role: "OWNER", permissions: [] }, "NEW_RESERVATION"), true);
  assert.equal(canReceiveNotification({ role: "STAFF", permissions: ["ROOMS"] }, "URGENT_TASK"), true);
  assert.deepEqual(hiddenNotificationTypes(["ROOMS"]), ["NEW_RESERVATION"]);
  assert.deepEqual(hiddenNotificationTypes(["RESERVATIONS"]), []);
});
