import { db } from "@/lib/db";
import { requireCommunicationAccess, communicationError } from "@/lib/communications/http";
import { PublicError } from "@/server/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ photoId: string }> }) {
  try {
    const m = await requireCommunicationAccess();
    const { photoId } = await context.params;
    const messageId = new URL(request.url).searchParams.get("messageId");
    if (messageId) {
      const message = await db.guestCommunication.findFirst({ where: { id: messageId, organizationId: m.organizationId, hotelId: m.hotelId }, select: { attachments: true } });
      const attachments = message?.attachments as Array<{ id: string }> | undefined;
      if (!attachments?.some((photo) => photo.id === photoId)) throw new PublicError("Фото не найдено в сообщении");
    }
    const photo = await db.communicationPhoto.findFirst({ where: { id: photoId, organizationId: m.organizationId, hotelId: m.hotelId, ...(messageId ? {} : { archivedAt: null }) }, select: { bytes: true, contentType: true } });
    if (!photo) throw new PublicError("Фото не найдено");
    return new Response(new Uint8Array(photo.bytes), { headers: {
      "Content-Type": photo.contentType, "Content-Disposition": `inline; filename="apartment.jpg"`,
      "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin", "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch (error) { return communicationError(error); }
}
