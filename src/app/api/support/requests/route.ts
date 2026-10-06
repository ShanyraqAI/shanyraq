import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { sendSupportRequestNotification } from "@/lib/email";
import { sendSupportRequestTelegram } from "@/lib/support/telegram";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { RateLimitError, toErrorMessage } from "@/server/errors";

export const runtime = "nodejs";

const requestSchema = z.object({
  source: z.enum(["LANDING", "DASHBOARD"]),
  sourcePath: z.string().trim().regex(/^\/[^\s]*$/).max(300),
  name: z.string().trim().max(100).optional(),
  contact: z.string().trim().min(5).max(160),
  message: z.string().trim().min(10).max(4_000),
  transcript: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(2_000),
  })).max(20),
});

function referenceFor(id: string) {
  return `SUP-${id.slice(-6).toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: "Заполните контакт и опишите вопрос подробнее." }, { status: 400 });
    }

    const user = await getSessionUser();
    await enforceRateLimit(
      "support-request",
      user?.id ?? parsed.data.contact,
      5,
      60 * 60_000,
    );

    const hotel = user?.hotelId && user.organizationId
      ? await db.hotel.findFirst({
          where: { id: user.hotelId, orgId: user.organizationId },
          select: { id: true, name: true },
        })
      : null;

    const ticket = await db.supportRequest.create({
      data: {
        organizationId: user?.organizationId ?? null,
        hotelId: hotel?.id ?? null,
        userId: user?.id ?? null,
        category: "QUESTION",
        message: parsed.data.message,
        sourcePath: parsed.data.sourcePath,
        name: parsed.data.name || null,
        contact: parsed.data.contact,
        transcriptJson: parsed.data.transcript.length ? JSON.stringify(parsed.data.transcript) : null,
      },
      select: { id: true },
    });

    const reference = referenceFor(ticket.id);
    const notification = {
      reference,
      name: parsed.data.name || null,
      contact: parsed.data.contact,
      message: parsed.data.message,
      sourcePath: parsed.data.sourcePath,
      hotelName: hotel?.name ?? null,
    };
    const [email, telegram] = await Promise.allSettled([
      sendSupportRequestNotification(notification),
      sendSupportRequestTelegram(notification),
    ]);
    if (email.status === "rejected") console.error("Support request email notification failed", email.reason);
    if (telegram.status === "rejected") console.error("Support request Telegram notification failed", telegram.reason);

    return Response.json({ reference }, { status: 201 });
  } catch (error) {
    const status = error instanceof RateLimitError ? 429 : 500;
    return Response.json({ error: toErrorMessage(error) }, { status });
  }
}
