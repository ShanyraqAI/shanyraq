/** Server-only adapter. No retries: Mobizon does not document an idempotency key. */
export type SmsResult =
  { state: "ACCEPTED"; messageId: string } | { state: "REJECTED" | "UNKNOWN" };
export type SmsConfig = { apiKey: string; sender: string; secret: string };
export function smsConfig(
  env: Record<string, string | undefined> = process.env,
): SmsConfig | null {
  const {
    MOBIZON_API_KEY: apiKey,
    MOBIZON_SENDER: sender,
    DOCUMENT_OTP_SECRET: secret,
  } = env;
  if (
    env.DOCUMENT_SMS_ENABLED !== "true" ||
    !apiKey ||
    !sender ||
    !secret ||
    secret.length < 32
  )
    return null;
  if (!/^[A-Za-z0-9 ._-]{1,11}$/.test(sender)) return null;
  return { apiKey, sender, secret };
}
export async function sendOtpSms(
  config: SmsConfig,
  phone: string,
  code: string,
  fetcher: typeof fetch = fetch,
): Promise<SmsResult> {
  if (
    !/^7(?:700|701|702|705|706|707|708|747|771|775|776|777|778)\d{7}$/.test(
      phone,
    ) ||
    !/^\d{6}$/.test(code)
  )
    return { state: "REJECTED" };
  // Official API authenticates using apiKey in the query. Never log this URL,
  // fetch errors, body, OTP or provider messages. Disable HTTP URL tracing here.
  const url = new URL("https://api.mobizon.kz/service/Message/SendSmsMessage");
  url.search = new URLSearchParams({
    output: "json",
    api: "v1",
    apiKey: config.apiKey,
  }).toString();
  try {
    const response = await fetcher(url, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        recipient: phone,
        from: config.sender,
        text: `Shanyraq: kod ${code}. Podtverzhdenie dokumentov. Deistvuet 5 min. Nikomu ne soobshchaite.`,
        "params[shortenLinks]": "0",
      }),
    });
    // A non-2xx/invalid response can follow a successful paid acceptance.
    if (!response.ok) return { state: "UNKNOWN" };
    const raw = await response.text();
    if (raw.length > 10000) return { state: "UNKNOWN" };
    const value = JSON.parse(raw);
    if (
      value?.code === 0 &&
      /^[0-9A-Za-z_-]{1,100}$/.test(String(value?.data?.messageId ?? ""))
    )
      return { state: "ACCEPTED", messageId: String(value.data.messageId) };
    // Only documented validation rejection is definitely not an accepted send.
    if (value?.code === 1) return { state: "REJECTED" };
    return { state: "UNKNOWN" };
  } catch {
    return { state: "UNKNOWN" };
  }
}
