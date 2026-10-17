import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
export const CONSENT_VERSION = "bundle-acknowledgement-v1";
export const OWNER_CONSENT =
  "Я проверил весь пакет, уполномочен действовать от владельца и подтверждаю его передачу гостю. Это фиксация моего действия без ЭЦП.";
export const GUEST_CONSENT =
  "Я ознакомился с выбранными условиями и подтверждаю их принятие. Это фиксация действия без ЭЦП и независимой проверки личности.";
export const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export const otpCode = () => String(randomInt(0, 1000000)).padStart(6, "0");
export const phoneHash = (secret: string, phone: string) =>
  createHmac("sha256", secret).update(`phone:${phone}`).digest("hex");
export const otpHash = (
  secret: string,
  id: string,
  bundleHash: string,
  phone: string,
  code: string,
) =>
  createHmac("sha256", secret)
    .update(
      JSON.stringify([
        CONSENT_VERSION,
        id,
        bundleHash,
        phone,
        "ACCEPT_BUNDLE",
        code,
      ]),
    )
    .digest("hex");
export const equalHash = (a: string, b: string) =>
  /^[a-f0-9]{64}$/.test(a) &&
  /^[a-f0-9]{64}$/.test(b) &&
  timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
export function normalizePhone(value: string | null) {
  const p = (value ?? "").replace(/[\s()+-]/g, "");
  // Do not silently convert 8-prefixes or use another guest's phone.
  return /^7(?:700|701|702|705|706|707|708|747|771|775|776|777|778)\d{7}$/.test(
    p,
  )
    ? p
    : null;
}
export function bundleLink(base: string, value: string) {
  const url = new URL(base);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("HTTPS required");
  if (url.username || url.password) throw new Error("Invalid origin");
  return `${url.origin}/guest/agreements#${value}`;
}
const id = z.string().min(1).max(100);
const name = z
  .string()
  .trim()
  .min(2)
  .max(160)
  .refine((v) => !/[\x00-\x1f\x7f]/.test(v));
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const staffBase = { reservationId: id };
export const staffCommand = z.discriminatedUnion("action", [
  z
    .object({
      ...staffBase,
      action: z.literal("publishRules"),
      text: z.string().trim().min(10).max(6000),
      version: z.number().int().min(0),
      published: z.boolean(),
      publicContentConfirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      ...staffBase,
      action: z.literal("create"),
      requestKey: z.string().uuid(),
      revision: digest,
      documents: z
        .array(z.object({ id, required: z.boolean() }).strict())
        .min(1)
        .max(8),
      depositTerms: z.string().trim().min(10).max(6000),
      cancellationTerms: z.string().trim().min(10).max(6000),
      guide: z.string().trim().min(10).max(6000),
      ownerName: name,
      authority: z.literal(true),
      approved: z.literal(true),
      requireOtp: z.boolean(),
      expiresInDays: z.number().int().min(1).max(14),
    })
    .strict(),
  z
    .object({ ...staffBase, action: z.literal("revoke"), bundleId: id })
    .strict(),
  z
    .object({ ...staffBase, action: z.literal("evidence"), bundleId: id })
    .strict(),
]);
const guestBase = { token: digest };
export const guestCommand = z.discriminatedUnion("action", [
  z.object({ ...guestBase, action: z.literal("load") }).strict(),
  z.object({ ...guestBase, action: z.literal("pdf"), itemId: id }).strict(),
  z
    .object({
      ...guestBase,
      action: z.literal("otp"),
      requestKey: z.string().uuid(),
      bundleHash: digest,
    })
    .strict(),
  z
    .object({
      ...guestBase,
      action: z.literal("accept"),
      bundleHash: digest,
      signerName: name,
      acceptedItems: z.array(id).min(1).max(12),
      intent: z.literal(true),
      consentVersion: z.literal(CONSENT_VERSION),
      challengeId: id.optional(),
      code: z
        .string()
        .regex(/^\d{6}$/)
        .optional(),
    })
    .strict(),
  z.object({ ...guestBase, action: z.literal("evidence") }).strict(),
]);
