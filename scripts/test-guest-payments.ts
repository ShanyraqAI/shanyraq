/** Run only against a disposable database with the current reviewed schema already applied. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  getPaymentSettings,
  getPaymentWorkspace,
  runPaymentCommand,
} from "../src/lib/guest-payments/service";
import type { CurrentMembership } from "../src/lib/tenant";
import type {
  PaymentMethodView,
  PreparedPayment,
} from "../src/lib/guest-payments/types";
const url = process.env.TEST_GUEST_PAYMENT_DATABASE_URL;
if (!url || process.env.RUN_GUEST_PAYMENT_DB_TESTS !== "1")
  throw new Error(
    "Set TEST_GUEST_PAYMENT_DATABASE_URL and RUN_GUEST_PAYMENT_DB_TESTS=1 for an isolated test DB.",
  );
const parsed = new URL(url);
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) ||
  !parsed.pathname.includes("fixture")
)
  throw new Error("Only a loopback disposable fixture database is permitted.");
const db = new PrismaClient({ datasources: { db: { url } } });
const prefix = `payment-test-${randomUUID()}`;
const orgIds: string[] = [],
  userIds: string[] = [];
let checks = 0;
async function check(name: string, work: () => Promise<void>) {
  await work();
  console.log(`PASS: ${name}`);
  checks++;
}
async function seed(label: string) {
  const org = await db.organization.create({
    data: { name: `${prefix}-${label}` },
  });
  orgIds.push(org.id);
  const hotel = await db.hotel.create({
    data: { orgId: org.id, name: label, slug: `${prefix}-${label}` },
  });
  const user = await db.user.create({
    data: { fullName: `${prefix}-${label}` },
  });
  userIds.push(user.id);
  const member = await db.membership.create({
    data: {
      organizationId: org.id,
      hotelId: hotel.id,
      userId: user.id,
      role: "OWNER",
    },
  });
  const property = await db.rentalProperty.create({
    data: {
      organizationId: org.id,
      hotelId: hotel.id,
      internalName: label,
      publicName: label,
      inventoryMode: "SINGLE_UNIT",
    },
  });
  const roomType = await db.roomType.create({
    data: {
      hotelId: hotel.id,
      rentalPropertyId: property.id,
      name: label,
      capacity: 2,
      basePrice: "25000",
    },
  });
  const room = await db.room.create({
    data: {
      hotelId: hotel.id,
      rentalPropertyId: property.id,
      roomTypeId: roomType.id,
      number: "102",
    },
  });
  const guest = await db.guest.create({
    data: { hotelId: hotel.id, fullName: "Синтетический гость" },
  });
  const reservation = await db.reservation.create({
    data: {
      hotelId: hotel.id,
      rentalPropertyId: property.id,
      roomTypeId: roomType.id,
      roomId: room.id,
      guestId: guest.id,
      sequenceNumber: 1,
      sourceChannel: "direct",
      checkIn: new Date("2026-10-17Z"),
      checkOut: new Date("2026-10-20Z"),
      totalAmount: "75000",
      depositAmount: "20000",
      paymentCollect: "property",
    },
  });
  const m: CurrentMembership = { ...member };
  return { org, hotel, user, member, property, reservation, m };
}
async function main() {
  const a = await seed("A"),
    b = await seed("B");
  const save = {
    action: "saveMethod" as const,
    rentalPropertyId: a.property.id,
    name: "Kaspi Pay",
    recipient: "Тестовый получатель",
    url: "https://pay.kaspi.kz/pay/fixture_A",
    enabled: true,
    version: 0,
  };
  let method: PaymentMethodView;
  await check(
    "owner saves exact object link and audit atomically",
    async () => {
      method = (await runPaymentCommand(db, a.m, save)) as PaymentMethodView;
      assert.equal(method.version, 1);
      assert.equal(
        await db.auditLog.count({
          where: { hotelId: a.hotel.id, action: "guest_payment.method_saved" },
        }),
        1,
      );
    },
  );
  await check(
    "tenant cannot read reservation or change foreign property",
    async () => {
      await assert.rejects(() =>
        getPaymentWorkspace(db, b.m, a.reservation.id),
      );
      await assert.rejects(() => runPaymentCommand(db, b.m, save));
      assert.equal((await getPaymentSettings(db, b.m)).methods.length, 0);
    },
  );
  await check("stale config version rejects lost update", async () => {
    await assert.rejects(() => runPaymentCommand(db, a.m, save));
  });
  await check(
    "server rereads role instead of trusting supplied OWNER",
    async () => {
      await db.membership.update({
        where: { id: a.member.id },
        data: { role: "STAFF", accessLevel: "OVERVIEW", permissions: [] },
      });
      await assert.rejects(() =>
        getPaymentWorkspace(db, a.m, a.reservation.id),
      );
      await assert.rejects(() =>
        runPaymentCommand(db, a.m, { ...save, version: 1 }),
      );
      await db.membership.update({
        where: { id: a.member.id },
        data: { role: "OWNER" },
      });
    },
  );
  const ledger = {
    organizationId: a.org.id,
    hotelId: a.hotel.id,
    rentalPropertyId: a.property.id,
    reservationId: a.reservation.id,
    currency: "KZT",
    occurredAt: new Date(),
    method: "BANK_TRANSFER",
    source: "MANUAL",
    status: "COMPLETED",
  };
  await db.financialOperation.createMany({
    data: [
      { ...ledger, type: "PAYMENT", amount: "30000.10" },
      { ...ledger, type: "REFUND", amount: "5000.05" },
      { ...ledger, type: "PAYMENT", amount: "1000", status: "PENDING" },
      { ...ledger, type: "PAYMENT", amount: "1000", currency: "USD" },
      { ...ledger, type: "EXPENSE", amount: "1000" },
    ],
  });
  let w = await getPaymentWorkspace(db, a.m, a.reservation.id);
  await check(
    "real ledger/refunds determine remaining, deposit stays separate",
    async () => {
      assert.equal(w.remaining, "49999.95");
      assert.equal(w.deposit, "20000.00");
      assert.equal(w.paid, "30000.10");
      assert.equal(w.refunded, "5000.05");
    },
  );
  const command = {
    action: "prepare" as const,
    reservationId: a.reservation.id,
    revision: w.revision,
    amount: "10000",
    purpose: "PREPAYMENT" as const,
    collectionConfirmed: false,
    locale: "ru" as const,
    key: randomUUID(),
  };
  let request: PreparedPayment;
  await check(
    "parallel same-key retries and new-key duplicate converge to one request",
    async () => {
      const responses = await Promise.all([
        runPaymentCommand(db, a.m, command),
        runPaymentCommand(db, a.m, command),
        runPaymentCommand(db, a.m, { ...command, key: randomUUID() }),
      ]);
      request = responses[0] as PreparedPayment;
      assert.ok(responses.every((r) => r.id === request.id));
      assert.equal(
        await db.guestPaymentRequest.count({ where: { hotelId: a.hotel.id } }),
        1,
      );
      assert.equal(
        await db.auditLog.count({
          where: {
            hotelId: a.hotel.id,
            action: "guest_payment.request_prepared",
          },
        }),
        1,
      );
    },
  );
  await check(
    "prepare/validate never create a payment or alter deposit",
    async () => {
      await runPaymentCommand(db, a.m, { action: "validate", id: request.id });
      assert.equal(
        await db.financialOperation.count({ where: { hotelId: a.hotel.id } }),
        5,
      );
      assert.equal(
        (
          await db.reservation.findUniqueOrThrow({
            where: { id: a.reservation.id },
          })
        ).depositAmount.toFixed(2),
        "20000.00",
      );
    },
  );
  await check("key reuse with a different amount rejected", async () => {
    await assert.rejects(() =>
      runPaymentCommand(db, a.m, { ...command, amount: "11000" }),
    );
  });
  await check("cross-tenant request validation blocked", async () => {
    await assert.rejects(() =>
      runPaymentCommand(db, b.m, { action: "validate", id: request.id }),
    );
  });
  await check(
    "actual payment invalidates prepared copy/share and stale client revision",
    async () => {
      await db.financialOperation.create({
        data: { ...ledger, type: "PAYMENT", amount: "10000" },
      });
      await assert.rejects(() =>
        runPaymentCommand(db, a.m, { action: "validate", id: request.id }),
      );
      await assert.rejects(() =>
        runPaymentCommand(db, a.m, { ...command, key: randomUUID() }),
      );
      assert.equal(
        (await getPaymentWorkspace(db, a.m, a.reservation.id)).history[0].stale,
        true,
      );
    },
  );
  w = await getPaymentWorkspace(db, a.m, a.reservation.id);
  await check(
    "invalid amount transaction leaves no receipt or audit",
    async () => {
      const key = randomUUID();
      await assert.rejects(() =>
        runPaymentCommand(db, a.m, {
          ...command,
          revision: w.revision,
          amount: "999999",
          key,
        }),
      );
      assert.equal(await db.operationReceipt.count({ where: { key } }), 0);
      assert.equal(
        await db.guestPaymentRequest.count({ where: { hotelId: a.hotel.id } }),
        1,
      );
    },
  );
  await check("configuration change invalidates handoff", async () => {
    const fresh = (await runPaymentCommand(db, a.m, {
      ...command,
      revision: w.revision,
      key: randomUUID(),
    })) as PreparedPayment;
    await runPaymentCommand(db, a.m, { ...save, version: 1, enabled: false });
    await assert.rejects(() =>
      runPaymentCommand(db, a.m, { action: "validate", id: fresh.id }),
    );
  });
  await check(
    "revoked membership cannot replay an existing operation receipt",
    async () => {
      await db.membership.delete({ where: { id: a.member.id } });
      await assert.rejects(() => runPaymentCommand(db, a.m, command));
    },
  );
  await check(
    "database composite foreign keys prevent crossing hotel/property",
    async () => {
      await assert.rejects(() =>
        db.kaspiPaymentMethod.create({
          data: {
            organizationId: b.org.id,
            hotelId: b.hotel.id,
            rentalPropertyId: a.property.id,
            name: "x",
            recipient: "x",
            url: save.url,
          },
        }),
      );
    },
  );
  console.log(
    `${checks} database integration checks passed; synthetic data only.`,
  );
}
main()
  .finally(async () => {
    // Delete only fixtures created by this run, never a reset or a blanket table delete.
    for (const orgId of orgIds) {
      const hotels = await db.hotel.findMany({
        where: { orgId },
        select: { id: true },
      });
      const ids = hotels.map((h) => h.id);
      await db.operationReceipt.deleteMany({ where: { hotelId: { in: ids } } });
      await db.guestPaymentRequest.deleteMany({
        where: { hotelId: { in: ids } },
      });
      await db.reservation.deleteMany({ where: { hotelId: { in: ids } } });
      await db.room.deleteMany({ where: { hotelId: { in: ids } } });
      await db.roomType.deleteMany({ where: { hotelId: { in: ids } } });
      await db.organization.delete({ where: { id: orgId } });
    }
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.name : "TestError");
    process.exitCode = 1;
  });
