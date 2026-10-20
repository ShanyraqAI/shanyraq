import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { effectiveSubscription, type ManualGrant } from "./effective";

const now = new Date("2026-10-20T00:00:00Z");
const before = new Date("2026-10-19T00:00:00Z");
const after = new Date("2026-11-20T00:00:00Z");
const expired = { trialEndsAt: before, paidUntil: null, planId: null };
const grant = (planId = "start"): ManualGrant => ({ planId, startsAt: before, endsAt: after });

test("manual grant enables writes independently of expired online billing", () => {
  assert.equal(effectiveSubscription(expired, [grant()], now).writeAllowed, true);
  assert.equal(effectiveSubscription(expired, [], now).writeAllowed, false);
});
test("paid subscription survives absent or cancelled grants", () => {
  const paid = { ...expired, paidUntil: after, planId: "pro" };
  assert.equal(effectiveSubscription(paid, [], now).writeAllowed, true);
  assert.equal(effectiveSubscription(paid, [{ ...grant(), endsAt: now }], now).roomLimit, 15);
});
test("grant starts are inclusive, ends are exclusive; future renewals cannot upgrade early", () => {
  assert.equal(effectiveSubscription(expired, [{ ...grant(), startsAt: now }], now).manualActive, true);
  assert.equal(effectiveSubscription(expired, [{ ...grant(), endsAt: now }], now).writeAllowed, false);
  assert.equal(effectiveSubscription(expired, [{ ...grant("business"), startsAt: after }], now).writeAllowed, false);
});
test("overlap retains the larger active capacity, not a sum and not the expired plan", () => {
  const paid = { ...expired, paidUntil: after, planId: "pro" };
  assert.equal(effectiveSubscription(paid, [grant()], now).roomLimit, 15);
  assert.equal(effectiveSubscription(paid, [grant("business")], now).roomLimit, 50);
  assert.equal(effectiveSubscription({ ...paid, paidUntil: before }, [grant()], now).roomLimit, 3);
  assert.equal(effectiveSubscription(expired, [grant(), grant("pro")], now).roomLimit, 15);
});
test("access deadline is the latest independently active grant/trial/paid deadline", () => {
  const paid = { ...expired, paidUntil: new Date("2026-12-20"), planId: "pro" };
  assert.equal(effectiveSubscription(paid, [grant()], now).endsAt?.getTime(), paid.paidUntil.getTime());
  assert.equal(effectiveSubscription({ ...expired, trialEndsAt: after }, [], now).trialActive, true);
  assert.equal(effectiveSubscription(null, [], now).writeAllowed, true);
  assert.equal(effectiveSubscription(null, [], now).unrestricted, true);
});

