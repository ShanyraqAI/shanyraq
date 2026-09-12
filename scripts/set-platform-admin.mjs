import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const [mode, rawIdentifier] = process.argv.slice(2);
const identifier = rawIdentifier?.trim().toLowerCase();

if (!["grant", "revoke"].includes(mode) || !identifier) {
  throw new Error("Usage: node --env-file=.env scripts/set-platform-admin.mjs [grant|revoke] <exact-email-or-phone>");
}

async function main() {
  const matches = await db.user.findMany({
    where: identifier.includes("@") ? { email: identifier } : { phone: rawIdentifier.trim() },
    select: { id: true, email: true, phone: true, fullName: true, platformRole: true },
    take: 2,
  });
  if (matches.length !== 1) throw new Error(`Expected exactly one user, found ${matches.length}. No changes made.`);
  const user = matches[0];
  const platformRole = mode === "grant" ? "SUPER_ADMIN" : null;
  const updated = await db.user.update({
    where: { id: user.id },
    data: { platformRole },
    select: { id: true, email: true, phone: true, fullName: true, platformRole: true },
  });
  console.log(JSON.stringify({ changed: user.platformRole !== platformRole, user: updated }, null, 2));
}

try {
  await main();
} finally {
  await db.$disconnect();
}
