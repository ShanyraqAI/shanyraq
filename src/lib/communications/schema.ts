import { z } from "zod";
export const MAX_PHOTOS = 6;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_STORED_PHOTO_BYTES = 1024 * 1024;
const id = z.string().min(1).max(100);
const text = (max: number) => z.string().trim().max(max).default("");
const link = z.string().trim().max(1000).refine((value) => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}, "Укажите корректную HTTPS-ссылку").default("");
export const profileSchema = z.object({
  publicName: text(160), address: text(500), mapLink: link,
  wifiName: text(160), wifiPassword: text(160), keyInstructions: text(2000),
  rulesLink: link, checkinGuideLink: link, supportPhone: text(40),
});
export type ProfileInput = z.infer<typeof profileSchema>;
export const templateSchema = z.object({
  id: id.optional(), version: z.number().int().min(0), roomId: id.nullable(),
  name: z.string().trim().min(1, "Укажите название").max(160),
  body: z.string().trim().min(1).max(4096), language: z.enum(["ru", "kk", "en"]),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]), isDefault: z.boolean(),
});
export const commandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("saveProfile"), roomId: id, version: z.number().int().min(0), profile: profileSchema }),
  z.object({ action: z.literal("saveTemplate"), template: templateSchema }),
  z.object({ action: z.literal("prepare"), reservationId: id, templateId: id.optional(), body: z.string().trim().min(1).max(4096), photoIds: z.array(id).max(MAX_PHOTOS), requestKey: z.string().uuid() }),
  z.object({ action: z.literal("recordManual"), messageId: id, state: z.enum(["MANUAL_WHATSAPP_OPENED", "SHARE_RETURNED"]) }),
  z.object({ action: z.literal("archivePhoto"), photoId: id }),
]);
