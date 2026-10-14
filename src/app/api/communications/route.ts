import { readBoundedBody } from "@/lib/communications/body";
import { commandSchema } from "@/lib/communications/schema";
import { requireCommunicationAccess, requireSameOrigin, privateJson, communicationError } from "@/lib/communications/http";
import { getCommunicationWorkspace, getReservationCommunicationWorkspace, runCommunicationCommand, scopeOf } from "@/lib/communications/service";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { PublicError } from "@/server/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const m = await requireCommunicationAccess();
    const params = new URL(request.url).searchParams;
    const id = params.get("reservationId");
    return privateJson(id ? await getReservationCommunicationWorkspace(m, id) : await getCommunicationWorkspace(m, params.get("cursor") ?? undefined));
  } catch (error) { return communicationError(error); }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    // Bounded input, including chunked requests without Content-Length.
    const raw = new TextDecoder().decode(await readBoundedBody(request, 24000));
    let input: unknown;
    try { input = JSON.parse(raw); } catch { throw new PublicError("Некорректный запрос. Обновите страницу."); }
    const parsed = commandSchema.safeParse(input);
    if (!parsed.success) throw new PublicError(parsed.error.issues[0]?.message ?? "Проверьте данные");
    const m = await requireCommunicationAccess(["saveProfile", "saveTemplate", "archivePhoto"].includes(parsed.data.action));
    if (request.headers.get("x-shanyraq-scope") !== scopeOf(m)) throw new PublicError("Вы сменили объект. Обновите страницу.");
    await enforceRateLimit("guest-communications", m.userId, 60, 60000);
    return privateJson(await runCommunicationCommand(m, parsed.data));
  } catch (error) { return communicationError(error); }
}
