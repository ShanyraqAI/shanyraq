import { PublicError } from "@/server/errors";
import { formatISODate } from "@/lib/dates";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!);
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  idempotencyKey: string,
  scheduledAt?: Date,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new PublicError("Отправка писем пока не настроена. Обратитесь к администратору.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      ...(scheduledAt ? { scheduled_at: scheduledAt.toISOString() } : {}),
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("Email provider rejected request", { status: response.status });
    throw new PublicError("Не удалось отправить письмо. Попробуйте позже.");
  }
}

export async function sendRegistrationCode(email: string, fullName: string, code: string, verificationId: string): Promise<void> {
  const safeName = escapeHtml(fullName);
  const safeCode = escapeHtml(code);
  await sendEmail(
    email,
    "Код подтверждения Shanyraq AI",
    `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033"><h2>Подтверждение регистрации</h2><p>Здравствуйте, ${safeName}.</p><p>Ваш код подтверждения:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 0">${safeCode}</div><p>Код действует 10 минут. Никому его не сообщайте.</p><p style="color:#64748b;font-size:13px">Если вы не регистрировались в Shanyraq AI, просто проигнорируйте письмо.</p></div>`,
    `registration-${verificationId}`,
  );
}

export async function sendPasswordResetCode(email: string, fullName: string, code: string, resetId: string): Promise<void> {
  await sendEmail(
    email,
    "Восстановление доступа к Shanyraq AI",
    `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033"><h2>Восстановление доступа</h2><p>Здравствуйте, ${escapeHtml(fullName)}.</p><p>Код для установки нового пароля:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 0">${escapeHtml(code)}</div><p>Код действует 10 минут. Если вы не запрашивали восстановление, никому не сообщайте код и просто проигнорируйте письмо.</p></div>`,
    `password-reset-${resetId}`,
  );
}

export async function sendHotelInvitation(email: string, hotelName: string, inviterName: string, invitationId: string): Promise<void> {
  const appUrl = process.env.APP_URL ?? "https://shanyraq-ten.vercel.app";
  await sendEmail(
    email,
    `Доступ к отелю «${hotelName}»`,
    `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033"><h2>Вас пригласили в Shanyraq AI</h2><p>${escapeHtml(inviterName)} предоставил вам доступ к отелю «${escapeHtml(hotelName)}».</p><p>Зарегистрируйтесь или войдите с адресом <strong>${escapeHtml(email)}</strong>. Доступ активируется после подтверждения почты.</p><p><a href="${escapeHtml(appUrl)}/register">Открыть Shanyraq AI</a></p></div>`,
    `hotel-invitation-${invitationId}`,
  );
}

interface SupportEmailInput {
  reference: string;
  name: string | null;
  contact: string;
  message: string;
  sourcePath: string;
  hotelName: string | null;
}

export async function sendSupportRequestNotification(input: SupportEmailInput): Promise<void> {
  const supportEmail = process.env.SUPPORT_EMAIL;
  if (!supportEmail) return;

  await sendEmail(
    supportEmail,
    `Новое обращение ${input.reference}`,
    `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#172033"><h2>Новое обращение ${escapeHtml(input.reference)}</h2><p><strong>Имя:</strong> ${escapeHtml(input.name ?? "Не указано")}</p><p><strong>Контакт:</strong> ${escapeHtml(input.contact)}</p><p><strong>Объект:</strong> ${escapeHtml(input.hotelName ?? "Публичный сайт")}</p><p><strong>Страница:</strong> ${escapeHtml(input.sourcePath)}</p><hr style="border:0;border-top:1px solid #e2e8f0;margin:20px 0"><p style="white-space:pre-wrap">${escapeHtml(input.message)}</p></div>`,
    `support-${input.reference}`,
  );
}

export async function sendNewReservationNotification(input: {
  to: string;
  recipientName: string;
  hotelName: string;
  reference: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  sourceChannel: string;
  totalAmount: number;
  currency: string;
  idempotencyKey: string;
}): Promise<void> {
  await sendEmail(
    input.to,
    `Новая бронь №${input.reference} — ${input.hotelName}`,
    `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#172033"><h2>Новая бронь №${escapeHtml(input.reference)}</h2><p>Здравствуйте, ${escapeHtml(input.recipientName)}.</p><p>В отеле «${escapeHtml(input.hotelName)}» создано новое бронирование.</p><table style="border-collapse:collapse;width:100%"><tr><td style="padding:7px 0;color:#64748b">Гость</td><td style="padding:7px 0;font-weight:600">${escapeHtml(input.guestName)}</td></tr><tr><td style="padding:7px 0;color:#64748b">Номер</td><td style="padding:7px 0;font-weight:600">${escapeHtml(input.roomNumber)}</td></tr><tr><td style="padding:7px 0;color:#64748b">Даты</td><td style="padding:7px 0">${escapeHtml(formatISODate(input.checkIn))} — ${escapeHtml(formatISODate(input.checkOut))}</td></tr><tr><td style="padding:7px 0;color:#64748b">Источник</td><td style="padding:7px 0">${escapeHtml(input.sourceChannel)}</td></tr><tr><td style="padding:7px 0;color:#64748b">Сумма</td><td style="padding:7px 0">${escapeHtml(new Intl.NumberFormat("ru-RU").format(input.totalAmount))} ${escapeHtml(input.currency)}</td></tr></table></div>`,
    input.idempotencyKey,
  );
}

export async function sendDailyOperationsDigest(input: {
  to: string;
  recipientName: string;
  hotelName: string;
  date: string;
  arrivals: string[];
  departures: string[];
  idempotencyKey: string;
  scheduledAt?: Date;
}): Promise<void> {
  const arrivals = input.arrivals.length ? `Номера: ${input.arrivals.join(", ")}` : "Нет";
  const departures = input.departures.length ? `Номера: ${input.departures.join(", ")}` : "Нет";
  const appUrl = process.env.APP_URL ?? "https://shanyraq-ten.vercel.app";
  await sendEmail(
    input.to,
    `План отеля на сегодня — ${input.hotelName}`,
    `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#172033"><h2>Доброе утро, ${escapeHtml(input.recipientName)}</h2><p>Короткая сводка по отелю «${escapeHtml(input.hotelName)}» на ${escapeHtml(formatISODate(input.date))}.</p><div style="display:flex;gap:12px"><div style="flex:1;padding:16px;border:1px solid #e2e8f0;border-radius:12px"><strong>Заезды: ${input.arrivals.length}</strong><p>${escapeHtml(arrivals)}</p></div><div style="flex:1;padding:16px;border:1px solid #e2e8f0;border-radius:12px"><strong>Выезды: ${input.departures.length}</strong><p>${escapeHtml(departures)}</p></div></div><p style="margin-top:22px"><a href="${escapeHtml(appUrl)}/dashboard">Открыть панель отеля</a></p></div>`,
    input.idempotencyKey,
    input.scheduledAt,
  );
}
