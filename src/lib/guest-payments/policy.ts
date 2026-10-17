/** Ordinary Kaspi Pay links only. No bank API, invoice parameters or payment verification. */
export const KASPI_HELP =
  "https://guide.kaspi.kz/partner/ru/pos/payments/remote/q2098";
export function kaspiUrl(value: string): string {
  const text = value.trim();
  if (/[\s\\%]/.test(text) || text.length > 500)
    throw new Error("Вставьте исходную ссылку точки продаж Kaspi Pay.");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Укажите HTTPS-ссылку Kaspi Pay.");
  }
  // Deliberately narrow application allowlist, not a claim of bank-side merchant validation.
  if (
    url.protocol !== "https:" ||
    url.hostname !== "pay.kaspi.kz" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/pay\/[a-zA-Z0-9_-]{1,160}\/?$/.test(url.pathname)
  ) {
    throw new Error(
      "Поддерживается только исходная ссылка https://pay.kaspi.kz/pay/… без дополнительных параметров.",
    );
  }
  return url.href;
}
export function moneyCents(value: string): number {
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(value))
    throw new Error("Сумма: не более двух знаков после точки.");
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 99_999_999_999_999)
    throw new Error("Слишком большая сумма.");
  return cents;
}
export function decimalMoney(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0)
    throw new Error("Некорректная сумма.");
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
export function paymentBalance(
  total: string,
  operations: Array<{
    amount: string;
    currency: string;
    status: string;
    type: string;
  }>,
  currency: string,
) {
  let paid = 0,
    refunded = 0;
  for (const row of operations) {
    if (row.currency !== currency || row.status !== "COMPLETED") continue;
    if (row.type === "PAYMENT") paid += moneyCents(row.amount);
    if (row.type === "REFUND") refunded += moneyCents(row.amount);
  }
  if (!Number.isSafeInteger(paid) || !Number.isSafeInteger(refunded))
    throw new Error("Проверьте финансовые операции.");
  return {
    paid: decimalMoney(paid),
    refunded: decimalMoney(refunded),
    remaining: decimalMoney(Math.max(0, moneyCents(total) - paid + refunded)),
  };
}
export function validatePaymentAmount(input: {
  amount: string;
  remaining: string;
  status: string;
  currency: string;
  paymentCollect: string | null;
  collectionConfirmed: boolean;
}) {
  if (input.currency !== "KZT")
    throw new Error("Kaspi Pay доступен для брони в KZT.");
  if (["CANCELLED", "NO_SHOW"].includes(input.status))
    throw new Error("Для отменённой брони или неявки запрос недоступен.");
  if (input.paymentCollect === "ota")
    throw new Error(
      "Оплату принимает канал. Не запрашивайте её повторно у гостя.",
    );
  if (input.paymentCollect !== "property" && !input.collectionConfirmed)
    throw new Error(
      "Подтвердите, что оплату должен принять объект, а не канал.",
    );
  const amount = moneyCents(input.amount);
  if (amount <= 0 || amount > moneyCents(input.remaining))
    throw new Error(
      "Запрос должен быть больше нуля и не превышать остаток проживания. Депозит учитывается отдельно.",
    );
  return decimalMoney(amount);
}
export function requestMessage(input: {
  booking: string;
  amount: string;
  recipient: string;
  url: string;
  locale: "ru" | "kk";
  purpose: "BALANCE" | "PREPAYMENT" | "CUSTOM";
}) {
  const amount = decimalMoney(moneyCents(input.amount));
  const url = kaspiUrl(input.url);
  return input.locale === "kk"
    ? `Бронь ${input.booking}. ${input.purpose === "PREPAYMENT" ? "Алдын ала төлем" : "Тұру ақысы"}: ${amount} KZT.\nАлушы: ${input.recipient}.\n${url}\nKaspi.kz ішінде соманы және бронь нөмірін өзіңіз енгізіңіз. Алушыны тексеріңіз. Қайтарылатын депозит бұл сомаға кірмейді.`
    : `Бронь ${input.booking}. ${input.purpose === "PREPAYMENT" ? "Предоплата" : "Оплата проживания"}: ${amount} KZT.\nПолучатель: ${input.recipient}.\n${url}\nВ Kaspi.kz самостоятельно введите сумму и номер брони. Проверьте получателя. Возвратный депозит в эту сумму не включён.`;
}
