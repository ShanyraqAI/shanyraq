import { stayDb as db } from "@/lib/guest-stay/db";
import {
  requireSameOrigin,
  communicationError,
} from "@/lib/communications/http";
import { readBoundedBody } from "@/lib/communications/body";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { guestCommand, hash, disabled } from "@/lib/guest-stay/policy";
import { guestStayCommand } from "@/lib/guest-stay/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  Vary: "Cookie",
};
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    disabled("GUEST_STAY_ENABLED");
    // Per-address limit is independent of guessed tokens, preventing token-rotation bypass.
    await enforceRateLimit("guest-stay-address", "public", 90, 60000);
    const c = guestCommand.parse(
      JSON.parse(
        new TextDecoder().decode(await readBoundedBody(request, 8000)),
      ),
    );
    await enforceRateLimit("guest-stay-token", hash(c.token), 60, 60000);
    const result = await guestStayCommand(db, c);
    if (result.kind === "photo")
      return new Response(new Uint8Array(result.bytes), {
        headers: { ...headers, "Content-Type": result.contentType },
      });
    if (result.kind === "pdf")
      return new Response(new Uint8Array(result.bytes), {
        headers: {
          ...headers,
          "Content-Type": "application/pdf",
          "Content-Disposition": "attachment; filename=document.pdf",
        },
      });
    return Response.json(result.data, { headers });
  } catch (e) {
    const response = communicationError(e);
    Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }
}
