import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { hash } from "@/lib/agreements/policy";
import {
  isISODate,
  parseISODate,
  diffDays,
  todayInTimeZone,
  toISODate,
} from "@/lib/dates";
import { PublicError } from "@/server/errors";
export { hash };
export const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .regex(/^[^\x00-\x08\x0b\x0c\x0e-\x1f\x7f]*$/);
export const httpsUrl = text(500).refine((v) => {
  if (!v) return true;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}, "Нужна HTTPS-ссылка");
export const date = z.string().refine(isISODate);
export const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const range = z
  .object({
    checkIn: date,
    checkOut: date,
    guests: z.coerce.number().int().min(1).max(20).default(1),
  })
  .refine(
    (v) =>
      isISODate(v.checkIn) &&
      isISODate(v.checkOut) &&
      v.checkOut > v.checkIn &&
      diffDays(parseISODate(v.checkIn), parseISODate(v.checkOut)) <= 90,
    "Выберите период от 1 до 90 ночей",
  );
export const listingInput = z
  .object({
    title: text(160).min(1),
    description: text(6000),
    publicLocation: text(500),
    amenities: text(2000),
    restrictions: text(2000),
    contactUrl: httpsUrl,
    photoIds: z.array(id).max(6),
    ratePlanId: id.nullable(),
    published: z.boolean(),
    publicContentConfirmed: z.literal(true),
  })
  .strict();
export const policyInput = z
  .object({
    identityMode: z.enum(["NONE", "ORIGINAL_AT_ARRIVAL"]),
    requireArrival: z.boolean(),
    requireAgreement: z.boolean(),
    parking: text(2000).default(""),
    checkoutInstructions: text(2000).default(""),
    entryPhotoIds: z.array(id).max(6).default([]),
  })
  .strict();
export const formInput = z
  .object({
    firstName: text(80).min(1),
    lastName: text(80).min(1),
    phone: text(40),
    arrivalTime: time.or(z.literal("")),
  })
  .strict();
export const staffCommand = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("saveListing"),
      roomId: id,
      version: z.number().int().min(0),
      listing: listingInput,
    })
    .strict(),
  z
    .object({
      action: z.literal("savePolicy"),
      roomId: id,
      version: z.number().int().min(0),
      policy: policyInput,
    })
    .strict(),
  z
    .object({
      action: z.literal("create"),
      reservationId: id.optional(),
      roomId: id,
      checkIn: date,
      checkOut: date,
      requestKey: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("decision"),
      stayId: id,
      version: z.number().int().min(1),
      decision: z.enum([
        "ACCEPT",
        "CORRECTION",
        "GRANT",
        "REVOKE_ACCESS",
        "REVOKE_LINK",
        "ROTATE",
        "ORIGINAL_CHECKED",
        "BIND_AGREEMENT",
        "LINK_RESERVATION",
        "SET_REQUIREMENTS",
      ]),
      reason: text(1000).min(3),
      referenceId: id.optional(),
      requirements: policyInput
        .pick({
          identityMode: true,
          requireArrival: true,
          requireAgreement: true,
        })
        .optional(),
    })
    .strict(),
]);
export const guestCommand = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("photo"),
      token: z.string().regex(/^[a-f0-9]{64}$/),
      position: z.number().int().min(0).max(5),
    })
    .strict(),
  z
    .object({
      action: z.literal("load"),
      token: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
  z
    .object({
      action: z.literal("save"),
      token: z.string().regex(/^[a-f0-9]{64}$/),
      version: z.number().int().min(1),
      revision: z.string().regex(/^[a-f0-9]{64}$/),
      form: formInput,
      submit: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("agreement"),
      token: z.string().regex(/^[a-f0-9]{64}$/),
      command: z.enum(["load", "accept", "pdf", "evidence"]),
      bundleId: id.optional(),
      bundleHash: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
      acceptedItems: z.array(id).max(12).optional(),
      signerName: text(160).optional(),
      intent: z.literal(true).optional(),
      itemId: id.optional(),
    })
    .strict(),
]);
function key() {
  const value = process.env.GUEST_STAY_SECRET ?? "";
  if (!/^[a-f0-9]{64}$/.test(value))
    throw new PublicError(
      "Настройте серверный GUEST_STAY_SECRET (32 случайных байта в hex).",
    );
  return Buffer.from(value, "hex");
}
export function seal(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64",
  );
}
export function unseal(value: string) {
  const b = Buffer.from(value, "base64"),
    cipher = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  cipher.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([
    cipher.update(b.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}
export function capability() {
  const value = randomBytes(32).toString("hex");
  return { tokenHash: hash(value), sealedToken: seal(value) };
}
export function stayLink(sealed: string) {
  const u = new URL(process.env.APP_URL ?? "");
  if (
    u.username ||
    u.password ||
    (u.protocol !== "https:" &&
      !(
        u.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(u.hostname)
      ))
  )
    throw new PublicError("Настройте HTTPS APP_URL.");
  return `${u.origin}/guest/stay#${unseal(sealed)}`;
}
export function checkoutPassed(
  checkOut: Date,
  checkOutTime: string,
  timezone: string,
  now = new Date(),
) {
  const day = toISODate(todayInTimeZone(timezone, now));
  const localTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return (
    day > toISODate(checkOut) ||
    (day === toISODate(checkOut) && localTime >= checkOutTime)
  );
}
export const disabled = (
  flag: "PUBLIC_CATALOG_ENABLED" | "GUEST_STAY_ENABLED",
) => {
  if (process.env[flag] !== "true")
    throw new PublicError("Функция пока не включена.");
};
