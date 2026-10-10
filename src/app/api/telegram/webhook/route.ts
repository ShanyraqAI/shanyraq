import { timingSafeEqual } from "node:crypto";
import { adminIds, handleCommand } from "@/lib/telegram-admin/bot";

export const runtime = "nodejs";
export const maxDuration = 30;

function validSecret(header: string | null): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function reply(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true }),
    cache: "no-store",
  });
}

export async function POST(request: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !validSecret(request.headers.get("x-telegram-bot-api-secret-token"))) return new Response("Unauthorized", { status: 401 });
  const update = await request.json().catch(() => null);
  const message = update?.message;
  // Always answer 200 so Telegram does not retry; non-admins are ignored silently.
  if (!message?.text || typeof message.chat?.id !== "number" || !adminIds().has(String(message.from?.id))) return Response.json({ ok: true });
  try {
    await reply(message.chat.id, await handleCommand(message.text, message.from.username ? `@${message.from.username}` : String(message.from.id)));
  } catch (error) {
    console.error("Telegram admin command failed", { incident: crypto.randomUUID(), error });
    await reply(message.chat.id, "Не удалось выполнить команду. Подробности в логах сервера.").catch(() => undefined);
  }
  return Response.json({ ok: true });
}
