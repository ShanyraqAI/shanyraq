import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const source = process.env.DATABASE_URL;
const databaseName = process.env.E2E_DATABASE_NAME ?? "shanyraq_e2e_test";
if (!source) throw new Error("DATABASE_URL is required");
if (!/(?:^|[_-])(test|dev|demo)$/i.test(databaseName)) throw new Error("Refusing to provision a non-test database");
const url = new URL(source);
url.pathname = `/${databaseName}`;
const db = new PrismaClient({ datasourceUrl: url.toString() });

async function provision(email, fullName, platformRole) {
  const password = `P2-${randomBytes(12).toString("base64url")}!`;
  const passwordHash = await bcrypt.hash(password, 12);
  let user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email, emailVerifiedAt: new Date(), fullName, firstName: fullName.split(" ")[0], passwordHash, onboardingCompleted: true, platformRole }, select: { id: true } });
      const organization = await tx.organization.create({ data: { name: `${fullName} E2E` } });
      const hotel = await tx.hotel.create({ data: { orgId: organization.id, slug: `phase2-${randomUUID()}`, name: `${fullName} Hotel`, timezone: "Asia/Almaty", currency: "KZT", country: "Казахстан" } });
      await tx.membership.create({ data: { organizationId: organization.id, userId: created.id, hotelId: hotel.id, role: "OWNER", accessLevel: "FULL" } });
      await tx.analyticsEvent.createMany({ data: [
        { eventType: "signup_completed", userId: created.id, organizationId: organization.id, hotelId: hotel.id, entityType: "User", entityId: created.id },
        { eventType: "hotel_created", userId: created.id, organizationId: organization.id, hotelId: hotel.id, entityType: "Hotel", entityId: hotel.id },
      ] });
      return created;
    });
  } else {
    await db.user.update({ where: { id: user.id }, data: { passwordHash, emailVerifiedAt: new Date(), onboardingCompleted: true, platformRole } });
  }
  return { email, password };
}

try {
  const admin = await provision("phase2-admin-e2e@shanyraq.test", "Phase Admin", "SUPER_ADMIN");
  const member = await provision("phase2-member-e2e@shanyraq.test", "Phase Member", null);
  console.log(JSON.stringify({ database: databaseName, admin, member }, null, 2));
} finally {
  await db.$disconnect();
}
