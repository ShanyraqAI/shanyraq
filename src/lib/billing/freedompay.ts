import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { BillingError } from "./policy";
import { requirePaymentConfig } from "./config";

export type PaymentFields = Record<string, string>;

// Freedom Pay Merchant API requires this signature algorithm (including MD5).
export function signPayment(script: string, fields: PaymentFields, secret: string): string {
  const values = Object.keys(fields).filter((key) => key !== "pg_sig").sort().map((key) => fields[key]);
  return createHash("md5").update([script, ...values, secret].join(";"), "utf8").digest("hex");
}

export function validSignature(script: string, fields: PaymentFields, secret: string): boolean {
  if (!/^[a-f0-9]{32}$/.test(fields.pg_sig ?? "") || !fields.pg_salt) return false;
  return timingSafeEqual(Buffer.from(signPayment(script, fields, secret), "hex"), Buffer.from(fields.pg_sig, "hex"));
}

function decodeXml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
    if (entity.startsWith("#")) {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return String.fromCodePoint(code);
    }
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[entity.toLowerCase()]!;
  });
}

/** Deliberately accepts only the flat scalar XML returned by init_payment.php. No DTD/entities/nested XML. */
export function parsePaymentXml(xml: string): PaymentFields {
  if (xml.length > 32_768 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Invalid provider response");
  const body = xml.trim().replace(/^<\?xml[^?]*\?>\s*/, "");
  const root = /^<response>\s*([\s\S]*?)\s*<\/response>$/.exec(body);
  if (!root) throw new Error("Invalid provider response");
  const fields: PaymentFields = Object.create(null);
  let remaining = root[1];
  while (remaining.trim()) {
    const empty = /^\s*<(pg_[a-z0-9_]+)\s*\/>\s*/.exec(remaining);
    if (empty) {
      if (Object.hasOwn(fields, empty[1])) throw new Error("Invalid provider fields");
      fields[empty[1]] = "";
      remaining = remaining.slice(empty[0].length);
      continue;
    }
    const field = /^\s*<(pg_[a-z0-9_]+)>(<!\[CDATA\[[\s\S]*?\]\]>|[^<]*)<\/\1>\s*/.exec(remaining);
    if (!field || Object.hasOwn(fields, field[1])) throw new Error("Invalid provider fields");
    fields[field[1]] = field[2].startsWith("<![CDATA[") ? field[2].slice(9, -3) : decodeXml(field[2]);
    remaining = remaining.slice(field[0].length);
  }
  return fields;
}

/** Recovery when a Result URL notification was delayed or missed. Nested refund responses fail closed for manual review. */
export async function fetchPaymentStatus(providerPaymentId: string) {
  const config = requirePaymentConfig();
  const fields: PaymentFields = { pg_merchant_id: config.merchantId, pg_payment_id: providerPaymentId, pg_salt: randomBytes(16).toString("hex") };
  fields.pg_sig = signPayment("get_status3.php", fields, config.secret);
  const response = await fetch("https://api.freedompay.kz/get_status3.php", {
    method: "POST", body: new URLSearchParams(fields), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Unable to verify payment");
  const result = parsePaymentXml(await response.text());
  if (!validSignature("get_status3.php", result, config.secret) || result.pg_status !== "ok" || result.pg_payment_id !== providerPaymentId) throw new Error("Unverified payment status");
  if (Number(result.pg_refund_amount ?? 0) !== 0 || Number(result.pg_revoke_amount ?? 0) !== 0) throw new BillingError("Возврат платежа требует проверки поддержкой.");
  return result;
}

export function safePaymentUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !(url.hostname === "freedompay.kz" || url.hostname.endsWith(".freedompay.kz"))) {
    throw new Error("Invalid payment destination");
  }
  return url.toString();
}

export async function initializePayment(order: { id: string; amountMinor: number; description: string; testMode: boolean }) {
  const config = requirePaymentConfig();
  const fields: PaymentFields = {
    pg_merchant_id: config.merchantId,
    pg_order_id: order.id,
    pg_amount: (order.amountMinor / 100).toFixed(2),
    pg_currency: "KZT",
    pg_description: order.description,
    pg_salt: randomBytes(16).toString("hex"),
    pg_testing_mode: order.testMode ? "1" : "0",
    pg_request_method: "POST",
    pg_check_url: `${config.origin}/api/billing/freedompay/check`,
    pg_result_url: `${config.origin}/api/billing/freedompay/result`,
    pg_success_url: `${config.origin}/dashboard/billing?payment=${order.id}`,
    pg_failure_url: `${config.origin}/dashboard/billing?payment=${order.id}`,
    pg_success_url_method: "GET",
    pg_failure_url_method: "GET",
    pg_lifetime: "1800",
    pg_postpone_payment: "0",
    pg_language: "ru",
    pg_recurring_start: "0",
  };
  fields.pg_sig = signPayment("init_payment.php", fields, config.secret);
  const response = await fetch("https://api.freedompay.kz/init_payment.php", {
    method: "POST", body: new URLSearchParams(fields), cache: "no-store",
    redirect: "error", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Payment initialization failed");
  const result = parsePaymentXml(await response.text());
  if (!validSignature("init_payment.php", result, config.secret) || result.pg_status !== "ok" || !/^\d+$/.test(result.pg_payment_id ?? "")) {
    throw new Error("Payment initialization rejected");
  }
  return { providerPaymentId: result.pg_payment_id, checkoutUrl: safePaymentUrl(result.pg_redirect_url) };
}

export function amountInMinorUnits(value: string): number | null {
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, cents = ""] = value.split(".");
  return Number(whole) * 100 + Number(cents.padEnd(2, "0"));
}

export async function readPaymentFields(request: Request): Promise<PaymentFields> {
  if (Number(request.headers.get("content-length") ?? 0) > 32_768) throw new BillingError("Invalid request");
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("application/x-www-form-urlencoded") && !type.startsWith("multipart/form-data")) throw new BillingError("Invalid request");
  // Bound streamed requests as well as requests declaring Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new BillingError("Invalid request");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 32_768) { await reader.cancel(); throw new BillingError("Invalid request"); }
    chunks.push(chunk.value);
  }
  const form = await new Response(Buffer.concat(chunks), { headers: { "content-type": type } }).formData();
  const fields: PaymentFields = Object.create(null);
  for (const [key, value] of form.entries()) {
    if (typeof value !== "string" || !/^[a-zA-Z0-9_]+$/.test(key) || Object.hasOwn(fields, key)) throw new BillingError("Invalid request");
    fields[key] = value;
  }
  return fields;
}

export function paymentReply(script: string, status: "ok" | "error" | "rejected", secret: string) {
  const fields = { pg_status: status, pg_description: status === "ok" ? "Accepted" : "Unable to accept", pg_salt: randomBytes(16).toString("hex") };
  const signature = signPayment(script, fields, secret);
  return new Response(`<?xml version="1.0" encoding="utf-8"?><response><pg_status>${status}</pg_status><pg_description>${fields.pg_description}</pg_description><pg_salt>${fields.pg_salt}</pg_salt><pg_sig>${signature}</pg_sig></response>`, {
    status: status === "error" ? 503 : 200,
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "no-store" },
  });
}
