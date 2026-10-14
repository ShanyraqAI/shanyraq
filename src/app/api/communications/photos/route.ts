import sharp from "sharp";
import { db } from "@/lib/db";
import { requireCommunicationAccess, requireSameOrigin, privateJson, communicationError } from "@/lib/communications/http";
import { requireRoom, scopeOf } from "@/lib/communications/service";
import { MAX_PHOTOS, MAX_UPLOAD_BYTES, MAX_STORED_PHOTO_BYTES } from "@/lib/communications/schema";
import { readBoundedBody } from "@/lib/communications/body";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { PublicError } from "@/server/errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const m = await requireCommunicationAccess(true);
    if (request.headers.get("x-shanyraq-scope") !== scopeOf(m)) throw new PublicError("Вы сменили объект. Обновите страницу.");
    await enforceRateLimit("communication-photo-upload", m.userId, 20, 60000);
    const raw = await readBoundedBody(request, MAX_UPLOAD_BYTES + 64000);
    const form = await new Response(new Uint8Array(raw).buffer, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
    const roomId = form.get("roomId");
    const file = form.get("file");
    if (typeof roomId !== "string" || !(file instanceof File) || file.size === 0 || file.size > MAX_UPLOAD_BYTES) throw new PublicError("Выберите фото до 4 МБ");
    await requireRoom(m, roomId);
    let bytes: Buffer;
    try {
      const input = Buffer.from(await file.arrayBuffer());
      const image = sharp(input, { limitInputPixels: 40000000, animated: false });
      const meta = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) > 1) throw new Error("Unsupported format");
      // Decode, rotate, resize and re-encode; strip GPS/EXIF and reject SVG/HTML/polyglot payloads.
      bytes = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
      if (bytes.byteLength > MAX_STORED_PHOTO_BYTES) throw new Error("Too large");
    } catch { throw new PublicError("Не удалось обработать фото. Используйте JPEG, PNG или WebP до 4 МБ."); }
    const photo = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`communication-photo:${roomId}`}, 0))::text`;
      const where = { organizationId: m.organizationId, hotelId: m.hotelId, roomId, archivedAt: null };
      const [count, last] = await Promise.all([tx.communicationPhoto.count({ where }), tx.communicationPhoto.findFirst({ where, orderBy: { position: "desc" }, select: { position: true } })]);
      if (count >= MAX_PHOTOS) throw new PublicError(`Для квартиры можно добавить до ${MAX_PHOTOS} фото`);
      const saved = await tx.communicationPhoto.create({ data: { ...where, bytes: new Uint8Array(bytes), name: `Квартира · фото ${count + 1}.jpg`, position: (last?.position ?? -1) + 1 }, select: { id: true, name: true, position: true } });
      await tx.auditLog.create({ data: { hotelId: m.hotelId, actorUserId: m.userId, actor: m.userId, action: "communication.photo_added", entity: "CommunicationPhoto", entityId: saved.id } });
      return saved;
    });
    return privateJson(photo, 201);
  } catch (error) { return communicationError(error); }
}
