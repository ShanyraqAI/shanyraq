import { isIP } from "node:net";

/** Only trust a header that the ingress overwrites, never a client-provided chain. */
export function trustedClientAddress(values: Pick<Headers, "get">, env: { VERCEL?: string; TRUSTED_CLIENT_IP_HEADER?: string }): string {
  const header = env.VERCEL === "1" ? "x-vercel-forwarded-for" : env.TRUSTED_CLIENT_IP_HEADER;
  if (!header || !["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for", "cf-connecting-ip"].includes(header)) return "unknown";
  const address = values.get(header)?.trim();
  // Appended/untrusted proxy chains must not select their attacker-controlled first entry.
  if (!address || address.includes(",") || !isIP(address)) return "unknown";
  return isIP(address) === 6 ? new URL(`http://[${address}]`).hostname.toLowerCase() : address;
}
