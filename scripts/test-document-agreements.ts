/** Isolated PostgreSQL integration; all provider calls are explicitly synthetic. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { CurrentMembership } from "../src/lib/tenant";
import {
  documentProfileSchema,
  createDocumentSchema,
} from "../src/lib/documents/schema";
import {
  agreementWorkspace,
  staffAgreement,
  guestAgreement,
  validateAgreementAttachment,
  publicRulesView,
  type GuestAgreementView,
} from "../src/lib/agreements/service";
import { hash } from "../src/lib/agreements/policy";
import type { SmsConfig } from "../src/lib/sms/mobizon";
const url = process.env.TEST_AGREEMENTS_DATABASE_URL;
if (!url || process.env.RUN_AGREEMENTS_DB_TESTS !== "1")
  throw new Error("Explicit disposable database opt-in required");
const location = new URL(url);
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) ||
  !location.pathname.includes("fixture")
)
  throw new Error("Loopback fixture only");
const db = new PrismaClient({ datasources: { db: { url } } });
const prefix = `agreements-fixture-${randomUUID()}`;
const orgIds: string[] = [],
  userIds: string[] = [];
let checks = 0;
async function check(label: string, run: () => Promise<void>) {
  await run();
  checks++;
  console.log(`PASS: ${label}`);
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
  await db.hotel.update({
    where: { id: hotel.id },
    data: { houseRules: "Без курения и вечеринок. Тихий час после 22:00." },
  });
  await db.guest.update({
    where: { id: guest.id },
    data: { phone: "+77000000000" },
  });
  const m: CurrentMembership = { ...member };
  return { org, hotel, user, member, property, reservation, m };
}
async function main() {
  process.env.APP_URL = "https://fixture.example";
  process.env.DOCUMENT_SMS_ENABLED = "true";
  process.env.MOBIZON_API_KEY = "synthetic-no-network-key";
  process.env.MOBIZON_SENDER = "Shanyraq";
  process.env.DOCUMENT_OTP_SECRET =
    "synthetic-test-secret-32-characters-minimum";
  const config: SmsConfig = {
    apiKey: process.env.MOBIZON_API_KEY,
    sender: process.env.MOBIZON_SENDER,
    secret: process.env.DOCUMENT_OTP_SECRET,
  };
  process.env.GUEST_DOCUMENT_BUNDLES_ENABLED = "true";
  process.env.GUEST_PAYMENT_LINKS_ENABLED = "true";
  process.env.DATABASE_URL = url;
  (globalThis as unknown as { prisma: PrismaClient }).prisma = db;
  const { runCommunicationCommand, getReservationCommunicationWorkspace } =
    await import("../src/lib/communications/service");
  const { runPaymentCommand, getPaymentWorkspace } =
    await import("../src/lib/guest-payments/service");
  const a = await seed("A"),
    b = await seed("B");
  const profile = documentProfileSchema.parse({
    entityType: "INDIVIDUAL",
    legalName: "Синтетический владелец",
    iinBin: "000000000000",
    legalAddress: "Тестовый адрес 10",
    signerName: "Тест Владелец",
    signerTitle: "Владелец",
    vatMode: "WITHOUT_VAT",
    defaultPaymentTerms: "По договорённости",
  });
  await db.documentProfile.create({
    data: { organizationId: a.org.id, ...profile },
  });
  const data = createDocumentSchema.parse({
    reservationId: a.reservation.id,
    type: "CONTRACT",
    documentDate: "2026-10-17",
    customerType: "INDIVIDUAL",
    guestFullName: "Синтетический гость",
    guestIin: "000000000000",
    guestIdentityDocument: "Синтетический документ",
    propertyAddress: "Тестовый адрес 10",
    checkIn: "2026-10-17",
    checkOut: "2026-10-20",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    unit: "сутки",
    quantity: 3,
    unitPrice: 25000,
    totalAmount: 75000,
    serviceDescription: "Синтетическое проживание",
    paymentTerms: "По договорённости",
    completionDate: "2026-10-20",
    maxGuests: 2,
    keyLossFine: 0,
  });
  const document = await db.generatedDocument.create({
    data: {
      organizationId: a.org.id,
      hotelId: a.hotel.id,
      reservationId: a.reservation.id,
      createdById: a.user.id,
      type: "CONTRACT",
      sequenceNumber: 1,
      documentNumber: "1",
      documentDate: new Date("2026-10-17Z"),
      snapshot: {
        version: 1,
        type: "CONTRACT",
        documentNumber: "1",
        documentDate: "2026-10-17",
        currency: "KZT",
        city: "Тест",
        hotelName: "Синтетический объект",
        profile,
        data,
      },
    },
  });
  async function create(otp = false) {
    const workspace = await agreementWorkspace(db, a.m, a.reservation.id);
    const command = {
      action: "create" as const,
      reservationId: a.reservation.id,
      requestKey: randomUUID(),
      revision: workspace.revision,
      documents: [{ id: document.id, required: true }],
      depositTerms:
        "Возвратный депозит отдельно — 20 000 KZT, после проверки квартиры.",
      cancellationTerms: "Отмена по согласованным условиям до заезда.",
      guide: "Заселение после 14:00. Свяжитесь с владельцем.",
      ownerName: "Тест Владелец",
      authority: true as const,
      approved: true as const,
      requireOtp: otp,
      expiresInDays: 7,
    };
    const result = (await staffAgreement(db, a.m, command)) as {
      id: string;
      url: string;
      expiresAt: string;
    };
    return { ...result, token: new URL(result.url).hash.slice(1), command };
  }
  const first = await create();
  let view: GuestAgreementView;
  async function load(t = first.token) {
    const result = await guestAgreement(db, { action: "load", token: t });
    assert.equal(result.kind, "json");
    return result.kind === "json"
      ? (result.data as GuestAgreementView)
      : undefined!;
  }
  await check(
    "owner acknowledgement, immutable items and hashes; GET never accepts",
    async () => {
      view = await load();
      assert.equal(view.items.length, 5);
      assert.equal(view.guestAcceptedAt, null);
      assert.equal(view.legalStatus, "NOT_LEGALLY_REVIEWED");
      assert.equal(
        await db.agreementEvent.count({
          where: { bundleId: first.id, action: "OWNER_ACKNOWLEDGED" },
        }),
        1,
      );
      const item = await db.agreementItem.findFirstOrThrow({
        where: { bundleId: first.id, kind: "DOCUMENT" },
      });
      assert.equal(hash(item.pdfBytes!), item.contentHash);
      assert.notEqual(
        (
          await db.agreementBundle.findUniqueOrThrow({
            where: { id: first.id },
          })
        ).tokenHash,
        first.token,
      );
    },
  );
  await check(
    "create replay never creates a second link or exposes stored token",
    async () => {
      const replay = (await staffAgreement(db, a.m, first.command)) as {
        url: null;
      };
      assert.equal(replay.url, null);
      assert.equal(
        await db.agreementBundle.count({
          where: { reservationId: a.reservation.id },
        }),
        1,
      );
    },
  );
  await check("cross-tenant and non-owner actions rejected", async () => {
    await assert.rejects(() =>
      staffAgreement(db, b.m, { ...first.command, requestKey: randomUUID() }),
    );
    await db.membership.update({
      where: { id: a.member.id },
      data: { role: "STAFF" },
    });
    await assert.rejects(() =>
      staffAgreement(db, a.m, {
        action: "evidence",
        reservationId: a.reservation.id,
        bundleId: first.id,
      }),
    );
    await db.membership.update({
      where: { id: a.member.id },
      data: { role: "OWNER" },
    });
  });
  const accept = {
    action: "accept" as const,
    token: first.token,
    bundleHash: view!.bundleHash,
    signerName: "Тест Гость",
    acceptedItems: view!.items.filter((i) => i.required).map((i) => i.id),
    intent: true as const,
    consentVersion: "bundle-acknowledgement-v1" as const,
  };
  await check(
    "each required item, exact version, optional information excluded",
    async () => {
      await assert.rejects(() =>
        guestAgreement(db, {
          ...accept,
          acceptedItems: accept.acceptedItems.slice(1),
        }),
      );
      await assert.rejects(() =>
        guestAgreement(db, { ...accept, bundleHash: "0".repeat(64) }),
      );
      await assert.rejects(() =>
        guestAgreement(db, {
          ...accept,
          acceptedItems: [
            ...accept.acceptedItems,
            view!.items.find((i) => i.kind === "INFORMATION")!.id,
          ],
        }),
      );
    },
  );
  await check(
    "concurrent acceptance is one immutable event; replay is idempotent",
    async () => {
      await Promise.all([
        guestAgreement(db, accept),
        guestAgreement(db, accept),
      ]);
      assert.equal(
        await db.agreementEvent.count({
          where: { bundleId: first.id, action: "GUEST_ACKNOWLEDGED" },
        }),
        1,
      );
      await assert.rejects(() =>
        guestAgreement(db, { ...accept, signerName: "Другой гость" }),
      );
    },
  );
  await check(
    "exact bundle attachment validates; wrong tenant or forged token rejected",
    async () => {
      await validateAgreementAttachment(
        db,
        a.m,
        a.reservation.id,
        first.id,
        `Документы: ${first.url}`,
      );
      await assert.rejects(() =>
        validateAgreementAttachment(
          db,
          b.m,
          a.reservation.id,
          first.id,
          first.url,
        ),
      );
      await assert.rejects(() =>
        validateAgreementAttachment(
          db,
          a.m,
          a.reservation.id,
          first.id,
          first.url.replace(first.token, "0".repeat(64)),
        ),
      );
    },
  );
  await check(
    "combined message prepares PDF bundle, selected photos and authoritative Kaspi text",
    async () => {
      await runPaymentCommand(db, a.m, {
        action: "saveMethod",
        rentalPropertyId: a.property.id,
        name: "Kaspi Pay",
        recipient: "Синтетический получатель",
        url: "https://pay.kaspi.kz/pay/fixture",
        enabled: true,
        version: 0,
      });
      const pw = await getPaymentWorkspace(db, a.m, a.reservation.id);
      const payment = (await runPaymentCommand(db, a.m, {
        action: "prepare",
        reservationId: a.reservation.id,
        revision: pw.revision,
        amount: "25000.00",
        purpose: "PREPAYMENT",
        collectionConfirmed: true,
        locale: "ru",
        key: randomUUID(),
      })) as { id: string; text: string };
      const photo = await db.communicationPhoto.create({
        data: {
          organizationId: a.org.id,
          hotelId: a.hotel.id,
          roomId: a.reservation.roomId,
          name: "synthetic.jpg",
          bytes: new Uint8Array([255, 216, 255, 217]),
        },
      });
      const workspace = await getReservationCommunicationWorkspace(
        a.m,
        a.reservation.id,
      );
      const command = {
        action: "prepare" as const,
        reservationId: a.reservation.id,
        agreementBundleId: first.id,
        paymentRequestId: payment.id,
        revision: workspace.revision,
        photoIds: [photo.id],
        body: `Здравствуйте.\nДокументы: ${first.url}\n\n${payment.text}`,
        requestKey: randomUUID(),
      };
      const prepared = (await runCommunicationCommand(a.m, command)) as {
        text: string;
        photoIds: string[];
      };
      assert.equal(prepared.text, command.body);
      assert.deepEqual(prepared.photoIds, [photo.id]);
      await assert.rejects(() =>
        runCommunicationCommand(a.m, {
          ...command,
          body: command.body + " Другой текст.",
        }),
      );
      await assert.rejects(() =>
        runCommunicationCommand(a.m, {
          ...command,
          requestKey: randomUUID(),
          body: `Здравствуйте. ${first.url}`,
        }),
      );
      await assert.rejects(() =>
        runCommunicationCommand(a.m, {
          ...command,
          requestKey: randomUUID(),
          revision: "0".repeat(64),
        }),
      );
      await db.kaspiPaymentMethod.update({
        where: { rentalPropertyId: a.property.id },
        data: { enabled: false, version: { increment: 1 } },
      });
      await assert.rejects(() => runCommunicationCommand(a.m, command));
    },
  );
  await check(
    "evidence includes exact PDF bytes, owner and guest events without OTP or raw capability",
    async () => {
      const r = await staffAgreement(db, a.m, {
        action: "evidence",
        reservationId: a.reservation.id,
        bundleId: first.id,
      });
      const serialized = JSON.stringify(r);
      assert.ok(serialized.includes("pdfBytes"));
      assert.ok(serialized.includes("OWNER_ACKNOWLEDGED"));
      assert.ok(serialized.includes("GUEST_ACKNOWLEDGED"));
      assert.equal(serialized.includes(first.token), false);
      assert.equal(serialized.includes("codeHash"), false);
    },
  );
  await check(
    "guest phone change invalidates prior consent, evidence remains exportable",
    async () => {
      await db.guest.update({
        where: { id: a.reservation.guestId },
        data: { phone: "+77010000000" },
      });
      await assert.rejects(() => load());
      const w = await agreementWorkspace(db, a.m, a.reservation.id);
      assert.equal(w.bundles[0].state, "OUTDATED");
      await staffAgreement(db, a.m, {
        action: "evidence",
        reservationId: a.reservation.id,
        bundleId: first.id,
      });
    },
  );
  const second = await create(true);
  let code = "",
    sends = 0;
  const deps = {
    config,
    send: async (_c: SmsConfig, _p: string, value: string) => {
      sends++;
      code = value;
      return { state: "ACCEPTED" as const, messageId: "synthetic-1" };
    },
  };
  const secondView = await load(second.token);
  const otp = {
    action: "otp" as const,
    token: second.token,
    bundleHash: secondView.bundleHash,
    requestKey: randomUUID(),
  };
  let challengeId = "";
  await check(
    "paid-send request key concurrency sends once with durable attempt",
    async () => {
      const r = await Promise.all([
        guestAgreement(db, otp, deps),
        guestAgreement(db, otp, deps),
      ]);
      assert.equal(sends, 1);
      challengeId = (
        r[0].kind === "json"
          ? (r[0].data as { challengeId: string })
          : undefined
      )!.challengeId;
      assert.equal(
        await db.agreementOtp.count({ where: { bundleId: second.id } }),
        1,
      );
      const row = await db.agreementOtp.findUniqueOrThrow({
        where: { id: challengeId },
      });
      assert.notEqual(row.codeHash, code);
    },
  );
  const secondAccept = {
    ...accept,
    token: second.token,
    bundleHash: secondView.bundleHash,
    acceptedItems: secondView.items.filter((i) => i.required).map((i) => i.id),
    challengeId,
  };
  await check(
    "OTP cooldown enforced; wrong attempts commit instead of rolling back",
    async () => {
      await assert.rejects(() =>
        guestAgreement(db, { ...otp, requestKey: randomUUID() }, deps),
      );
      for (let i = 0; i < 5; i++)
        await assert.rejects(() =>
          guestAgreement(
            db,
            { ...secondAccept, code: code === "000000" ? "000001" : "000000" },
            deps,
          ),
        );
      assert.equal(
        (
          await db.agreementOtp.findUniqueOrThrow({
            where: { id: challengeId },
          })
        ).attempts,
        5,
      );
      await assert.rejects(() =>
        guestAgreement(db, { ...secondAccept, code }, deps),
      );
    },
  );
  await db.agreementOtp.update({
    where: { id: challengeId },
    data: { createdAt: new Date(Date.now() - 70000) },
  });
  await check(
    "resend invalidates old code; new OTP is consumed once",
    async () => {
      const r = await guestAgreement(
        db,
        { ...otp, requestKey: randomUUID() },
        deps,
      );
      challengeId = (
        r.kind === "json" ? (r.data as { challengeId: string }) : undefined
      )!.challengeId;
      await guestAgreement(db, { ...secondAccept, challengeId, code }, deps);
      assert.ok(
        (
          await db.agreementOtp.findUniqueOrThrow({
            where: { id: challengeId },
          })
        ).consumedAt,
      );
      assert.equal((await load(second.token)).guestName, "Тест Гость");
    },
  );
  const third = await create(true);
  const thirdView = await load(third.token);
  const unknownCmd = {
    action: "otp" as const,
    token: third.token,
    bundleHash: thirdView.bundleHash,
    requestKey: randomUUID(),
  };
  await db.agreementOtp.updateMany({
    where: { bundleId: second.id },
    data: { createdAt: new Date(Date.now() - 70000) },
  });
  await check(
    "ambiguous provider outcome has no automatic retry or acceptance",
    async () => {
      let calls = 0;
      const uncertain = {
        config,
        send: async () => {
          calls++;
          throw new Error("Synthetic timeout");
        },
      };
      await guestAgreement(db, unknownCmd, uncertain);
      await guestAgreement(db, unknownCmd, uncertain);
      assert.equal(calls, 1);
      await assert.rejects(() =>
        guestAgreement(
          db,
          { ...unknownCmd, requestKey: randomUUID() },
          uncertain,
        ),
      );
      const row = await db.agreementOtp.findFirstOrThrow({
        where: { bundleId: third.id },
      });
      assert.equal(row.state, "UNKNOWN");
      await assert.rejects(() =>
        guestAgreement(
          db,
          {
            ...secondAccept,
            token: third.token,
            bundleHash: thirdView.bundleHash,
            acceptedItems: thirdView.items
              .filter((i) => i.required)
              .map((i) => i.id),
            challengeId: row.id,
            code: "123456",
          },
          uncertain,
        ),
      );
    },
  );
  await check(
    "new version revokes old links without deleting old evidence",
    async () => {
      await assert.rejects(() => load(second.token));
      assert.ok(
        await db.agreementEvent.findFirst({
          where: { bundleId: second.id, action: "GUEST_ACKNOWLEDGED" },
        }),
      );
    },
  );
  await check("rules change invalidates active bundle", async () => {
    await db.hotel.update({
      where: { id: a.hotel.id },
      data: { houseRules: "Новые правила проживания. Нельзя курить." },
    });
    await assert.rejects(() => load(third.token));
  });
  const fourth = await create();
  await check("expiry and explicit revocation disable access", async () => {
    await db.agreementBundle.update({
      where: { id: fourth.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    await assert.rejects(() => load(fourth.token));
    await staffAgreement(db, a.m, {
      action: "revoke",
      reservationId: a.reservation.id,
      bundleId: fourth.id,
    });
  });
  await check(
    "cancelled booking cannot accept; owner can still export evidence",
    async () => {
      const next = await create();
      await db.reservation.update({
        where: { id: a.reservation.id },
        data: { status: "CANCELLED" },
      });
      await assert.rejects(() => load(next.token));
      await staffAgreement(db, a.m, {
        action: "evidence",
        reservationId: a.reservation.id,
        bundleId: first.id,
      });
    },
  );
  await check("database blocks cross-hotel bundle foreign keys", async () => {
    const source = await db.agreementBundle.findUniqueOrThrow({
      where: { id: first.id },
    });
    await assert.rejects(() =>
      db.agreementBundle.create({
        data: {
          ...source,
          guestEvidence: undefined,
          id: undefined,
          hotelId: b.hotel.id,
          requestKey: randomUUID(),
          tokenHash: hash(randomUUID()),
        },
      }),
    );
  });
  await db.reservation.update({ where: { id: a.reservation.id }, data: { status: "CONFIRMED" } });
  const beforePublic = await create();
  let ruleId = "";
  await check("only explicit owner publication exposes a minimal public view and invalidates old bundle", async () => {
    await assert.rejects(() => staffAgreement(db, b.m, { action: "publishRules", reservationId: a.reservation.id, text: "Публичные правила без секретов.", version: 0, published: true, publicContentConfirmed: true }));
    const published = await staffAgreement(db, a.m, { action: "publishRules", reservationId: a.reservation.id, text: "Публичные правила: не курить, не шуметь после 22:00.", version: 0, published: true, publicContentConfirmed: true }) as { id: string; url: string };
    ruleId = published.id;
    const publicView = await publicRulesView(db, ruleId);
    assert.deepEqual(Object.keys(publicView!).sort(), ["text","version","updatedAt","propertyName"].sort());
    assert.equal(publicView!.text.includes("Публичные правила"), true);
    await assert.rejects(() => load(beforePublic.token));
    const workspace = await getReservationCommunicationWorkspace(a.m, a.reservation.id);
    assert.equal(workspace.values.rules_link, published.url);
  });
  await check("public rules edits use compare-and-swap and preserve published version history", async () => {
    await assert.rejects(() => staffAgreement(db, a.m, { action: "publishRules", reservationId: a.reservation.id, text: "Другой публичный текст правил.", version: 0, published: true, publicContentConfirmed: true }));
    await staffAgreement(db, a.m, { action: "publishRules", reservationId: a.reservation.id, text: "Новая публичная версия правил без секретов.", version: 1, published: true, publicContentConfirmed: true });
    assert.equal((await publicRulesView(db, ruleId))!.version, 2);
    assert.equal(await db.publicRuleRevision.count({ where: { ruleId } }), 2);
    assert.ok((await db.publicRuleRevision.findUniqueOrThrow({ where: { ruleId_version: { ruleId, version: 1 } } })).text.includes("не курить"));
  });
  await check("unpublish removes public access without deleting prior rules", async () => {
    await staffAgreement(db, a.m, { action: "publishRules", reservationId: a.reservation.id, text: "Новая публичная версия правил без секретов.", version: 2, published: false, publicContentConfirmed: true });
    assert.equal(await publicRulesView(db, ruleId), null);
    assert.equal(await db.publicRuleRevision.count({ where: { ruleId } }), 3);
  });
  console.log(
    `${checks} PostgreSQL integration checks passed. No real SMS sent.`,
  );
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.stack : "TestError");
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const orgId of orgIds) {
      const hotels = await db.hotel.findMany({
        where: { orgId },
        select: { id: true },
      });
      const ids = hotels.map((h) => h.id);
      const bundles = await db.agreementBundle.findMany({
        where: { organizationId: orgId },
        select: { id: true },
      });
      const bIds = bundles.map((b) => b.id);
      await db.agreementOtp.deleteMany({ where: { bundleId: { in: bIds } } });
      await db.agreementEvent.deleteMany({ where: { bundleId: { in: bIds } } });
      await db.agreementItem.deleteMany({ where: { bundleId: { in: bIds } } });
      await db.agreementBundle.deleteMany({ where: { id: { in: bIds } } });
      await db.guestCommunication.deleteMany({
        where: { organizationId: orgId },
      });
      await db.guestPaymentRequest.deleteMany({
        where: { organizationId: orgId },
      });
      await db.publicRuleRevision.deleteMany({ where: { rule: { organizationId: orgId } } });
      await db.publicPropertyRules.deleteMany({ where: { organizationId: orgId } });
      await db.auditLog.deleteMany({ where: { hotelId: { in: ids } } });
      await db.generatedDocument.deleteMany({
        where: { organizationId: orgId },
      });
      await db.reservation.deleteMany({ where: { hotelId: { in: ids } } });
      await db.room.deleteMany({ where: { hotelId: { in: ids } } });
      await db.roomType.deleteMany({ where: { hotelId: { in: ids } } });
      await db.organization.delete({ where: { id: orgId } });
    }
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });
