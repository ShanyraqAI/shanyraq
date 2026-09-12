import {
  APICallError,
  generateText,
  type ModelMessage,
} from "ai";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { RateLimitError } from "@/server/errors";
import {
  SUPPORT_ASSISTANT_PROMPT,
  SUPPORT_CHAT_MAX_MESSAGE_LENGTH,
  SUPPORT_CHAT_MAX_MESSAGES,
} from "@/lib/support/constants";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  chatId: z.string().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(SUPPORT_CHAT_MAX_MESSAGE_LENGTH),
      }),
    )
    .min(1)
    .max(SUPPORT_CHAT_MAX_MESSAGES),
});

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return jsonError("AI-консультант временно недоступен. Оставьте обращение менеджеру.", 503);
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Проверьте текст сообщения и попробуйте ещё раз.", 400);
  }

  const messages: ModelMessage[] = parsed.data.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  try {
    const user = await getSessionUser();
    await enforceRateLimit("support-ai-chat", user?.id ?? parsed.data.chatId, 30, 60 * 60_000);
    const hotel = user?.hotelId && user.organizationId
      ? await db.hotel.findFirst({
          where: { id: user.hotelId, orgId: user.organizationId },
          select: { name: true },
        })
      : null;

    const result = await generateText({
      model: process.env.AI_SUPPORT_MODEL || "spacexai/grok-4.1-fast-non-reasoning",
      system: [
        SUPPORT_ASSISTANT_PROMPT,
        hotel ? `Пользователь работает с объектом «${hotel.name}».` : "Пользователь находится на публичном сайте.",
      ].join("\n\n"),
      messages,
      maxOutputTokens: 500,
      providerOptions: {
        gateway: {
          user: user?.id || `anonymous:${parsed.data.chatId}`,
          tags: ["feature:support-chat"],
        },
      },
    });

    return new Response(result.text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return jsonError(error.message, 429);
    }
    if (APICallError.isInstance(error)) {
      if (error.statusCode === 429) {
        return jsonError("Слишком много сообщений. Попробуйте через минуту.", 429);
      }
      if (error.statusCode === 402) {
        return jsonError("AI-консультант временно недоступен. Оставьте обращение менеджеру.", 503);
      }
    }
    if (error instanceof Error && /unauthenticated|api.?key|oidc/i.test(error.message)) {
      return jsonError("AI-консультант временно недоступен. Оставьте обращение менеджеру.", 503);
    }
    console.error("Support assistant request failed", error);
    return jsonError("Не удалось получить ответ. Оставьте обращение менеджеру.", 502);
  }
}
