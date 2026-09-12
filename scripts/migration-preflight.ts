import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

type LegacyMembership = {
  membershipId: string;
  userId: string;
  organizationId: string;
  hotelCount: bigint;
  onlyHotelId: string | null;
};

async function main() {
  const legacyMemberships = await db.$queryRaw<LegacyMembership[]>`
    SELECT
      m.id AS "membershipId",
      m."userId" AS "userId",
      m."organizationId" AS "organizationId",
      COUNT(h.id) AS "hotelCount",
      CASE WHEN COUNT(h.id) = 1 THEN MIN(h.id) ELSE NULL END AS "onlyHotelId"
    FROM "Membership" m
    LEFT JOIN "Hotel" h ON h."orgId" = m."organizationId"
    WHERE m."hotelId" IS NULL
    GROUP BY m.id, m."userId", m."organizationId"
  `;
  console.log(JSON.stringify(legacyMemberships.map((row) => ({ ...row, hotelCount: Number(row.hotelCount) })), null, 2));
  if (legacyMemberships.some((row) => Number(row.hotelCount) !== 1 || !row.onlyHotelId)) process.exitCode = 1;
}

main().finally(() => db.$disconnect());
