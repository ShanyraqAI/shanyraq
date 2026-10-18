import { stayDb as db } from "@/lib/guest-stay/db";
import { catalogPhoto } from "@/lib/guest-stay/catalog";
import {
  communicationError,
  requireCommunicationAccess,
} from "@/lib/communications/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { disabled } from "@/lib/guest-stay/policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ listingId: string; position: string }> },
) {
  try {
    disabled("PUBLIC_CATALOG_ENABLED");
    await enforceRateLimit("catalog-photo", "public", 200, 60000);
    const p = await params;
    const preview =
      new URL(request.url).searchParams.get("preview") === "true"
        ? await requireCommunicationAccess(true)
        : undefined;
    const photo = await catalogPhoto(
      db,
      p.listingId,
      Number(p.position),
      preview,
    );
    if (!photo)
      return new Response(null, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    return new Response(new Uint8Array(photo.bytes), {
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return communicationError(e);
  }
}
