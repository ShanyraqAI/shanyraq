/**
 * Demo seed — reusable seeding logic.
 *
 * Used by two callers:
 *  - `prisma/seed.ts` (npm run db:seed / db:reset)
 *  - `src/lib/bootstrap.ts` (auto-provisions demo data on ephemeral hosts,
 *    e.g. the Vercel deployment, where every cold start starts from an
 *    empty database)
 *
 * Deterministic and anchored on TODAY's date so the demo always looks current.
 */
import type { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Date helpers (UTC-midnight convention, mirrors src/lib/dates.ts)
// ---------------------------------------------------------------------------
const MS_DAY = 86_400_000;
function today(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_DAY);
}

export async function seedDemoData(db: PrismaClient): Promise<void> {
  // ------------------------------------------------------------------ reset
  // Sequential deletes (not a batched $transaction): this function is also
  // invoked with a transaction client from the runtime bootstrap, and nested
  // transactions are not supported there.
  await db.auditLog.deleteMany();
  await db.notification.deleteMany();
  await db.syncLog.deleteMany();
  await db.channelRateMapping.deleteMany();
  await db.channelRoomMapping.deleteMany();
  await db.channelConnection.deleteMany();
  await db.rate.deleteMany();
  await db.ratePlan.deleteMany();
  await db.availability.deleteMany();
  await db.reservation.deleteMany();
  await db.room.deleteMany();
  await db.roomType.deleteMany();
  await db.guest.deleteMany();
  await db.channel.deleteMany();
  await db.hotel.deleteMany();
  await db.membership.deleteMany();
  await db.user.deleteMany();
  await db.organization.deleteMany();

  const t = today();
  const now = new Date();

  // ------------------------------------------------------------ organization
  const org = await db.organization.create({
    data: { name: "Shanyraq Hospitality Group" },
  });
  await db.user.create({
    data: {
      email: "manager@shanyraq.kz",
      fullName: "Aisultan Nazar",
      memberships: { create: { organizationId: org.id, role: "OWNER" } },
    },
  });

  // ------------------------------------------------------------------ hotel
  const hotel = await db.hotel.create({
    data: {
      orgId: org.id,
      slug: "shanyraq-astana",
      name: "Shanyraq Hotel Astana",
      address: "проспект Мәңгілік Ел, 18",
      city: "Астана",
      country: "Казахстан",
      timezone: "Asia/Almaty",
      currency: "KZT",
    },
  });

  // -------------------------------------------------------------- room types
  const standard = await db.roomType.create({
    data: {
      hotelId: hotel.id,
      name: "Стандарт",
      description: "Уютный номер 22 м² с видом на город, рабочим столом и тропическим душем.",
      capacity: 2,
      basePrice: 25000,
      sortOrder: 1,
    },
  });
  const deluxe = await db.roomType.create({
    data: {
      hotelId: hotel.id,
      name: "Делюкс",
      description: "Просторный номер 34 м² с кроватью king-size, креслом для отдыха и мини-баром.",
      capacity: 3,
      basePrice: 38000,
      sortOrder: 2,
    },
  });
  const suite = await db.roomType.create({
    data: {
      hotelId: hotel.id,
      name: "Люкс",
      description: "Угловой люкс 58 м² с гостиной, панорамными окнами и кофемашиной.",
      capacity: 4,
      basePrice: 68000,
      sortOrder: 3,
    },
  });

  // ------------------------------------------------------------------- rooms
  const roomData = [
    { number: "101", floor: 1, roomTypeId: standard.id },
    { number: "102", floor: 1, roomTypeId: standard.id },
    { number: "103", floor: 1, roomTypeId: standard.id },
    { number: "201", floor: 2, roomTypeId: deluxe.id },
    { number: "202", floor: 2, roomTypeId: deluxe.id },
    { number: "203", floor: 2, roomTypeId: deluxe.id },
    { number: "301", floor: 3, roomTypeId: suite.id },
    { number: "302", floor: 3, roomTypeId: suite.id },
  ];
  const rooms: Record<string, string> = {};
  for (const r of roomData) {
    const created = await db.room.create({ data: { hotelId: hotel.id, ...r } });
    rooms[r.number] = created.id;
  }

  // ------------------------------------------------------------------ guests
  const guestSeed: [string, string, string, string][] = [
    ["Almas Dzhenissov", "almas.d@example.kz", "+7 701 220 1450", "Казахстан"],
    ["John Smith", "john.smith@example.com", "+44 7700 900123", "Великобритания"],
    ["Maria Gonzalez", "maria.gonzalez@example.es", "+34 612 34 56 78", "Испания"],
    ["Aigerim Serikbay", "aigerim.s@example.kz", "+7 702 118 9032", "Казахстан"],
    ["Viktor Petrov", "v.petrov@example.ru", "+7 921 445 6677", "Россия"],
    ["Emily Carter", "emily.carter@example.co.uk", "+44 7700 900771", "Великобритания"],
    ["Daniyar Abenov", "d.abenov@example.kz", "+7 705 903 1122", "Казахстан"],
    ["Hans Müller", "hans.mueller@example.de", "+49 171 234 5678", "Германия"],
    ["Gulnara Karimova", "gulnara.k@example.kz", "+7 701 555 8090", "Казахстан"],
    ["Ivan Sokolov", "ivan.sokolov@example.ru", "+7 916 200 3040", "Россия"],
    ["Aylin Demir", "aylin.demir@example.tr", "+90 532 123 4567", "Турция"],
    ["Chen Wei", "chen.wei@example.cn", "+86 138 0013 8000", "Китай"],
    ["Sofia Rossi", "sofia.rossi@example.it", "+39 335 872 0011", "Италия"],
    ["Madina Ospanova", "madina.o@example.kz", "+7 707 341 7788", "Казахстан"],
    ["Arman Zhaksybaev", "arman.z@example.kz", "+7 775 600 1200", "Казахстан"],
    ["Elena Kim", "elena.kim@example.kz", "+7 700 987 6543", "Казахстан"],
  ];
  const createdGuests = await db.guest.createManyAndReturn({
    data: guestSeed.map(([fullName, email, phone, country]) => ({
      hotelId: hotel.id,
      fullName,
      email,
      phone,
      country,
    })),
  });
  const guests = createdGuests.map((g) => ({ id: g.id, name: g.fullName }));
  const G = (name: string) => guests.find((g) => g.name === name)!.id;

  // -------------------------------------------------------------- rate plans
  async function makePlan(
    name: string,
    roomTypeId: string,
    basePrice: number,
    refundable: boolean,
    breakfast: boolean,
  ) {
    return db.ratePlan.create({
      data: { hotelId: hotel.id, roomTypeId, name, basePrice, refundable, breakfastIncluded: breakfast, currency: "KZT" },
    });
  }
  const standardRate = await makePlan("Базовый тариф", standard.id, 25000, true, false);
  const standardNonRefundable = await makePlan("Невозвратный", standard.id, 22000, false, false);
  const deluxeRate = await makePlan("Делюкс", deluxe.id, 38000, true, false);
  const suiteRate = await makePlan("Люкс", suite.id, 68000, true, false);
  const suiteBreakfast = await makePlan("Люкс с завтраком", suite.id, 75000, true, true);

  // Rate calendar: weekends +15%.
  const plans = [
    { id: standardRate.id, base: 25000 },
    { id: standardNonRefundable.id, base: 22000 },
    { id: deluxeRate.id, base: 38000 },
    { id: suiteRate.id, base: 68000 },
    { id: suiteBreakfast.id, base: 75000 },
  ];
  function priceFor(base: number, date: Date): number {
    const dow = (date.getUTCDay() + 6) % 7;
    const weekend = dow >= 5;
    return weekend ? Math.round((base * 1.15) / 500) * 500 : base;
  }
  // Bulk insert — hundreds of rows via a handful of round-trips.
  const rateRows: { ratePlanId: string; date: Date; price: number }[] = [];
  for (const p of plans) {
    for (let i = -21; i <= 60; i++) {
      const d = addDays(t, i);
      rateRows.push({ ratePlanId: p.id, date: d, price: priceFor(p.base, d) });
    }
  }
  await db.rate.createMany({ data: rateRows });

  function stayTotal(planBase: number, checkIn: Date, checkOut: Date): number {
    let total = 0;
    for (let d = checkIn.getTime(); d < checkOut.getTime(); d += MS_DAY) {
      total += priceFor(planBase, new Date(d));
    }
    return total;
  }

  // ------------------------------------------------------------ reservations
  type ResTemplate = {
    guest: string;
    room: string;
    roomTypeId: string;
    planId: string;
    planBase: number;
    in_: number;
    out: number;
    status: string;
    channel: string;
    adults: number;
    children: number;
    external?: boolean;
    notes?: string;
  };

  const stdPlanBase = 25000;
  const dlxPlanBase = 38000;
  const suitPlanBase = 68000;

  const templates: ResTemplate[] = [
    // --- past, checked out ---
    { guest: "Almas Dzhenissov", room: "101", roomTypeId: standard.id, planId: standardRate.id, planBase: stdPlanBase, in_: -14, out: -12, status: "CHECKED_OUT", channel: "direct", adults: 1, children: 0, notes: "Постоянный корпоративный гость." },
    { guest: "John Smith", room: "102", roomTypeId: standard.id, planId: standardRate.id, planBase: stdPlanBase, in_: -11, out: -8, status: "CHECKED_OUT", channel: "booking", adults: 2, children: 0, external: true },
    { guest: "Maria Gonzalez", room: "201", roomTypeId: deluxe.id, planId: deluxeRate.id, planBase: dlxPlanBase, in_: -10, out: -7, status: "CHECKED_OUT", channel: "ostrovok", adults: 2, children: 1, external: true },
    { guest: "Hans Müller", room: "301", roomTypeId: suite.id, planId: suiteRate.id, planBase: suitPlanBase, in_: -8, out: -5, status: "CHECKED_OUT", channel: "direct", adults: 2, children: 0 },
    { guest: "Sofia Rossi", room: "103", roomTypeId: standard.id, planId: standardNonRefundable.id, planBase: 22000, in_: -6, out: -4, status: "CHECKED_OUT", channel: "krisha", adults: 1, children: 0, external: true },
    { guest: "Elena Kim", room: "202", roomTypeId: deluxe.id, planId: deluxeRate.id, planBase: dlxPlanBase, in_: -4, out: -1, status: "CHECKED_OUT", channel: "booking", adults: 2, children: 0, external: true },

    // --- in house (cover tonight) ---
    { guest: "Aigerim Serikbay", room: "101", roomTypeId: standard.id, planId: standardRate.id, planBase: stdPlanBase, in_: -2, out: 2, status: "CHECKED_IN", channel: "booking", adults: 2, children: 0, external: true, notes: "Просит поздний выезд." },
    { guest: "Viktor Petrov", room: "102", roomTypeId: standard.id, planId: standardRate.id, planBase: stdPlanBase, in_: -3, out: 1, status: "CHECKED_IN", channel: "ostrovok", adults: 2, children: 1, external: true },
    { guest: "Gulnara Karimova", room: "201", roomTypeId: deluxe.id, planId: deluxeRate.id, planBase: dlxPlanBase, in_: -5, out: 3, status: "CHECKED_IN", channel: "direct", adults: 2, children: 0 },
    { guest: "Daniyar Abenov", room: "301", roomTypeId: suite.id, planId: suiteBreakfast.id, planBase: 75000, in_: -1, out: 2, status: "CHECKED_IN", channel: "ostrovok", adults: 2, children: 2, external: true },
    { guest: "Chen Wei", room: "103", roomTypeId: standard.id, planId: standardRate.id, planBase: stdPlanBase, in_: 0, out: 3, status: "CHECKED_IN", channel: "direct", adults: 2, children: 0 },

    // --- departing today ---
    { guest: "Arman Zhaksybaev", room: "203", roomTypeId: deluxe.id, planId: deluxeRate.id, planBase: dlxPlanBase, in_: -2, out: 0, status: "CHECKED_IN", channel: "booking", adults: 2, children: 0, external: true },
    { guest: "Aylin Demir", room: "302", roomTypeId: suite.id, planId: suiteRate.id, planBase: suitPlanBase, in_: -3, out: 0, status: "CHECKED_IN", channel: "direct", adults: 2, children: 0 },

    // --- arriving today ---
    { guest: "John Smith", room: "203", roomTypeId: deluxe.id, planId: deluxeRate.id, planBase: dlxPlanBase, in_: 0, out: 3, status: "CONFIRMED", channel: "booking", adults: 1, children: 0, external: true, notes: "VIP-гость — подготовить комплимент от отеля." },
    { guest: "Emily Carter", room: "302", roomTypeId: suite.id, planId: suiteBreakfast.id, planBase: 75000, in_: 0, out: 4, status: "CONFIRMED", channel: "ostrovok", adults: 2, children: 0, external: true },

    // --- upcoming ---
    { guest: "Ivan Sokolov", room: "102", roomTypeId: standard.id, planId: standardNonRefundable.id, planBase: 22000, in_: 2, out: 5, status: "CONFIRMED", channel: "ostrovok", adults: 1, children: 0, external: true },
    { guest: "Madina Ospanova", room: "202", roomTypeId: deluxe.id, planId: deluxeRate.id, planBase: dlxPlanBase, in_: 1, out: 4, status: "CONFIRMED", channel: "krisha", adults: 2, children: 1, external: true },
    { guest: "Hans Müller", room: "201", roomTypeId: deluxe.id, planId: deluxeRate.id, planBase: dlxPlanBase, in_: 3, out: 6, status: "CONFIRMED", channel: "booking", adults: 2, children: 0, external: true },
    { guest: "Daniyar Abenov", room: "301", roomTypeId: suite.id, planId: suiteRate.id, planBase: suitPlanBase, in_: 2, out: 4, status: "CONFIRMED", channel: "ostrovok", adults: 2, children: 2, external: true },
    { guest: "Maria Gonzalez", room: "103", roomTypeId: standard.id, planId: standardRate.id, planBase: stdPlanBase, in_: 3, out: 6, status: "CONFIRMED", channel: "booking", adults: 2, children: 0, external: true },
    { guest: "Elena Kim", room: "302", roomTypeId: suite.id, planId: suiteRate.id, planBase: suitPlanBase, in_: 2, out: 3, status: "CONFIRMED", channel: "direct", adults: 2, children: 0 },
    { guest: "Almas Dzhenissov", room: "101", roomTypeId: standard.id, planId: standardNonRefundable.id, planBase: 22000, in_: 2, out: 6, status: "CONFIRMED", channel: "ostrovok", adults: 1, children: 0, external: true },
    { guest: "Sofia Rossi", room: "103", roomTypeId: standard.id, planId: standardRate.id, planBase: stdPlanBase, in_: 7, out: 10, status: "PENDING", channel: "direct", adults: 2, children: 1, notes: "Ожидает подтверждения авиабилетов." },
    { guest: "Viktor Petrov", room: "102", roomTypeId: standard.id, planId: standardRate.id, planBase: stdPlanBase, in_: 5, out: 7, status: "CANCELLED", channel: "booking", adults: 2, children: 0, external: true },
    { guest: "Chen Wei", room: "301", roomTypeId: suite.id, planId: suiteRate.id, planBase: suitPlanBase, in_: 9, out: 13, status: "CONFIRMED", channel: "booking", adults: 2, children: 0, external: true },
    { guest: "Madina Ospanova", room: "202", roomTypeId: deluxe.id, planId: deluxeRate.id, planBase: dlxPlanBase, in_: 12, out: 15, status: "CONFIRMED", channel: "krisha", adults: 2, children: 1, external: true },
  ];

  let externalSeq = 0;
  let createdCount = 0;
  for (const tplt of templates) {
    const checkIn = addDays(t, tplt.in_);
    const checkOut = addDays(t, tplt.out);
    externalSeq++;
    await db.reservation.create({
      data: {
        hotelId: hotel.id,
        guestId: G(tplt.guest),
        roomId: rooms[tplt.room],
        roomTypeId: tplt.roomTypeId,
        sourceChannel: tplt.channel,
        externalReservationId: tplt.external ? `seed-${tplt.channel}-${String(externalSeq).padStart(3, "0")}` : null,
        checkIn,
        checkOut,
        adults: tplt.adults,
        children: tplt.children,
        status: tplt.status,
        currency: "KZT",
        totalAmount: stayTotal(tplt.planBase, checkIn, checkOut),
        notes: tplt.notes ?? null,
        createdAt: new Date(now.getTime() - (createdCount % 9) * 36e5 * 7),
      },
    });
    createdCount++;
  }

  // Physical room status derived from who is in-house right now.
  const tonightActive = templates.filter(
    (r) => r.in_ <= 0 && r.out > 0 && ["CONFIRMED", "CHECKED_IN"].includes(r.status),
  );
  const occupiedNumbers = new Set(tonightActive.map((r) => r.room));
  for (const [number, id] of Object.entries(rooms)) {
    await db.room.update({
      where: { id },
      data: { status: occupiedNumbers.has(number) ? "OCCUPIED" : "AVAILABLE" },
    });
  }

  // ------------------------------------------------------- availability rows
  const availabilityRows: {
    hotelId: string;
    roomTypeId: string;
    date: Date;
    totalRooms: number;
    availableRooms: number;
    minStay: number;
  }[] = [];
  for (const rt of [standard, deluxe, suite]) {
    const totalRooms = roomData.filter((r) => r.roomTypeId === rt.id).length;
    for (let i = -21; i <= 60; i++) {
      const d = addDays(t, i);
      const reserved = tonightActive.filter((r) => r.roomTypeId === rt.id && r.in_ <= i && r.out > i).length;
      availabilityRows.push({
        hotelId: hotel.id,
        roomTypeId: rt.id,
        date: d,
        totalRooms,
        availableRooms: Math.max(0, totalRooms - reserved),
        minStay: 1,
      });
    }
  }
  await db.availability.createMany({ data: availabilityRows });

  // ---------------------------------------------------------------- channels
  await db.channel.createMany({
    data: [
      { id: "booking", name: "Booking.com", description: "Глобальный канал с максимальным охватом путешественников." },
      { id: "ostrovok", name: "Ostrovok", description: "Канал, ориентированный на рынки СНГ и Азии." },
      { id: "krisha", name: "Krisha", description: "Казахстанская площадка для размещения объектов проживания." },
      { id: "direct", name: "Прямые брони", description: "Брони по телефону, на стойке и через сайт отеля.", isInternal: true },
    ],
  });

  // ------------------------------------------- connected channels (mock) ----
  const bookingConn = await db.channelConnection.create({
    data: {
      hotelId: hotel.id,
      channelId: "booking",
      status: "CONNECTED",
      externalPropertyId: "100200330",
      credentialsJson: JSON.stringify({
        propertyId: "100200330",
        username: "shanyraq-booking",
        apiKey: "dev-placeholder-key",
      }),
      lastSyncAt: new Date(now.getTime() - 2 * 60_000),
      lastSyncStatus: "SUCCESS",
      importCursor: 0,
      roomMappings: {
        create: [
          { roomTypeId: standard.id, externalRoomTypeId: "123451", externalRoomName: "Стандартный номер" },
          { roomTypeId: deluxe.id, externalRoomTypeId: "123456", externalRoomName: "Улучшенный номер" },
          { roomTypeId: suite.id, externalRoomTypeId: "123789", externalRoomName: "Люкс" },
        ],
      },
      rateMappings: {
        create: [
          { ratePlanId: standardRate.id, externalRateId: "99991", externalRateName: "Базовый гибкий тариф" },
          { ratePlanId: standardNonRefundable.id, externalRateId: "99992", externalRateName: "Невозвратный тариф" },
          { ratePlanId: deluxeRate.id, externalRateId: "99993", externalRateName: "Гибкий тариф «Делюкс»" },
          { ratePlanId: suiteRate.id, externalRateId: "99994", externalRateName: "Люкс с завтраком" },
        ],
      },
    },
  });

  const ostrovokConn = await db.channelConnection.create({
    data: {
      hotelId: hotel.id,
      channelId: "ostrovok",
      status: "CONNECTED",
      externalPropertyId: "OST-88410",
      credentialsJson: JSON.stringify({
        propertyId: "OST-88410",
        username: "shanyraq-ostrovok",
        apiKey: "dev-placeholder-key",
      }),
      lastSyncAt: new Date(now.getTime() - 5 * 60_000),
      lastSyncStatus: "SUCCESS",
      importCursor: 0,
      roomMappings: {
        create: [
          { roomTypeId: standard.id, externalRoomTypeId: "rt_std_01", externalRoomName: "Стандартный двухместный" },
          { roomTypeId: deluxe.id, externalRoomTypeId: "rt_dlxE_02", externalRoomName: "Делюкс с кроватью king-size" },
          { roomTypeId: suite.id, externalRoomTypeId: "rt_suit_09", externalRoomName: "Люкс «Executive»" },
        ],
      },
      rateMappings: {
        create: [
          { ratePlanId: standardRate.id, externalRateId: "rp_std_flex", externalRateName: "Гибкий тариф «Стандарт»" },
          { ratePlanId: deluxeRate.id, externalRateId: "rp_dlx_flex", externalRateName: "Гибкий тариф «Делюкс»" },
          { ratePlanId: suiteBreakfast.id, externalRateId: "rp_suit_bb", externalRateName: "Люкс с завтраком" },
        ],
      },
    },
  });

  // Recent successful sync history so Channel Health looks alive immediately.
  await db.syncLog.createMany({
    data: [
      {
        connectionId: bookingConn.id,
        channelId: "booking",
        startedAt: new Date(now.getTime() - 2 * 60_000 - 4000),
        finishedAt: new Date(now.getTime() - 2 * 60_000),
        status: "SUCCESS",
        reservationsImported: 2,
        ratesUpdated: 150,
        availabilityUpdated: 90,
        message: "Импортировано 2 бронирования · отправлено цен: 150 · отправлено записей доступности: 90",
      },
      {
        connectionId: bookingConn.id,
        channelId: "booking",
        startedAt: new Date(now.getTime() - 26 * 3600_000),
        finishedAt: new Date(now.getTime() - 26 * 3600_000 + 9000),
        status: "PARTIAL",
        reservationsImported: 1,
        ratesUpdated: 150,
        availabilityUpdated: 90,
        message: "Импортировано 1 бронирование · отправлено цен: 150 · отправлено записей доступности: 90 · пропущено: 1",
      },
      {
        connectionId: ostrovokConn.id,
        channelId: "ostrovok",
        startedAt: new Date(now.getTime() - 5 * 60_000 - 3500),
        finishedAt: new Date(now.getTime() - 5 * 60_000),
        status: "SUCCESS",
        reservationsImported: 1,
        ratesUpdated: 135,
        availabilityUpdated: 90,
        message: "Импортировано 1 бронирование · отправлено цен: 135 · отправлено записей доступности: 90",
      },
    ],
  });

  await db.notification.create({
    data: {
      hotelId: hotel.id,
      type: "SYNC",
      title: "Booking.com синхронизирован",
      body: "Во время последней синхронизации импортированы 2 новые брони.",
    },
  });
}
