import { db } from "@/lib/db";
import {
  requireCommunicationAccess,
  requireSameOrigin,
  privateJson,
  communicationError,
} from "@/lib/communications/http";
import { readBoundedBody } from "@/lib/communications/body";
import { assertBillingWriteAccess } from "@/lib/billing/service";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { PublicError } from "@/server/errors";
import { paymentCommand } from "@/lib/guest-payments/schema";
import {
  getPaymentSettings,
  getPaymentWorkspace,
  paymentScope,
  runPaymentCommand,
} from "@/lib/guest-payments/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function unavailable() {
  return privateJson(
    {
      error:
        "Приём оплаты по ссылке ещё не включён администратором. Сначала требуется применить проверенную миграцию и проверить Preview.",
      code: "NOT_ENABLED",
      retryable: false,
    },
    503,
  );
}
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams;
    const m = await requireCommunicationAccess(p.get("settings") === "1");
    if (process.env.GUEST_PAYMENT_LINKS_ENABLED !== "true")
      return unavailable();
    const id = p.get("reservationId");
    if (p.get("settings") === "1")
      return privateJson(await getPaymentSettings(db, m));
    if (!id || id.length > 200) throw new PublicError("Укажите бронь.");
    return privateJson(await getPaymentWorkspace(db, m, id));
  } catch (e) {
    return communicationError(e);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const raw = new TextDecoder().decode(await readBoundedBody(request, 10000));
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new PublicError("Некорректный запрос.");
    }
    const parsed = paymentCommand.safeParse(value);
    if (!parsed.success)
      throw new PublicError(
        parsed.error.issues[0]?.message ?? "Проверьте поля.",
      );
    const m = await requireCommunicationAccess(
      parsed.data.action === "saveMethod",
    );
    if (request.headers.get("x-shanyraq-scope") !== paymentScope(m))
      throw new PublicError("Объект изменился. Обновите страницу.");
    if (process.env.GUEST_PAYMENT_LINKS_ENABLED !== "true")
      return unavailable();
    if (parsed.data.action !== "validate")
      await assertBillingWriteAccess(m.organizationId);
    await enforceRateLimit(
      "guest-payment-links",
      `${m.userId}:${m.hotelId}`,
      40,
      60000,
    );
    return privateJson(await runPaymentCommand(db, m, parsed.data));
  } catch (e) {
    return communicationError(e);
  }
}
