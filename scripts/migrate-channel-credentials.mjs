import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function encryptionKey() {
  const raw = process.env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) throw new Error("CHANNEL_CREDENTIALS_ENCRYPTION_KEY is required");
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("CHANNEL_CREDENTIALS_ENCRYPTION_KEY must contain exactly 32 bytes");
  return key;
}

function encrypt(credentials) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decrypt(envelope) {
  const [version, ivPart, tagPart, dataPart] = envelope.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !dataPart) throw new Error("Invalid encrypted credential envelope");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8"));
}

function parseLegacyCredentials(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Legacy channel credentials must be a JSON object");
  for (const field of ["propertyId", "username", "apiKey"]) {
    if (typeof parsed[field] !== "string") throw new Error(`Legacy channel credentials contain an invalid ${field}`);
  }
  return { propertyId: parsed.propertyId, username: parsed.username, apiKey: parsed.apiKey };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const [legacyCount, encryptedCount] = await Promise.all([
    prisma.channelConnection.count({ where: { credentialsJson: { not: null } } }),
    prisma.channelConnection.count({ where: { credentialsEncrypted: { not: null } } }),
  ]);
  console.log(JSON.stringify({ legacyCount, encryptedCount, mode: apply ? "apply" : "check" }));
  if (!apply || legacyCount === 0) return;

  const legacyConnections = await prisma.channelConnection.findMany({
    where: { credentialsJson: { not: null } },
    select: { id: true, credentialsJson: true },
  });
  const updates = legacyConnections.map((connection) => {
    if (!connection.credentialsJson) throw new Error("Legacy credentials disappeared during migration");
    const credentials = parseLegacyCredentials(connection.credentialsJson);
    const encrypted = encrypt(credentials);
    if (JSON.stringify(decrypt(encrypted)) !== JSON.stringify(credentials)) throw new Error("Encrypted credential verification failed");
    return prisma.channelConnection.updateMany({
      where: { id: connection.id, credentialsJson: connection.credentialsJson },
      data: { credentialsEncrypted: encrypted, credentialsJson: null },
    });
  });

  const results = await prisma.$transaction(updates);
  if (results.some((result) => result.count !== 1)) throw new Error("A channel connection changed concurrently; no partial migration was committed");
  console.log(JSON.stringify({ migrated: results.length }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Channel credential migration failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
