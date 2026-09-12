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

let probeSessionId;
let probeEventId;
try {
  const [admin, member] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: "phase2-admin-e2e@shanyraq.test" }, select: { id: true, platformRole: true } }),
    db.user.findUniqueOrThrow({ where: { email: "phase2-member-e2e@shanyraq.test" }, select: { platformRole: true } }),
  ]);
  if (admin.platformRole !== "SUPER_ADMIN" || member.platformRole !== null) throw new Error("Platform roles are not isolated");

  const token = randomBytes(32).toString("hex");
  const session = await db.session.create({
    data: { userId: admin.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60_000) },
    select: { id: true },
  });
  probeSessionId = session.id;
  const origin = `http://127.0.0.1:${port}`;
  const response = await fetch(`${origin}/api/analytics/calendar-opened`, {
    method: "POST",
    headers: { origin, cookie: `shanyraq_session=${token}`, "content-type": "application/json" },
    body: JSON.stringify({ rangeDays: 30, guestEmail: "must-not-be-stored@example.com" }),
  });
  if (response.status !== 200) throw new Error(`Analytics endpoint returned ${response.status}`);
  const event = await db.analyticsEvent.findFirstOrThrow({ where: { sessionId: session.id }, orderBy: { occurredAt: "desc" } });
  probeEventId = event.id;
  if (event.eventType !== "calendar_opened" || !event.userId || !event.hotelId || !event.organizationId) throw new Error("Analytics context is incomplete");
  if (event.metadataJson !== JSON.stringify({ rangeDays: 30 })) throw new Error("Sensitive or unexpected metadata was stored");

  const anonymous = await fetch(`${origin}/api/analytics/calendar-opened`, { method: "POST", headers: { origin } });
  if (anonymous.status !== 401) throw new Error(`Anonymous analytics request returned ${anonymous.status}`);
  console.log(JSON.stringify({ ok: true, database: databaseName, adminRole: "isolated", analyticsEndpoint: "passed", anonymousRequest: "rejected", sensitiveMetadata: "excluded" }, null, 2));
} finally {
  if (probeEventId) await db.analyticsEvent.deleteMany({ where: { id: probeEventId } });
  if (probeSessionId) await db.session.deleteMany({ where: { id: probeSessionId } });
  await db.$disconnect();
}
