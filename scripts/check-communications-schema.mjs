// Read-only deployment gate. Never runs migrations, resets a DB or reads guest rows.
import { Prisma, PrismaClient } from "@prisma/client";
const environment = process.env.VERCEL_ENV;
if (!["preview", "production"].includes(environment)) {
  console.log("Skipping deployment schema check outside Vercel.");
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.error("Schema check: DATABASE_URL is missing for this environment.");
  process.exit(1);
}
const names = new Set(["CommunicationProfile", "CommunicationTemplate", "CommunicationTemplateVersion", "CommunicationPhoto", "GuestCommunication", "DocumentSigningRequest", "OperationReceipt"]);
if (process.env.GUEST_PAYMENT_LINKS_ENABLED === "true") {
  names.add("KaspiPaymentMethod");
  names.add("GuestPaymentRequest");
}
const models = Prisma.dmmf.datamodel.models.filter((model) => names.has(model.name));
const db = new PrismaClient();
try {
  const schema = new URL(process.env.DATABASE_URL).searchParams.get("schema") || "public";
  const columns = await db.$queryRaw`
    SELECT table_name, column_name, is_nullable FROM information_schema.columns
    WHERE table_schema = ${schema}
      AND table_name = ANY(${[...names, "ChannexBooking"]}::text[])
  `;
  const lookup = new Map(columns.map((column) => [`${column.table_name}.${column.column_name}`, column.is_nullable]));
  const missing = [];
  for (const model of models) {
    for (const field of model.fields.filter((field) => field.kind !== "object")) {
      const key = `${model.dbName || model.name}.${field.dbName || field.name}`;
      if (!lookup.has(key)) missing.push(key);
    }
  }
  if (models.length !== names.size || missing.length || !lookup.has("ChannexBooking.lastProviderRevisionAt") || lookup.get("GuestCommunication.recipientPhone") !== "YES") {
    console.error("Release schema is not ready. Apply the reviewed communication, signing, operation-receipt and enabled payment-link migrations to THIS environment's database, regenerate Prisma Client, then rebuild.");
    console.error("For preview, use a separate preview database. Never apply migrations to production to fix a preview.");
    process.exitCode = 1;
  } else console.log("PASS: required communication and reliability columns exist and recipient phone is optional (read-only check).");
} catch {
  // ORM exception messages can contain credentials, URLs or SQL. Do not print them.
  console.error("Schema check failed: verify this environment's DATABASE_URL, database access and schema. No database changes were made.");
  process.exitCode = 1;
} finally { await db.$disconnect(); }
