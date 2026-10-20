import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { accessUntil, DAY_MS, extendAccess, isExpired, reminderKind, TRIAL_MS } from "./policy";
import { amountInMinorUnits, parsePaymentXml, readPaymentFields, safePaymentUrl, signPayment, validSignature } from "./freedompay";
import { billingLaunch } from "./config";
import { PRODUCT_AVAILABILITY } from "@/lib/product-availability";

test("14 days are exactly 336 hours; access closes at the boundary", () => {
  const start = new Date("2026-08-31T13:14:15.000Z");
  const subscription = { trialEndsAt: new Date(start.getTime() + TRIAL_MS), paidUntil: null };
  assert.equal(subscription.trialEndsAt.toISOString(), "2026-09-14T13:14:15.000Z");
  assert.equal(isExpired(subscription, new Date(subscription.trialEndsAt.getTime() - 1)), false);
  assert.equal(isExpired(subscription, subscription.trialEndsAt), true);
});

test("payment retains unused trial time and calendar month boundaries", () => {
  assert.equal(extendAccess(new Date("2028-01-31T12:00:00Z"), 1).toISOString(), "2028-02-29T12:00:00.000Z");
  assert.equal(extendAccess(new Date("2028-02-29T12:00:00Z"), 12).toISOString(), "2029-02-28T12:00:00.000Z");
  const trialEndsAt = new Date("2026-09-14T13:14:15Z");
  assert.equal(accessUntil({ trialEndsAt, paidUntil: new Date("2026-09-01T00:00:00Z") }).getTime(), trialEndsAt.getTime());
});

test("Freedom Pay signature follows the published ordered-message example and binds every field", () => {
  const fields = { pg_order_id: "23", pg_merchant_id: "123", pg_amount: "25", pg_description: "test", pg_salt: "molbulak" };
  const expected = createHash("md5").update("init_payment.php;25;test;123;23;molbulak;test-secret").digest("hex");
  const pg_sig = signPayment("init_payment.php", fields, "test-secret");
  assert.equal(pg_sig, expected);
  assert.equal(validSignature("init_payment.php", { ...fields, pg_sig }, "test-secret"), true);
  assert.equal(validSignature("result", { ...fields, pg_sig }, "test-secret"), false);
  assert.equal(validSignature("init_payment.php", { ...fields, pg_amount: "1", pg_sig }, "test-secret"), false);
  assert.equal(validSignature("init_payment.php", { ...fields, pg_sig: "" }, "test-secret"), false);
});

test("amount parsing never rounds mismatched amounts or accepts exponent notation", () => {
  assert.equal(amountInMinorUnits("9900.00"), 990000);
  assert.equal(amountInMinorUnits("9900.1"), 990010);
  for (const input of ["9900.001", "9.9e3", "-9900", "9900junk", "NaN", ""]) assert.equal(amountInMinorUnits(input), null);
});

test("XML response parser rejects duplicate fields, nested XML and external entities", () => {
  assert.equal(parsePaymentXml('<?xml version="1.0"?><response><pg_redirect_url>https://api.freedompay.kz/pay?a=1&amp;b=2</pg_redirect_url></response>').pg_redirect_url, "https://api.freedompay.kz/pay?a=1&b=2");
  for (const xml of ['<!DOCTYPE response><response></response>', '<response><pg_status>ok</pg_status><pg_status>error</pg_status></response>', '<response><pg_status><nested>ok</nested></pg_status></response>']) assert.throws(() => parsePaymentXml(xml));
});

test("redirects only go to HTTPS Freedom Pay domains", () => {
  assert.equal(safePaymentUrl("https://api.freedompay.kz/pay.html"), "https://api.freedompay.kz/pay.html");
  for (const url of ["http://api.freedompay.kz/pay", "https://freedompay.kz.evil.example", "https://evilfreedompay.kz", "https://user:secret@api.freedompay.kz/pay", "javascript:alert(1)"]) assert.throws(() => safePaymentUrl(url));
});

