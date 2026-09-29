import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { ChannelCredentials } from "@/lib/channels/types";
import { PublicError } from "@/server/errors";

const VERSION = "v1";

function encryptionKey(): Buffer {
  const raw = process.env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) throw new PublicError("Шифрование каналов не настроено. Обратитесь к администратору.");
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("CHANNEL_CREDENTIALS_ENCRYPTION_KEY must contain exactly 32 bytes");
  return key;
}

export function encryptSecret(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret<T>(envelope: string): T {
  const [version, ivPart, tagPart, dataPart] = envelope.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !dataPart) throw new Error("Unsupported encrypted credential envelope");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8")) as T;
}

export function encryptChannelCredentials(credentials: ChannelCredentials): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptChannelCredentials(envelope: string): ChannelCredentials {
  const [version, ivPart, tagPart, dataPart] = envelope.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !dataPart) throw new Error("Unsupported encrypted credential envelope");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const parsed = JSON.parse(plaintext) as Partial<ChannelCredentials>;
  return {
    propertyId: String(parsed.propertyId ?? ""),
    username: String(parsed.username ?? ""),
    apiKey: String(parsed.apiKey ?? ""),
  };
}
