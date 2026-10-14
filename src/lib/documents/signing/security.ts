import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
export const CONSENT_VERSION = "guest-document-signing-v1";
export const CONSENT_TEXT = "Я ознакомился(ась) с полным PDF-документом, согласен(на) с его условиями и намерен(на) подписать его онлайн указанным мной именем. Я понимаю, что это подтверждение по ссылке без ЭЦП и без независимой проверки личности.";
export const MAX_SIGNING_PDF_BYTES = 2 * 1024 * 1024;
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const guestSigningCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("load"), token: tokenSchema }),
  z.object({ action: z.literal("pdf"), token: tokenSchema }),
  z.object({ action: z.literal("receipt"), token: tokenSchema }),
  z.object({ action: z.literal("sign"), token: tokenSchema, signerName: z.string().trim().min(2, "Укажите полное имя").max(160).refine((v) => !/[\u0000-\u001f\u007f]/.test(v), "Уберите специальные символы"), accepted: z.literal(true), intent: z.literal(true), pdfHash: z.string().regex(/^[a-f0-9]{64}$/), consentVersion: z.literal(CONSENT_VERSION) }),
]);
export function digest(value: string | Uint8Array): string { return createHash("sha256").update(value).digest("hex"); }
export function newSigningToken(): string { return randomBytes(32).toString("hex"); }
export function signingLink(origin: string, token: string): string {
  tokenSchema.parse(token);
  const base = new URL(origin);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) throw new Error("Signing links require HTTPS");
  const link = new URL("/guest/documents", base.origin);
  // Fragments are not sent in requests/referrers; public API also receives the capability in a POST body.
  link.hash = token;
  return link.toString();
}
