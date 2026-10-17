import { db } from "@/lib/db";
import {
  requireCommunicationAccess,
  requireSameOrigin,
  privateJson,
  communicationError,
} from "@/lib/communications/http";
import { readBoundedBody } from "@/lib/communications/body";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { assertBillingWriteAccess } from "@/lib/billing/service";
import { PublicError } from "@/server/errors";
import { staffCommand } from "@/lib/agreements/policy";
import {
  agreementScope,
  agreementWorkspace,
  staffAgreement,
} from "@/lib/agreements/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function enabled() {
  if (process.env.GUEST_DOCUMENT_BUNDLES_ENABLED !== "true")
    throw new PublicError(
      "Пакеты документов ещё не включены. Требуются миграция и проверка Preview.",
    );
}
export async function GET(request: Request) {
  try {
    const m = await requireCommunicationAccess(true);
    enabled();
    const id = new URL(request.url).searchParams.get("reservationId");
    if (!id || id.length > 100) throw new PublicError("Укажите бронь.");
    return privateJson(await agreementWorkspace(db, m, id));
  } catch (e) {
    return communicationError(e);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const m = await requireCommunicationAccess(true);
    enabled();
    if (request.headers.get("x-shanyraq-scope") !== agreementScope(m))
      throw new PublicError("Объект изменился. Обновите страницу.");
    await enforceRateLimit(
      "agreement-owner",
      `${m.userId}:${m.hotelId}`,
      30,
      60000,
    );
    const value = staffCommand.safeParse(
      JSON.parse(
        new TextDecoder().decode(await readBoundedBody(request, 30000)),
      ),
    );
    if (!value.success)
      throw new PublicError("Проверьте поля пакета и подтверждения.");
    if (value.data.action === "create" || value.data.action === "publishRules")
      await assertBillingWriteAccess(m.organizationId);
    return privateJson(await staffAgreement(db, m, value.data));
  } catch (e) {
    return communicationError(e);
  }
}
