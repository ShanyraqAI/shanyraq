import { readBoundedBody } from "@/lib/communications/body";
import { requireSameOrigin, communicationError } from "@/lib/communications/http";
import { digest, guestSigningCommandSchema } from "@/lib/documents/signing/security";
import { guestSigningCommand } from "@/lib/documents/signing/service";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { PublicError } from "@/server/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" };
// The capability is only in POST bodies, never in URL paths/queries or audit logs.
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await enforceRateLimit("guest-document-ip", "requests", 90, 60000);
    const parsed = guestSigningCommandSchema.safeParse(JSON.parse(new TextDecoder().decode(await readBoundedBody(request, 3000))));
    if (!parsed.success) throw new PublicError("Проверьте ссылку, имя и оба подтверждения");
    await enforceRateLimit("guest-document-token", digest(parsed.data.token), 60, 60000);
    const result = await guestSigningCommand(parsed.data);
    if (result.kind === "pdf") return new Response(new Uint8Array(result.bytes), { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="document.pdf"' } });
    return Response.json(result.data, { headers: { ...headers, ...(result.kind === "receipt" ? { "Content-Disposition": 'attachment; filename="signing-receipt.json"' } : {}) } });
  } catch (e) { const response = communicationError(e); for (const [key, value] of Object.entries(headers)) response.headers.set(key, value); return response; }
}
