import { timingSafeEqual } from "node:crypto";
import { adminIds, handleCommand } from "@/lib/telegram-admin/bot";
import { executeTelegramUpdate, privateAdminMessage } from "@/lib/telegram-admin/inbox";
import { readBoundedJson, BodyError } from "@/lib/security/request-body";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;
const updateSchema = z.object({
  update_id: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  message: z.object({
    text: z.string().max(4096).optional(),
    chat: z.object({ id: z.number().int().safe(), type: z.string() }),
    from: z.object({ id: z.number().int().safe(), is_bot: z.boolean().optional() }).optional(),
  }).optional(),
});
function validSecret(header: string | null): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(secret), b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}
async function reply(chatId: number, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true }),
    cache: "no-store", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Telegram reply failed");
}
export async function POST(request: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !validSecret(request.headers.get("x-telegram-bot-api-secret-token"))) return new Response("Unauthorized", { status: 401 });
  let body: unknown;
  try { body = await readBoundedJson(request, 24_000); }
  catch (error) { return new Response("Invalid request", { status: error instanceof BodyError ? error.status : 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: true });
  const { message, update_id: updateId } = parsed.data;
  // No administrative data or effects in groups, channels, or other users' chats.
  if (!message?.text || !privateAdminMessage(message, adminIds())) return Response.json({ ok: true });
  try {
    const text = message.text;
    const actorId = message.from!.id;
    const response = await executeTelegramUpdate(db, updateId, [actorId, message.chat.id, text],
      (tx) => handleCommand(text, String(actorId), tx));
    await reply(message.chat.id, response);
    return Response.json({ ok: true });
  } catch {
    // Retry is safe even if the command committed but sendMessage/HTTP response failed.
    console.error("Telegram admin command failed", { incident: crypto.randomUUID(), updateId });
    return new Response("Temporary failure", { status: 503 });
  }
}
