import { z } from "zod";
import { readBoundedBody } from "@/lib/communications/body";
import { requireCommunicationAccess, requireSameOrigin, privateJson, communicationError } from "@/lib/communications/http";
import { scopeOf } from "@/lib/communications/service";
import { getSigningWorkspace, createSigningRequest, revokeSigningRequest, staffSigningReceipt } from "@/lib/documents/signing/service";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { PublicError } from "@/server/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const commandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), documentId: z.string().min(1).max(100), expiresInDays: z.number().int().min(1).max(14) }),
  z.object({ action: z.literal("revoke"), requestId: z.string().min(1).max(100) }),
  z.object({ action: z.literal("receipt"), requestId: z.string().min(1).max(100) }),
]);
export async function GET(request: Request) {
  try { const m = await requireCommunicationAccess(); const id = new URL(request.url).searchParams.get("reservationId"); if (!id || id.length > 100) throw new PublicError("Укажите бронь"); return privateJson(await getSigningWorkspace(m, id)); } catch (e) { return communicationError(e); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const m = await requireCommunicationAccess();
    if (request.headers.get("x-shanyraq-scope") !== scopeOf(m)) throw new PublicError("Вы сменили объект. Обновите страницу.");
    await enforceRateLimit("document-signing-staff", m.userId, 30, 60000);
    const parsed = commandSchema.safeParse(JSON.parse(new TextDecoder().decode(await readBoundedBody(request, 3000))));
    if (!parsed.success) throw new PublicError("Проверьте данные запроса");
    const c = parsed.data;
    return privateJson(c.action === "create" ? await createSigningRequest(m, c.documentId, c.expiresInDays) : c.action === "revoke" ? await revokeSigningRequest(m, c.requestId) : await staffSigningReceipt(m, c.requestId));
  } catch (e) { return communicationError(e); }
}
