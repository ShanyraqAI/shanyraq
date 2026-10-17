import { db } from "@/lib/db";
import {
  requireSameOrigin,
  privateJson,
  communicationError,
} from "@/lib/communications/http";
import { readBoundedBody } from "@/lib/communications/body";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { PublicError } from "@/server/errors";
import { guestCommand, hash } from "@/lib/agreements/policy";
import { guestAgreement } from "@/lib/agreements/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (process.env.GUEST_DOCUMENT_BUNDLES_ENABLED !== "true")
      throw new PublicError("Подтверждение пакетов пока недоступно.");
    const parsed = guestCommand.safeParse(
      JSON.parse(
        new TextDecoder().decode(await readBoundedBody(request, 6000)),
      ),
    );
    if (!parsed.success)
      throw new PublicError("Некорректный запрос. Откройте ссылку заново.");
    await enforceRateLimit(
      "agreement-guest",
      hash(parsed.data.token),
      40,
      60000,
    );
    // SMS is billable to the owner; public holders cannot bypass subscription policy.
    if (parsed.data.action === "otp") {
      const bundle = await db.agreementBundle.findUnique({
        where: { tokenHash: hash(parsed.data.token) },
        select: { organizationId: true },
      });
      if (!bundle) throw new PublicError("Ссылка недоступна.");
      const { assertBillingWriteAccess } =
        await import("@/lib/billing/service");
      await assertBillingWriteAccess(bundle.organizationId);
    }
    const result = await guestAgreement(db, parsed.data);
    if (result.kind === "pdf")
      return new Response(new Uint8Array(result.bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "attachment; filename=document.pdf",
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      });
    return privateJson(result.data);
  } catch (e) {
    return communicationError(e);
  }
}
