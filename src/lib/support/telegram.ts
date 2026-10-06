interface SupportTelegramInput {
  reference: string;
  name: string | null;
  contact: string;
  message: string;
  sourcePath: string;
  hotelName: string | null;
}

// Telegram rejects messages longer than 4096 characters.
const MAX_MESSAGE_LENGTH = 4_000;

function escapeHtml(value: string): string {
  return value.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]!);
}

export async function sendSupportRequestTelegram(input: SupportTelegramInput): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_SUPPORT_CHAT_ID;
  if (!token || !chatId) return;

  const header = [
    `<b>Новое обращение ${escapeHtml(input.reference)}</b>`,
    `<b>Имя:</b> ${escapeHtml(input.name ?? "Не указано")}`,
    `<b>Контакт:</b> ${escapeHtml(input.contact)}`,
    `<b>Объект:</b> ${escapeHtml(input.hotelName ?? "Публичный сайт")}`,
    `<b>Страница:</b> ${escapeHtml(input.sourcePath)}`,
    "",
  ].join("\n");
  const room = MAX_MESSAGE_LENGTH - header.length;
  const message = input.message.length > room ? `${input.message.slice(0, room - 1)}…` : input.message;

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: header + escapeHtml(message),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Telegram rejected support notification (status ${response.status})`);
  }
}