test("PostgreSQL: manual write access, independent paid capacity and grant-only cancellation", { skip: process.env.BILLING_DB_TESTS !== "true" }, async () => {
  const target = new URL(process.env.DATABASE_URL ?? "invalid:");
  assert.ok(["postgres:", "postgresql:"].includes(target.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) && decodeURIComponent(target.pathname).endsWith("_test"), "Only a loopback disposable test database is allowed");
  const { db } = await import("@/lib/db");
  const { PRODUCT_AVAILABILITY } = await import("@/lib/product-availability");
  const { getSubscription, getEffectiveSubscription, assertBillingWriteAccess, assertRoomCapacity } = await import("@/lib/billing/service");
  const { grantSubscription, endSubscription } = await import("./grant");
  const { handleCommand } = await import("@/lib/telegram-admin/bot");
  const { executeTelegramUpdate } = await import("@/lib/telegram-admin/inbox");
  const updateId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const keys = ["BILLING_ENABLED", "BILLING_START_AT", "FREEDOMPAY_MODE", "FREEDOMPAY_MERCHANT_ID", "FREEDOMPAY_SECRET_KEY", "APP_URL"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const descriptor = Object.getOwnPropertyDescriptor(PRODUCT_AVAILABILITY, "billing")!;
  Object.defineProperty(PRODUCT_AVAILABILITY, "billing", { ...descriptor, value: true });
  Object.assign(process.env, { BILLING_ENABLED: "true", BILLING_START_AT: new Date(Date.now() - 86400000).toISOString(), FREEDOMPAY_MODE: "live", FREEDOMPAY_MERCHANT_ID: "123", FREEDOMPAY_SECRET_KEY: "synthetic-local-policy-test", APP_URL: "https://example.invalid" });
  const id = `entitlement-test-${randomUUID()}`;
  let created = false;
  try {
    await db.organization.create({ data: { id, name: "Synthetic entitlement test" } }); created = true;
    await db.hotel.create({ data: { id, orgId: id, slug: id, name: "Synthetic hotel" } });
    const property = await db.rentalProperty.create({ data: { hotelId: id, organizationId: id, internalName: "Synthetic", publicName: "Synthetic", inventoryMode: "GROUPED_UNITS" } });
    const roomType = await db.roomType.create({ data: { hotelId: id, rentalPropertyId: property.id, name: "Synthetic", capacity: 2, basePrice: 1 } });
    await db.room.createMany({ data: ["1", "2", "3"].map(number => ({ hotelId: id, rentalPropertyId: property.id, roomTypeId: roomType.id, number })) });
    await getSubscription(id);
    await db.billingSubscription.update({ where: { organizationId: id }, data: { trialEndsAt: new Date(0) } });
    await assert.rejects(assertBillingWriteAccess(id));
    await grantSubscription({ organizationId: id, planId: "business", months: 1 });
    await assertBillingWriteAccess(id);
    await db.$transaction(tx => assertRoomCapacity(tx, id, 47));
    await assert.rejects(db.$transaction(tx => assertRoomCapacity(tx, id, 48)));
    await db.billingSubscription.update({ where: { organizationId: id }, data: { paidUntil: new Date(Date.now() + 86400000), planId: "start" } });
    const paid = await db.billingSubscription.findUniqueOrThrow({ where: { organizationId: id } });
    // Future queued grants are cancelled too, but cannot supply a premature plan upgrade.
    await db.subscriptionGrant.create({ data: { organizationId: id, planId: "business", months: 1, startsAt: new Date(Date.now() + 86400000), endsAt: new Date(Date.now() + 86400000 * 60) } });
    const replies = await Promise.all(Array.from({ length: 6 }, () =>
      executeTelegramUpdate(db, updateId, [id, "/end"], tx => handleCommand(`/end ${id}`, "synthetic-policy-test", tx))));
    assert.ok(replies.every(reply => reply === replies[0] && reply.includes("Оплаченная подписка не изменена")));
    assert.equal(await db.telegramCommandReceipt.count({ where: { updateId: BigInt(updateId) } }), 1);
    await endSubscription(id); // duplicate cancellation is harmless
    assert.deepEqual(await db.billingSubscription.findUniqueOrThrow({ where: { organizationId: id } }), paid);
    assert.equal(await db.subscriptionGrant.count({ where: { organizationId: id, endsAt: { gt: new Date() } } }), 0);
    await assertBillingWriteAccess(id);
    assert.equal((await getEffectiveSubscription(id)).roomLimit, 3);
    await assert.rejects(db.$transaction(tx => assertRoomCapacity(tx, id, 1)));
    await db.billingSubscription.update({ where: { organizationId: id }, data: { paidUntil: new Date(0) } });
    await assert.rejects(assertBillingWriteAccess(id));
    // Rollout kill switch is preserved; manual expiry cannot turn beta billing on.
    Object.defineProperty(PRODUCT_AVAILABILITY, "billing", { ...descriptor, value: false });
    await assertBillingWriteAccess(id);
  } finally {
    Object.defineProperty(PRODUCT_AVAILABILITY, "billing", descriptor);
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await db.telegramCommandReceipt.deleteMany({ where: { updateId: BigInt(updateId) } });
    if (created) await db.organization.delete({ where: { id } });
    await db.$disconnect();
  }
});
