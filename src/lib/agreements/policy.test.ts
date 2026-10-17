import test from "node:test";
import assert from "node:assert/strict";
import {
  token,
  hash,
  otpHash,
  otpCode,
  normalizePhone,
  equalHash,
  bundleLink,
  guestCommand,
  staffCommand,
} from "./policy";
import { sendOtpSms, smsConfig } from "../sms/mobizon";
const cfg = {
  apiKey: "synthetic-test-key",
  sender: "Shanyraq",
  secret: "synthetic-only-test-secret-32-bytes-minimum",
};
test("capability tokens have 256 bits; only digests persist", () => {
  const t = token();
  assert.match(t, /^[a-f0-9]{64}$/);
  assert.notEqual(token(), t);
  assert.notEqual(hash(t), t);
});
test("OTP binds challenge, bundle, phone and code", () => {
  const a = otpHash(cfg.secret, "a", "bundle", "77000000000", "001234");
  assert.equal(equalHash(a, a), true);
  for (const args of [
    ["b", "bundle", "77000000000", "001234"],
    ["a", "changed", "77000000000", "001234"],
    ["a", "bundle", "77010000000", "001234"],
    ["a", "bundle", "77000000000", "001235"],
  ])
    assert.notEqual(
      a,
      otpHash(cfg.secret, ...(args as [string, string, string, string])),
    );
  assert.equal(equalHash(a, "invalid"), false);
});
test("OTP preserves leading zeros and six digits", () => {
  for (let i = 0; i < 100; i++) assert.match(otpCode(), /^\d{6}$/);
});
test("only supported Kazakhstan mobile prefixes, no guessed 8-prefix rewrite", () => {
  assert.equal(normalizePhone("+7 (700) 000-00-00"), "77000000000");
  for (const p of [
    "87000000000",
    "+79990000000",
    "+1234567890",
    null,
    "77000000000?x",
  ])
    assert.equal(normalizePhone(p), null);
});
test("capability is fragment-only and HTTPS without user info", () => {
  assert.equal(
    bundleLink("https://example.com/x?a=b", "a".repeat(64)),
    `https://example.com/guest/agreements#${"a".repeat(64)}`,
  );
  assert.throws(() => bundleLink("http://public.example", "x"));
  assert.throws(() => bundleLink("https://user:pass@example.com", "x"));
});
test("view or empty intent can never turn into consent", () => {
  assert.equal(
    guestCommand.safeParse({
      action: "accept",
      token: "a".repeat(64),
      bundleHash: "b".repeat(64),
      signerName: "Тест Гость",
      acceptedItems: ["a"],
      intent: false,
      consentVersion: "bundle-acknowledgement-v1",
    }).success,
    false,
  );
  assert.equal(
    guestCommand.safeParse({
      action: "load",
      token: "a".repeat(64),
      intent: true,
    }).success,
    false,
  );
});
test("owner cannot bypass authority or approve implicitly", () => {
  assert.equal(
    staffCommand.safeParse({ action: "create", reservationId: "r" }).success,
    false,
  );
});
test("SMS config defaults off and requires sender plus independent long secret", () => {
  assert.equal(smsConfig({}), null);
  assert.equal(
    smsConfig({ DOCUMENT_SMS_ENABLED: "true", MOBIZON_API_KEY: "x" }),
    null,
  );
  assert.equal(
    smsConfig({
      DOCUMENT_SMS_ENABLED: "true",
      MOBIZON_API_KEY: cfg.apiKey,
      MOBIZON_SENDER: cfg.sender,
      DOCUMENT_OTP_SECRET: cfg.secret,
    })?.sender,
    cfg.sender,
  );
});
test("Mobizon accepted does not claim delivery; fixed endpoint, registered sender", async () => {
  let calls = 0;
  const r = await sendOtpSms(cfg, "77000000000", "000123", (async (
    url,
    init,
  ) => {
    calls++;
    assert.equal(new URL(String(url)).hostname, "api.mobizon.kz");
    assert.equal(init?.redirect, "error");
    const body = init?.body as URLSearchParams;
    assert.equal(body.get("from"), "Shanyraq");
    assert.equal(body.get("recipient"), "77000000000");
    assert.match(body.get("text")!, /000123/);
    assert.equal(body.get("params[shortenLinks]"), "0");
    return Response.json({ code: 0, data: { messageId: 12 } });
  }) as typeof fetch);
  assert.deepEqual(r, { state: "ACCEPTED", messageId: "12" });
  assert.equal(calls, 1);
});
test("ambiguous timeout, HTTP and invalid JSON never retry or claim failure/success", async () => {
  for (const f of [
    async () => {
      throw new Error("synthetic timeout");
    },
    async () => new Response("bad", { status: 503 }),
    async () => new Response("not json"),
    async () => Response.json({ code: 0, data: {} }),
  ]) {
    let calls = 0;
    const r = await sendOtpSms(cfg, "77000000000", "123456", (async () => {
      calls++;
      return f();
    }) as typeof fetch);
    assert.deepEqual(r, { state: "UNKNOWN" });
    assert.equal(calls, 1);
  }
});
test("documented validation rejection is explicit", async () => {
  assert.deepEqual(
    await sendOtpSms(cfg, "77000000000", "123456", (async () =>
      Response.json({
        code: 1,
        message: "secret not propagated",
      })) as typeof fetch),
    { state: "REJECTED" },
  );
});
test("invalid phone or OTP never starts paid I/O", async () => {
  let calls = 0;
  const f = (async () => {
    calls++;
    return Response.json({});
  }) as typeof fetch;
  await sendOtpSms(cfg, "79990000000", "123456", f);
  await sendOtpSms(cfg, "77000000000", "12345", f);
  assert.equal(calls, 0);
});
