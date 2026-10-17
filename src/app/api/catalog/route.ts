import { stayDb as db } from "@/lib/guest-stay/db";
import { catalogView } from "@/lib/guest-stay/catalog";
import { range, disabled } from "@/lib/guest-stay/policy";
import {
  requireCommunicationAccess,
  communicationError,
  privateJson,
} from "@/lib/communications/http";
import { enforceRateLimit } from "@/lib/security/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    disabled("PUBLIC_CATALOG_ENABLED");
    await enforceRateLimit("catalog-read", "public", 100, 60000);
    const q = new URL(request.url).searchParams;
    const selection =
      q.has("checkIn") || q.has("checkOut")
        ? range.parse({
            checkIn: q.get("checkIn"),
            checkOut: q.get("checkOut"),
            guests: q.get("guests") ?? 1,
          })
        : undefined;
    const preview =
      q.get("preview") === "true"
        ? await requireCommunicationAccess(true)
        : undefined;
    return privateJson(
      await catalogView(
        db,
        q.get("slug") ?? "",
        q.get("listingId") || undefined,
        selection,
        preview,
      ),
    );
  } catch (e) {
    return communicationError(e);
  }
}
