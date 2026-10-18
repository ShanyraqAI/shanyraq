/** Real disposable PostgreSQL tests; no production/provider connections. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { catalogView, catalogPhoto } from "../src/lib/guest-stay/catalog";
import {
  staffStay,
  guestStayView,
  guestStayCommand,
  stayWorkspace,
} from "../src/lib/guest-stay/service";
import { unseal, hash, formInput } from "../src/lib/guest-stay/policy";
import { addDays, todayInTimeZone, toISODate } from "../src/lib/dates";
import type { CurrentMembership } from "../src/lib/tenant";
import {
  agreementWorkspace,
  staffAgreement,
} from "../src/lib/agreements/service";
import {
  documentProfileSchema,
  createDocumentSchema,
} from "../src/lib/documents/schema";
const url = process.env.DATABASE_URL;
if (!url || process.env.RUN_GUEST_STAY_DB_TESTS !== "1")
  throw new Error("Explicit disposable test opt-in required");
const parsed = new URL(url);
if (
  !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
  !parsed.pathname.includes("fixture")
)
  throw new Error("Loopback fixture DB required");
const db = new PrismaClient({ log: [] });
process.env.PUBLIC_CATALOG_ENABLED = "true";
process.env.GUEST_STAY_ENABLED = "true";
process.env.GUEST_DOCUMENT_BUNDLES_ENABLED = "true";
process.env.APP_URL ||= "http://localhost:3000";
process.env.GUEST_STAY_SECRET ||= randomBytes(32).toString("hex");
const prefix = `stay-fixture-${randomUUID()}`;
const arrival = addDays(todayInTimeZone("Asia/Almaty"), 10),
  departure = addDays(arrival, 3);
const dates = { checkIn: toISODate(arrival), checkOut: toISODate(departure) };
let checks = 0;
async function check(label: string, fn: () => Promise<void>) {
  console.log(`RUN: ${label}`);
  await fn();
  console.log(`PASS: ${label}`);
  checks++;
}
async function seed(label: string, mode: "SINGLE_UNIT" | "GROUPED_UNITS") {
  const org = await db.organization.create({
    data: { name: `${prefix}-${label}` },
  });
  const hotel = await db.hotel.create({
    data: {
      orgId: org.id,
      name: label,
      slug: `${prefix}-${label}`,
      houseRules: "Без курения и вечеринок. Тишина после 22:00.",
    },
  });
  const user = await db.user.create({
    data: { fullName: "Тест Владелец", onboardingCompleted: true },
  });
  const member = await db.membership.create({
    data: {
      organizationId: org.id,
      hotelId: hotel.id,
      userId: user.id,
      role: "OWNER",
    },
  });
  const m: CurrentMembership = { ...member };
  const property = await db.rentalProperty.create({
    data: {
      organizationId: org.id,
      hotelId: hotel.id,
      publicName: "Тестовый объект с очень длинным названием " + "А".repeat(80),
      internalName: "PRIVATE_INTERNAL_NAME",
      inventoryMode: mode,
      address: "PRIVATE_ADDRESS_25",
    },
  });
  const type = await db.roomType.create({
    data: {
      hotelId: hotel.id,
      rentalPropertyId: property.id,
      name: label,
      capacity: 4,
      basePrice: 20000,
    },
  });
  const room = await db.room.create({
    data: {
      hotelId: hotel.id,
      rentalPropertyId: property.id,
      roomTypeId: type.id,
      number: "101",
    },
  });
  const secondRoom =
    mode === "GROUPED_UNITS"
      ? await db.room.create({
          data: {
            hotelId: hotel.id,
            rentalPropertyId: property.id,
            roomTypeId: type.id,
            number: "102",
          },
        })
      : room;
  const guest = await db.guest.create({
    data: {
      hotelId: hotel.id,
      fullName: "Доверенное Имя",
      phone: "+77011234567",
      notes: "PRIVATE_GUEST_NOTES",
    },
  });
  const reservation = await db.reservation.create({
    data: {
      hotelId: hotel.id,
      rentalPropertyId: property.id,
      roomId: room.id,
      roomTypeId: type.id,
      guestId: guest.id,
      checkIn: arrival,
      checkOut: departure,
      sourceChannel: "direct",
      totalAmount: 60000,
      depositAmount: 10000,
    },
  });
  const ratePlan = await db.ratePlan.create({
    data: {
      hotelId: hotel.id,
      rentalPropertyId: property.id,
      roomTypeId: type.id,
      name: "Опубликованный тариф",
      basePrice: 20000,
    },
  });
  await db.communicationProfile.create({
    data: {
      organizationId: org.id,
      hotelId: hotel.id,
      roomId: room.id,
      address: "PRIVATE_ADDRESS_25",
      keyInstructions: "DOOR_SECRET_FIXTURE_1234",
      wifiName: "WIFI_NAME_FIXTURE",
      wifiPassword: "WIFI_SECRET_FIXTURE",
      mapLink: "javascript:alert(1)",
      supportPhone: "+77015550000",
    },
  });
  // Reuse a real app image as bytes; no public blob URL.
  const { readFile } = await import("node:fs/promises");
  const sharp = (await import("sharp")).default;
  const bytes = await sharp(await readFile("public/icons/shanyraq-192.png"))
    .jpeg()
    .toBuffer();
  const photo = await db.communicationPhoto.create({
    data: {
      organizationId: org.id,
      hotelId: hotel.id,
      roomId: room.id,
      name: "Вход",
      contentType: "image/jpeg",
      bytes,
    },
  });
  return {
    org,
    hotel,
    user,
    m,
    property,
    type,
    room,
    secondRoom,
    guest,
    reservation,
    ratePlan,
    photo,
  };
}
async function main() {
  const a = await seed("A", "GROUPED_UNITS"),
    b = await seed("B", "SINGLE_UNIT");
  const listing = {
    title: "Публичная квартира " + "ДлинноеНазвание".repeat(7),
    description: "Только разрешённое описание. <script>alert('XSS')</script>",
    publicLocation: "Район без точного адреса",
    amenities: "Кухня, кондиционер",
    restrictions: "Без вечеринок",
    contactUrl: "https://wa.me/77010000000",
    photoIds: [a.photo.id],
    ratePlanId: a.ratePlan.id,
    published: false,
    publicContentConfirmed: true as const,
  };
  const createListing = () =>
    staffStay(db, a.m, {
      action: "saveListing",
      roomId: a.room.id,
      version: 0,
      listing,
    });
  await check(
    "unpublished units and direct IDs are not publicly visible",
    async () => {
      await createListing();
      assert.equal((await catalogView(db, a.hotel.slug)).cards.length, 0);
    },
  );
  let l = await db.catalogListing.findUniqueOrThrow({
    where: { roomId: a.room.id },
  });
  await check(
    "unpublished photo preview requires this tenant's live OWNER",
    async () => {
      assert.equal(await catalogPhoto(db, l.id, 0), null);
      assert(await catalogPhoto(db, l.id, 0, a.m));
      assert.equal(await catalogPhoto(db, l.id, 0, b.m), null);
      await assert.rejects(catalogPhoto(db, l.id, 0, { ...a.m, id: "forged" }));
    },
  );
  await check(
    "only owner of this tenant can publish; photo ownership validated",
    async () => {
      await assert.rejects(
        staffStay(db, b.m, {
          action: "saveListing",
          roomId: a.room.id,
          version: 1,
          listing,
        }),
      );
      await assert.rejects(
        staffStay(db, a.m, {
          action: "saveListing",
          roomId: a.room.id,
          version: 1,
          listing: { ...listing, photoIds: [b.photo.id] },
        }),
      );
    },
  );
  await staffStay(db, a.m, {
    action: "saveListing",
    roomId: a.room.id,
    version: 1,
    listing: { ...listing, published: true },
  });
  l = await db.catalogListing.findUniqueOrThrow({
    where: { roomId: a.room.id },
  });
  await check(
    "public DTO whitelist excludes all guest/booking/internal/access values",
    async () => {
      const json = JSON.stringify(await catalogView(db, a.hotel.slug));
      for (const v of [
        "PRIVATE_ADDRESS",
        "DOOR_SECRET",
        "WIFI_SECRET",
        "PRIVATE_GUEST",
        "PRIVATE_INTERNAL",
        a.guest.id,
        a.reservation.id,
        a.room.id,
        a.org.id,
      ])
        assert(!json.includes(v));
    },
  );
  await check(
    "whole-period availability detects a booking in grouped inventory's selected unit",
    async () => {
      const v = await catalogView(db, a.hotel.slug, l.id, {
        ...dates,
        guests: 2,
      });
      assert.equal(v.cards[0].availability, "UNAVAILABLE");
      assert.equal(v.cards[0].price?.total, 60000);
    },
  );
  await check(
    "catalog read does not create bookings, stays or agreement events",
    async () => {
      const before = [
        await db.reservation.count(),
        await db.guestStay.count(),
        await db.agreementEvent.count(),
      ];
      await catalogView(db, a.hotel.slug, l.id, { ...dates, guests: 1 });
      assert.deepEqual(
        [
          await db.reservation.count(),
          await db.guestStay.count(),
          await db.agreementEvent.count(),
        ],
        before,
      );
    },
  );
  await check(
    "checkout boundary and local standard times allow adjacent stay",
    async () => {
      const v = await catalogView(db, a.hotel.slug, l.id, {
        checkIn: dates.checkOut,
        checkOut: toISODate(addDays(departure, 2)),
        guests: 2,
      });
      assert.equal(v.cards[0].availability, "AVAILABLE");
    },
  );
  await check(
    "turnover with late departure is unavailable, not free",
    async () => {
      await db.reservation.update({
        where: { id: a.reservation.id },
        data: { checkOutTime: "18:00" },
      });
      assert.equal(
        (
          await catalogView(db, a.hotel.slug, l.id, {
            checkIn: dates.checkOut,
            checkOut: toISODate(addDays(departure, 1)),
            guests: 1,
          })
        ).cards[0].availability,
        "UNAVAILABLE",
      );
      await db.reservation.update({
        where: { id: a.reservation.id },
        data: { checkOutTime: "12:00" },
      });
    },
  );
  await check(
    "cancellation reflects immediately without public cache invalidation delay",
    async () => {
      await db.reservation.update({
        where: { id: a.reservation.id },
        data: { status: "CANCELLED" },
      });
      assert.equal(
        (await catalogView(db, a.hotel.slug, l.id, { ...dates, guests: 2 }))
          .cards[0].availability,
        "AVAILABLE",
      );
    },
  );
  await check("manual blocks/min/max and capacity are respected", async () => {
    const row = await db.availability.create({
      data: {
        hotelId: a.hotel.id,
        roomTypeId: a.type.id,
        date: arrival,
        totalRooms: 2,
        availableRooms: 2,
        closed: true,
      },
    });
    assert.equal(
      (await catalogView(db, a.hotel.slug, l.id, { ...dates, guests: 2 }))
        .cards[0].availability,
      "UNAVAILABLE",
    );
    await db.availability.update({
      where: { id: row.id },
      data: { closed: false, minStay: 4 },
    });
    assert.equal(
      (await catalogView(db, a.hotel.slug, l.id, { ...dates, guests: 2 }))
        .cards[0].availability,
      "UNAVAILABLE",
    );
    await db.availability.delete({ where: { id: row.id } });
    assert.equal(
      (await catalogView(db, a.hotel.slug, l.id, { ...dates, guests: 5 }))
        .cards[0].availability,
      "UNAVAILABLE",
    );
  });
  await check(
    "physical maintenance, stop-sell, departure restrictions and daily rates",
    async () => {
      await db.room.update({
        where: { id: a.room.id },
        data: { status: "MAINTENANCE" },
      });
      assert.equal(
        (await catalogView(db, a.hotel.slug, l.id, { ...dates, guests: 2 }))
          .cards[0].availability,
        "UNAVAILABLE",
      );
      await db.room.update({
        where: { id: a.room.id },
        data: { status: "AVAILABLE" },
      });
      const rate = await db.rate.create({
        data: {
          ratePlanId: a.ratePlan.id,
          date: departure,
          price: 77777,
          closedToDeparture: true,
        },
      });
      assert.equal(
        (await catalogView(db, a.hotel.slug, l.id, { ...dates, guests: 2 }))
          .cards[0].availability,
        "UNAVAILABLE",
      );
      await db.rate.delete({ where: { id: rate.id } });
      const price = await db.rate.create({
        data: {
          ratePlanId: a.ratePlan.id,
          date: arrival,
          price: 25000,
          stopSell: true,
        },
      });
      const v = (
        await catalogView(db, a.hotel.slug, l.id, { ...dates, guests: 2 })
      ).cards[0];
      assert.equal(v.availability, "UNAVAILABLE");
      assert.equal(v.price?.total, 65000);
      await db.rate.delete({ where: { id: price.id } });
    },
  );
  await check(
    "only explicitly published photos are accessible; unpublication closes bytes",
    async () => {
      assert(await catalogPhoto(db, l.id, 0));
      assert.equal(await catalogPhoto(db, l.id, 1), null);
      await db.catalogListing.update({
        where: { id: l.id },
        data: { published: false },
      });
      assert.equal(await catalogPhoto(db, l.id, 0), null);
      await db.catalogListing.update({
        where: { id: l.id },
        data: { published: true },
      });
    },
  );
  await db.reservation.update({
    where: { id: a.reservation.id },
    data: { status: "CONFIRMED" },
  });
  const create = {
    action: "create" as const,
    roomId: a.room.id,
    reservationId: a.reservation.id,
    ...dates,
    requestKey: randomUUID(),
  };
  let s!: Awaited<ReturnType<typeof db.guestStay.findUniqueOrThrow>>,
    token = "";
  await check(
    "one canonical booking has one invitation despite retries and concurrent clicks",
    async () => {
      const results = await Promise.all([
        staffStay(db, a.m, create),
        staffStay(db, a.m, { ...create, requestKey: randomUUID() }),
      ]);
      assert.equal(
        (results[0] as { id: string }).id,
        (results[1] as { id: string }).id,
      );
      s = await db.guestStay.findUniqueOrThrow({
        where: { reservationId: a.reservation.id },
      });
      token = unseal(s.sealedToken);
      assert.equal(hash(token), s.tokenHash);
    },
  );
  await check(
    "read-only invitation load never acknowledges, grants or changes history",
    async () => {
      const n = await db.guestStayEvent.count({ where: { stayId: s.id } });
      await guestStayView(db, token);
      await guestStayView(db, token);
      assert.equal(
        await db.guestStayEvent.count({ where: { stayId: s.id } }),
        n,
      );
      assert.equal((await guestStayView(db, token)).access, null);
    },
  );
  const form = {
    firstName: "НовоеИмя" + "А".repeat(60),
    lastName: "НоваяФамилия",
    phone: "+77011111111",
    arrivalTime: "16:30",
  };
  let view = await guestStayView(db, token);
  await check(
    "real form draft persists server-side and does not change shared Guest",
    async () => {
      await guestStayCommand(db, {
        action: "save",
        token,
        version: view.version,
        revision: view.revision,
        form,
        submit: false,
      });
      view = await guestStayView(db, token);
      assert.deepEqual(view.form, form);
      assert.equal(
        (await db.guest.findUniqueOrThrow({ where: { id: a.guest.id } }))
          .fullName,
        "Доверенное Имя",
      );
    },
  );
  await check(
    "concurrent stale draft cannot overwrite a newer draft",
    async () => {
      const next = { ...form, arrivalTime: "17:00" };
      const values = await Promise.allSettled([
        guestStayCommand(db, {
          action: "save",
          token,
          version: view.version,
          revision: view.revision,
          form: next,
          submit: false,
        }),
        guestStayCommand(db, {
          action: "save",
          token,
          version: view.version,
          revision: view.revision,
          form: { ...form, arrivalTime: "18:00" },
          submit: false,
        }),
      ]);
      assert.equal(values.filter((v) => v.status === "fulfilled").length, 1);
      view = await guestStayView(db, token);
    },
  );
  await check(
    "identical submit is idempotent but does not review, pay or grant",
    async () => {
      const c = {
        action: "save" as const,
        token,
        version: view.version,
        revision: view.revision,
        form: view.form,
        submit: true,
      };
      await Promise.all([guestStayCommand(db, c), guestStayCommand(db, c)]);
      view = await guestStayView(db, token);
      assert.equal(view.formState, "SUBMITTED");
      assert.equal(view.access, null);
      const record = await db.guestStay.findUniqueOrThrow({
        where: { id: s.id },
      });
      assert.equal(record.reviewedAt, null);
      assert.equal(record.accessGrantedAt, null);
      assert.equal(
        await db.financialOperation.count({
          where: { reservationId: a.reservation.id },
        }),
        0,
      );
    },
  );
  async function decision(
    decision:
      | "ACCEPT"
      | "CORRECTION"
      | "GRANT"
      | "REVOKE_ACCESS"
      | "REVOKE_LINK"
      | "ROTATE"
      | "BIND_AGREEMENT"
      | "ORIGINAL_CHECKED",
    referenceId?: string,
    member = a.m,
  ) {
    const current = await db.guestStay.findUniqueOrThrow({
      where: { id: s.id },
    });
    return staffStay(db, member, {
      action: "decision",
      stayId: s.id,
      version: current.version,
      decision,
      reason: "Решение тестового владельца",
      ...(referenceId ? { referenceId } : {}),
    });
  }
  await check(
    "cross-tenant and insufficient live roles are denied server-side",
    async () => {
      await assert.rejects(decision("ACCEPT", undefined, b.m));
      const u = await db.user.create({
        data: { fullName: "Тест менеджер", onboardingCompleted: true },
      });
      const manager = await db.membership.create({
        data: {
          organizationId: a.org.id,
          hotelId: a.hotel.id,
          userId: u.id,
          role: "MANAGER",
          accessLevel: "FULL",
        },
      });
      await assert.rejects(decision("ACCEPT", undefined, { ...manager }));
    },
  );
  await check("grant is denied until an explicit review", async () => {
    await assert.rejects(decision("GRANT"));
  });
  await check(
    "correction has a reason, closes access, and retains old data",
    async () => {
      await decision("CORRECTION");
      view = await guestStayView(db, token);
      assert.equal(view.formState, "CORRECTION");
      assert(view.correctionReason);
      assert.equal(view.access, null);
    },
  );
  await guestStayCommand(db, {
    action: "save",
    token,
    version: view.version,
    revision: view.revision,
    form: view.form,
    submit: true,
  });
  await check(
    "review alone never grants; explicit grant reveals only allowed profile fields",
    async () => {
      await decision("ACCEPT");
      assert.equal((await guestStayView(db, token)).access, null);
      await decision("GRANT");
      const v = await guestStayView(db, token);
      assert.equal(v.access?.keyInstructions, "DOOR_SECRET_FIXTURE_1234");
      assert.equal(v.access?.mapLink, "");
    },
  );
  await check(
    "booking changes immediately invalidate review and access",
    async () => {
      await db.reservation.update({
        where: { id: a.reservation.id },
        data: { totalAmount: 61000 },
      });
      assert.equal((await guestStayView(db, token)).access, null);
      await assert.rejects(decision("GRANT"));
      await db.reservation.update({
        where: { id: a.reservation.id },
        data: { totalAmount: 60000 },
      });
    },
  );
  await check(
    "revoke/cancellation close all new secret and photo responses",
    async () => {
      await decision("REVOKE_ACCESS");
      assert.equal((await guestStayView(db, token)).access, null);
      await assert.rejects(
        guestStayCommand(db, { action: "photo", token, position: 0 }),
      );
      await decision("GRANT");
      await db.reservation.update({
        where: { id: a.reservation.id },
        data: { status: "CANCELLED" },
      });
      assert.equal((await guestStayView(db, token)).access, null);
      await db.reservation.update({
        where: { id: a.reservation.id },
        data: { status: "CONFIRMED" },
      });
    },
  );
  // Issue a real PDF through the existing renderer and owner agreement mechanism.
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
  const docData = createDocumentSchema.parse({
    reservationId: a.reservation.id,
    type: "CONTRACT",
    documentDate: dates.checkIn,
    customerType: "INDIVIDUAL",
    guestFullName: "Доверенное Имя",
    guestIin: "000000000000",
    guestIdentityDocument: "Синтетический документ",
    propertyAddress: "Тестовый адрес 10",
    ...dates,
    checkInTime: "14:00",
    checkOutTime: "12:00",
    unit: "сутки",
    quantity: 3,
    unitPrice: 20000,
    totalAmount: 60000,
    serviceDescription: "Синтетическое проживание",
    paymentTerms: "По договорённости",
    completionDate: dates.checkOut,
    maxGuests: 4,
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
      documentDate: arrival,
      snapshot: {
        version: 1,
        type: "CONTRACT",
        documentNumber: "1",
        documentDate: dates.checkIn,
        currency: "KZT",
        city: "Тест",
        hotelName: "Тест",
        profile,
        data: docData,
      },
    },
  });
  const workspace = await agreementWorkspace(db, a.m, a.reservation.id);
  const issued = (await staffAgreement(db, a.m, {
    action: "create",
    reservationId: a.reservation.id,
    requestKey: randomUUID(),
    revision: workspace.revision,
    documents: [{ id: document.id, required: true }],
    depositTerms: "Возвратный депозит 10000 KZT, отдельно от проживания.",
    cancellationTerms: "Отмена по согласованным условиям до заезда.",
    guide: "Заезд после 14:00, свяжитесь с хозяином.",
    ownerName: "Тест Владелец",
    authority: true,
    approved: true,
    requireOtp: false,
    expiresInDays: 14,
  })) as { id: string };
  await decision("BIND_AGREEMENT", issued.id);
  view = await guestStayView(db, token);
  await check(
    "binding conditions requires new submission and removes previous approval",
    async () => {
      assert.equal(view.requireAgreement, true);
      assert.equal(view.access, null);
      assert.equal(view.formState, "DRAFT");
      await assert.rejects(
        guestStayCommand(db, {
          action: "save",
          token,
          version: view.version,
          revision: view.revision,
          form: view.form,
          submit: true,
        }),
      );
    },
  );
  await check(
    "full immutable PDF is readable before acknowledgement",
    async () => {
      assert(view.agreement && "items" in view.agreement);
      const item = view.agreement.items.find((i) => "hasPdf" in i && i.hasPdf)!;
      const pdf = await guestStayCommand(db, {
        action: "agreement",
        token,
        command: "pdf",
        itemId: item.id,
      });
      assert.equal(pdf.kind, "pdf");
      if (pdf.kind === "pdf")
        assert(
          Buffer.from(pdf.bytes).subarray(0, 4).equals(Buffer.from("%PDF")),
        );
    },
  );
  await check(
    "exact accepted version, server time, event and replay survive reload on same URL",
    async () => {
      assert(view.agreement && "items" in view.agreement);
      const bundle = view.agreement;
      const accept = {
        action: "agreement" as const,
        token,
        command: "accept" as const,
        bundleHash: bundle.bundleHash,
        signerName: "Новое Имя",
        acceptedItems: bundle.items.filter((i) => i.required).map((i) => i.id),
        intent: true as const,
      };
      await guestStayCommand(db, accept);
      const count = await db.agreementEvent.count({
        where: { bundleId: issued.id, action: "GUEST_ACKNOWLEDGED" },
      });
      await guestStayCommand(db, accept);
      const b = await db.agreementBundle.findUniqueOrThrow({
        where: { id: issued.id },
      });
      assert(b.guestAcceptedAt);
      assert(b.guestEvidence);
      assert.equal(
        await db.agreementEvent.count({
          where: { bundleId: issued.id, action: "GUEST_ACKNOWLEDGED" },
        }),
        count,
      );
      view = await guestStayView(db, token);
      assert.equal(view.consent, true);
      assert.equal(
        new URL(
          (await stayWorkspace(db, a.m, a.reservation.id)).stays[0].url!,
        ).hash.slice(1),
        token,
      );
    },
  );
  await check(
    "disabled agreements cannot falsely acknowledge or submit",
    async () => {
      process.env.GUEST_DOCUMENT_BUNDLES_ENABLED = "false";
      assert.equal((await guestStayView(db, token)).consent, false);
      await assert.rejects(
        guestStayCommand(db, {
          action: "save",
          token,
          version: view.version,
          revision: view.revision,
          form: view.form,
          submit: true,
        }),
      );
      process.env.GUEST_DOCUMENT_BUNDLES_ENABLED = "true";
    },
  );
  view = await guestStayView(db, token);
  await guestStayCommand(db, {
    action: "save",
    token,
    version: view.version,
    revision: view.revision,
    form: view.form,
    submit: true,
  });
  await decision("ACCEPT");
  await decision("GRANT");
  await check(
    "expired accepted conditions remain guest-readable but cannot authorize current access",
    async () => {
      await db.agreementBundle.update({
        where: { id: issued.id },
        data: { expiresAt: new Date(0) },
      });
      const v = await guestStayView(db, token);
      assert.equal(v.access, null);
      assert.equal(v.consent, false);
      assert(
        v.agreement &&
          "guestAcceptedAt" in v.agreement &&
          v.agreement.guestAcceptedAt,
      );
      await db.agreementBundle.update({
        where: { id: issued.id },
        data: { expiresAt: new Date(Date.now() + 7 * 86400000) },
      });
    },
  );
  await check(
    "link rotation invalidates old token without deleting submitted data/evidence",
    async () => {
      await decision("ROTATE");
      await assert.rejects(guestStayView(db, token));
      s = await db.guestStay.findUniqueOrThrow({ where: { id: s.id } });
      token = unseal(s.sealedToken);
      view = await guestStayView(db, token);
      assert.equal(view.formState, "SUBMITTED");
      assert.equal(view.access, null);
      assert(view.consent);
    },
  );
  await check("revoked and expired links are rejected", async () => {
    await decision("REVOKE_LINK");
    await assert.rejects(guestStayView(db, token));
    await decision("ROTATE");
    s = await db.guestStay.findUniqueOrThrow({ where: { id: s.id } });
    token = unseal(s.sealedToken);
    await db.guestStay.update({
      where: { id: s.id },
      data: { expiresAt: new Date(0) },
    });
    await assert.rejects(guestStayView(db, token));
    await db.guestStay.update({
      where: { id: s.id },
      data: { expiresAt: new Date(Date.now() + 86400000) },
    });
  });
  await check(
    "preliminary stay needs no fictitious Guest and never holds inventory",
    async () => {
      const guests = await db.guest.count();
      const bookings = await db.reservation.count();
      const pre = (await staffStay(db, b.m, {
        action: "create",
        roomId: b.room.id,
        ...dates,
        requestKey: randomUUID(),
      })) as { id: string };
      const p = await db.guestStay.findUniqueOrThrow({ where: { id: pre.id } });
      const t = unseal(p.sealedToken);
      const v = await guestStayView(db, t);
      await guestStayCommand(db, {
        action: "save",
        token: t,
        version: v.version,
        revision: v.revision,
        form: formInput.parse(form),
        submit: true,
      });
      const after = await db.guestStay.findUniqueOrThrow({
        where: { id: p.id },
      });
      await staffStay(db, b.m, {
        action: "decision",
        stayId: p.id,
        version: after.version,
        decision: "ACCEPT",
        reason: "Проверены данные",
      });
      const ready = await db.guestStay.findUniqueOrThrow({
        where: { id: p.id },
      });
      await assert.rejects(
        staffStay(db, b.m, {
          action: "decision",
          stayId: p.id,
          version: ready.version,
          decision: "GRANT",
          reason: "Не должно разрешать",
        }),
      );
      assert.equal(await db.guest.count(), guests);
      assert.equal(await db.reservation.count(), bookings);
    },
  );
  await check(
    "per-stay exceptions require resubmission, separate original review and explicit grant",
    async () => {
      const current = await db.guestStay.findUniqueOrThrow({
        where: { id: s.id },
      });
      await staffStay(db, a.m, {
        action: "decision",
        stayId: s.id,
        version: current.version,
        decision: "SET_REQUIREMENTS",
        reason: "Оригинал проверить при заселении",
        requirements: {
          identityMode: "ORIGINAL_AT_ARRIVAL",
          requireArrival: true,
          requireAgreement: true,
        },
      });
      view = await guestStayView(db, token);
      assert.equal(view.formState, "DRAFT");
      assert.equal(view.access, null);
      await guestStayCommand(db, {
        action: "save",
        token,
        version: view.version,
        revision: view.revision,
        form: view.form,
        submit: true,
      });
      await decision("ACCEPT");
      await assert.rejects(decision("GRANT"));
      await decision("ORIGINAL_CHECKED");
      await decision("GRANT");
      const checked = await db.guestStay.findUniqueOrThrow({
        where: { id: s.id },
      });
      assert(checked.originalCheckedAt);
      assert.equal(checked.originalCheckedBy, a.user.id);
    },
  );
  await check(
    "private parking, exit instructions and entrance bytes require active authorization",
    async () => {
      await staffStay(db, a.m, {
        action: "savePolicy",
        roomId: a.room.id,
        version: 0,
        policy: {
          identityMode: "NONE",
          requireArrival: false,
          requireAgreement: false,
          parking: "PRIVATE_PARKING",
          checkoutInstructions: "PRIVATE_CHECKOUT",
          entryPhotoIds: [a.photo.id],
        },
      });
      const v = await guestStayView(db, token);
      assert.equal(v.access?.parking, "PRIVATE_PARKING");
      const photo = await guestStayCommand(db, {
        action: "photo",
        token,
        position: 0,
      });
      assert.equal(photo.kind, "photo");
      await decision("REVOKE_ACCESS");
      const blocked = JSON.stringify(await guestStayView(db, token));
      assert(!blocked.includes("PRIVATE_PARKING"));
      assert(!blocked.includes("PRIVATE_CHECKOUT"));
      await assert.rejects(
        guestStayCommand(db, { action: "photo", token, position: 0 }),
      );
    },
  );
  await check(
    "checkout cuts current secrets but keeps immutable accepted evidence accessible",
    async () => {
      await db.reservation.update({
        where: { id: a.reservation.id },
        data: {
          checkIn: addDays(todayInTimeZone("Asia/Almaty"), -4),
          checkOut: addDays(todayInTimeZone("Asia/Almaty"), -1),
        },
      });
      const v = await guestStayView(db, token);
      assert(v.ended);
      assert.equal(v.access, null);
      assert(
        v.agreement &&
          "guestAcceptedAt" in v.agreement &&
          v.agreement.guestAcceptedAt,
      );
      const proof = await guestStayCommand(db, {
        action: "agreement",
        token,
        command: "evidence",
      });
      assert.equal(proof.kind, "json");
      await db.reservation.update({
        where: { id: a.reservation.id },
        data: { checkIn: arrival, checkOut: departure },
      });
    },
  );
  // Fresh second-unit fixture for actual HTTP/browser flow from owner create to access/revoke.
  const e2eReservation = await db.reservation.create({
    data: {
      hotelId: a.hotel.id,
      rentalPropertyId: a.property.id,
      roomId: a.secondRoom.id,
      roomTypeId: a.type.id,
      guestId: a.guest.id,
      checkIn: arrival,
      checkOut: departure,
      sourceChannel: "direct",
      totalAmount: 60000,
    },
  });
  await db.communicationProfile.create({
    data: {
      organizationId: a.org.id,
      hotelId: a.hotel.id,
      roomId: a.secondRoom.id,
      address: "Адрес для E2E с очень длинным текстом " + "Б".repeat(160),
      keyInstructions: "E2E_SECRET_DOOR",
      wifiPassword: "E2E_WIFI_SECRET",
    },
  });
  const sessionToken = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      userId: a.user.id,
      tokenHash: hash(sessionToken),
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const fixture = {
    hotelId: a.hotel.id,
    orgId: a.org.id,
    membershipId: a.m.id,
    userId: a.user.id,
    slug: a.hotel.slug,
    listingId: l.id,
    roomId: a.secondRoom.id,
    reservationId: e2eReservation.id,
    sessionToken,
    scope: `${a.user.id}:${a.org.id}:${a.hotel.id}`,
    dates,
    guestStayId: s.id,
    guestToken: token,
  };
  if (process.env.GUEST_STAY_FIXTURE_PATH)
    await writeFile(
      process.env.GUEST_STAY_FIXTURE_PATH,
      JSON.stringify(fixture),
      { mode: 0o600 },
    );
  console.log(
    `${checks} real PostgreSQL checks passed. Disposable synthetic fixtures retained for browser E2E.`,
  );
}
main()
  .catch((e) => {
    console.error(
      e instanceof Error
        ? `${e.name}${["AssertionError", "PublicError"].includes(e.name) ? `: ${e.message}` : " (details omitted to keep tokens/PII out of logs)"}`
        : "Test failed",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