test("callbacks reject duplicate or oversized form fields", async () => {
  const request = (body: string) => new Request("https://example.com/api/billing/freedompay/result", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  await assert.rejects(readPaymentFields(request("pg_amount=1&pg_amount=2")));
  await assert.rejects(readPaymentFields(request(`pg_description=${"a".repeat(33_000)}`)));
});

test("reminder windows and disabled-by-default rollout", () => {
  const now = new Date("2026-08-31T00:00:00Z");
  assert.equal(reminderKind(new Date(now.getTime() + 4 * DAY_MS), now), null);
  assert.equal(reminderKind(new Date(now.getTime() + 3 * DAY_MS), now), "three-days");
  assert.equal(reminderKind(new Date(now.getTime() + DAY_MS), now), "one-day");
  assert.equal(reminderKind(now, now), "expired");
  const enabled = process.env.BILLING_ENABLED;
  try { delete process.env.BILLING_ENABLED; assert.equal(billingLaunch(), null); }
  finally { if (enabled !== undefined) process.env.BILLING_ENABLED = enabled; }
});

test("PostgreSQL: forged, duplicate, concurrent and test payment confirmations", { skip: process.env.BILLING_DB_TESTS !== "true" }, async () => {
  const { db } = await import("@/lib/db");
  const { applyPaymentResult, getSubscription, assertBillingWriteAccess } = await import("./service");
  const { handlePaymentCallback } = await import("./callback");
  const previous = Object.fromEntries(["BILLING_ENABLED", "BILLING_START_AT", "FREEDOMPAY_MODE", "FREEDOMPAY_MERCHANT_ID", "FREEDOMPAY_SECRET_KEY", "APP_URL"].map((key) => [key, process.env[key]]));
  Object.assign(process.env, { BILLING_ENABLED: "true", BILLING_START_AT: new Date(Date.now() - DAY_MS).toISOString(), FREEDOMPAY_MODE: "live", FREEDOMPAY_MERCHANT_ID: "123", FREEDOMPAY_SECRET_KEY: "local-test-secret-not-a-provider-key", APP_URL: "https://example.com" });
  // Exercise the future provider path only in this isolated test worker.
  // Production closed-beta billing remains disabled in product-availability.ts.
  const billingDescriptor = Object.getOwnPropertyDescriptor(PRODUCT_AVAILABILITY, "billing")!;
  Object.defineProperty(PRODUCT_AVAILABILITY, "billing", { ...billingDescriptor, value: true });
  const organizationId = `billing-test-${randomUUID()}`;
  let created = false;
  try {
    await db.organization.create({ data: { id: organizationId, name: "Automated billing check" } });
    created = true;
    const trial = await getSubscription(organizationId);
    assert.ok(trial);
    assert.equal(trial.trialEndsAt.getTime() - trial.trialStartsAt.getTime(), TRIAL_MS);
    assert.equal((await getSubscription(organizationId))?.trialEndsAt.getTime(), trial.trialEndsAt.getTime());
    await db.billingSubscription.update({ where: { organizationId }, data: { trialEndsAt: new Date(Date.now() - 1) } });
    await assert.rejects(assertBillingWriteAccess(organizationId));
    const end = new Date(Date.now() + TRIAL_MS);
    await db.billingSubscription.update({ where: { organizationId }, data: { trialEndsAt: end } });
    const order = await db.billingPayment.create({ data: { organizationId, planId: "start", months: 1, amountMinor: 990000, testMode: false, status: "PENDING", providerPaymentId: `test-${randomUUID()}`, expiresAt: end } });
    const fields = { pg_order_id: order.id, pg_payment_id: order.providerPaymentId!, pg_amount: "9900.00", pg_currency: "KZT", pg_testing_mode: "0", pg_result: "1", pg_payment_method: "bankcard", pg_captured: "1" };
    const invalidCallback = await handlePaymentCallback(new Request("https://example.com/api/billing/freedompay/result", { method: "POST", body: new URLSearchParams({ ...fields, pg_salt: "test", pg_sig: "0".repeat(32) }) }), "result");
    assert.equal(invalidCallback.status, 403);
    for (const mismatch of [{ pg_amount: "1" }, { pg_currency: "USD" }, { pg_testing_mode: "1" }, { pg_payment_id: "other" }, { pg_captured: "0" }]) await assert.rejects(applyPaymentResult({ ...fields, ...mismatch }));
    const before = await db.billingSubscription.findUniqueOrThrow({ where: { organizationId } });
    assert.equal(before.paidUntil, null);
    await Promise.all(Array.from({ length: 4 }, () => applyPaymentResult(fields)));
    const paid = await db.billingSubscription.findUniqueOrThrow({ where: { organizationId } });
    assert.equal(paid.paidUntil?.toISOString(), extendAccess(end, 1).toISOString());
    const signed = { ...fields, pg_salt: "test", pg_sig: "" };
    signed.pg_sig = signPayment("result", signed, process.env.FREEDOMPAY_SECRET_KEY!);
    const duplicateCallback = await handlePaymentCallback(new Request("https://example.com/api/billing/freedompay/result", { method: "POST", body: new URLSearchParams(signed) }), "result");
    assert.equal(duplicateCallback.status, 200);
    await applyPaymentResult({ ...fields, pg_result: "0" });
    assert.equal((await db.billingPayment.findUniqueOrThrow({ where: { id: order.id } })).status, "SUCCEEDED");
    const testOrder = await db.billingPayment.create({ data: { organizationId, planId: "business", months: 12, amountMinor: 39900000, testMode: true, status: "PENDING", providerPaymentId: `test-${randomUUID()}`, expiresAt: end } });
    await applyPaymentResult({ ...fields, pg_order_id: testOrder.id, pg_payment_id: testOrder.providerPaymentId!, pg_amount: "399000", pg_testing_mode: "1" });
    assert.equal((await db.billingSubscription.findUniqueOrThrow({ where: { organizationId } })).paidUntil?.toISOString(), paid.paidUntil?.toISOString());
  } finally {
    Object.defineProperty(PRODUCT_AVAILABILITY, "billing", billingDescriptor);
    // Only the exact temporary tenant created above is removed; customer data is never selected or edited.
    if (created) await db.organization.delete({ where: { id: organizationId } });
    await db.$disconnect();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
