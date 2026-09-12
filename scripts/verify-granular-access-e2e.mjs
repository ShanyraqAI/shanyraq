import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

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
let membershipId;
let membershipWasCreated = false;
let previousMembership;

try {
  const [user, hotel] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: "phase2-member-e2e@shanyraq.test" }, select: { id: true } }),
    db.hotel.findFirstOrThrow({ where: { reservations: { some: { status: { not: "CANCELLED" } } } }, select: { id: true, orgId: true } }),
  ]);
  previousMembership = await db.membership.findUnique({ where: { userId_hotelId: { userId: user.id, hotelId: hotel.id } } });
  if (previousMembership) {
    membershipId = previousMembership.id;
    await db.membership.update({ where: { id: membershipId }, data: { role: "STAFF", accessLevel: "OVERVIEW", permissions: ["CALENDAR", "GUESTS"] } });
  } else {
    const membership = await db.membership.create({ data: { organizationId: hotel.orgId, userId: user.id, hotelId: hotel.id, role: "STAFF", accessLevel: "OVERVIEW", permissions: ["CALENDAR", "GUESTS"] }, select: { id: true } });
    membershipId = membership.id;
    membershipWasCreated = true;
  }

  const token = randomBytes(32).toString("hex");
  const session = await db.session.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60_000) }, select: { id: true } });
  sessionId = session.id;
  const cookie = `shanyraq_session=${token}; shanyraq_active_hotel=${hotel.id}`;
  const headers = { cookie };
  const [guestsPage, reservationsPage, guestsExport, reservationsExport] = await Promise.all([
    fetch(`${origin}/dashboard/guests`, { headers, redirect: "manual" }),
    fetch(`${origin}/dashboard/reservations`, { headers, redirect: "manual" }),
    fetch(`${origin}/api/exports/guests?format=csv`, { headers }),
    fetch(`${origin}/api/exports/reservations?format=csv`, { headers }),
  ]);
  const html = await guestsPage.text();
  const deniedHtml = await reservationsPage.text();
  if (guestsPage.status !== 200 || !html.includes('href="/dashboard/guests"') || !html.includes('href="/dashboard/calendar"')) throw new Error("Allowed navigation was not rendered");
  if (html.includes('href="/dashboard/reservations"') || html.includes('href="/dashboard/rates"') || html.includes('href="/dashboard/settings"')) throw new Error("Denied navigation leaked into the sidebar");
  const redirectLocation = reservationsPage.headers.get("location");
  const redirected = ([303, 307, 308].includes(reservationsPage.status) && redirectLocation === "/dashboard/calendar")
    || (reservationsPage.status === 200 && deniedHtml.includes("/dashboard/calendar") && deniedHtml.includes("NEXT_REDIRECT"));
  if (!redirected) throw new Error(`Denied page access returned ${reservationsPage.status} → ${redirectLocation}; body ${deniedHtml.slice(0, 300)}`);
  if (guestsExport.status !== 200 || reservationsExport.status !== 403) throw new Error("Export permission boundary failed");
  console.log(JSON.stringify({ ok: true, database: databaseName, permissions: ["CALENDAR", "GUESTS"], allowedPage: 200, deniedPage: reservationsPage.status, allowedExport: 200, deniedExport: 403, hiddenNavigation: true }, null, 2));
} finally {
  if (sessionId) await db.session.deleteMany({ where: { id: sessionId } });
  if (membershipId && membershipWasCreated) await db.membership.deleteMany({ where: { id: membershipId } });
  else if (membershipId && previousMembership) {
    await db.membership.update({ where: { id: membershipId }, data: { role: previousMembership.role, accessLevel: previousMembership.accessLevel, permissions: previousMembership.permissions, organizationId: previousMembership.organizationId } });
  }
  await db.$disconnect();
}
