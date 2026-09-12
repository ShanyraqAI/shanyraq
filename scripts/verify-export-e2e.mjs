import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

const { Workbook } = ExcelJS;

const source = process.env.DATABASE_URL;
const databaseName = process.env.E2E_DATABASE_NAME ?? "shanyraq_e2e_test";
const port = process.env.E2E_PORT ?? "3101";
if (!source) throw new Error("DATABASE_URL is required");
if (!/(?:^|[_-])(test|dev|demo)$/i.test(databaseName)) throw new Error("Refusing to verify a non-test database");
const url = new URL(source);
url.pathname = `/${databaseName}`;
const db = new PrismaClient({ datasourceUrl: url.toString() });
const origin = `http://127.0.0.1:${port}`;
let sessionId;

async function request(path, cookie = "") {
  return fetch(`${origin}${path}`, { headers: cookie ? { cookie } : undefined });
}

async function xlsx(path, cookie, expectedSheet, expectedRows) {
  const response = await request(path, cookie);
  if (response.status !== 200) throw new Error(`${path} returned ${response.status}: ${await response.text()}`);
  if (!response.headers.get("content-type")?.includes("spreadsheetml.sheet")) throw new Error(`${path} returned the wrong content type`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error(`${path} is not an XLSX zip`);
  const workbook = new Workbook();
  await workbook.xlsx.load(bytes);
  const sheet = workbook.getWorksheet(expectedSheet);
  if (!sheet || sheet.rowCount !== expectedRows + 5) throw new Error(`${path} contains an unexpected row count`);
  if (!sheet.autoFilter || sheet.views[0]?.state !== "frozen") throw new Error(`${path} is missing filters or frozen headers`);
  return { bytes: bytes.length, rows: expectedRows };
}

try {
  const membership = await db.membership.findFirst({
    where: { role: "OWNER", hotel: { reservations: { some: { status: { not: "CANCELLED" } } } } },
    select: { userId: true, hotelId: true },
  });
  if (!membership) throw new Error("No populated E2E hotel is available");
  const token = randomBytes(32).toString("hex");
  const session = await db.session.create({
    data: { userId: membership.userId, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60_000) },
    select: { id: true },
  });
  sessionId = session.id;
  const cookie = `shanyraq_session=${token}; shanyraq_hotel=${membership.hotelId}`;
  const anchorReservation = await db.reservation.findFirstOrThrow({ where: { hotelId: membership.hotelId, status: { not: "CANCELLED" } }, orderBy: { checkIn: "asc" }, select: { checkIn: true } });
  const calendarFrom = anchorReservation.checkIn.toISOString().slice(0, 10);
  const calendarToDate = new Date(anchorReservation.checkIn.getTime() + 29 * 86_400_000);
  const calendarTo = calendarToDate.toISOString().slice(0, 10);
  const [guestCount, reservationCount, calendarCount] = await Promise.all([
    db.guest.count({ where: { hotelId: membership.hotelId } }),
    db.reservation.count({ where: { hotelId: membership.hotelId } }),
    db.reservation.count({ where: { hotelId: membership.hotelId, status: { not: "CANCELLED" }, checkIn: { lt: new Date(calendarToDate.getTime() + 86_400_000) }, checkOut: { gt: anchorReservation.checkIn } } }),
  ]);

  const guests = await xlsx("/api/exports/guests?format=xlsx", cookie, "Гости", guestCount);
  const reservations = await xlsx("/api/exports/reservations?format=xlsx", cookie, "Бронирования", reservationCount);
  const calendar = await xlsx(`/api/exports/calendar?format=xlsx&from=${calendarFrom}&to=${calendarTo}`, cookie, "Календарь", calendarCount);
  const csv = await request("/api/exports/reservations?format=csv", cookie);
  const csvBytes = Buffer.from(await csv.arrayBuffer());
  const csvText = csvBytes.toString("utf8");
  const hasBom = csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf;
  if (csv.status !== 200 || !hasBom || !csvText.includes(";")) throw new Error("CSV export is not Excel-compatible UTF-8 semicolon data");
  const anonymous = await request("/api/exports/guests?format=xlsx");
  if (anonymous.status !== 401) throw new Error(`Anonymous export returned ${anonymous.status}`);

  console.log(JSON.stringify({ ok: true, database: databaseName, tenantScoped: true, guests, reservations, calendar, csv: { bytes: csvBytes.length }, anonymous: "rejected" }, null, 2));
} finally {
  if (sessionId) await db.session.deleteMany({ where: { id: sessionId } });
  await db.$disconnect();
}
