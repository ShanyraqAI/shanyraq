import { BillingError } from "./policy";

export function paymentConfig() {
  const merchantId = process.env.FREEDOMPAY_MERCHANT_ID ?? "";
  const secret = process.env.FREEDOMPAY_SECRET_KEY ?? "";
  const mode = process.env.FREEDOMPAY_MODE ?? "test";
  const origin = process.env.APP_URL ?? "";
  if (!/^\d+$/.test(merchantId) || !secret || !["test", "live"].includes(mode)) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    return { merchantId, secret, mode, origin: url.origin };
  } catch { return null; }
}

export function requirePaymentConfig() {
  const config = paymentConfig();
  if (!config) throw new BillingError("Оплата ещё не подключена. Данные карты вводить не нужно.");
  return config;
}

/** Never enforce deadlines until the live provider and explicit rollout date are configured. */
export function billingLaunch(): Date | null {
  const value = process.env.BILLING_START_AT;
  if (process.env.BILLING_ENABLED !== "true" || paymentConfig()?.mode !== "live" || !value?.endsWith("Z")) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
