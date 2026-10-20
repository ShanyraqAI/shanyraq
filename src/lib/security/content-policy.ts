/** Script nonces are generated at the ingress for each HTML request, never from client input. */
export function contentSecurityPolicy(nonce: string, development: boolean, guest: boolean): string {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(nonce)) throw new Error("Invalid CSP nonce");
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    `frame-src 'self'${guest ? "" : " https://staging.channex.io https://app.channex.io"}`,
    "form-action 'self'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // Radix, charts and React use inline style attributes; do not confuse this with script permission.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${guest ? "" : " https:"}`,
    "font-src 'self' data:",
    `connect-src 'self'${guest ? "" : " https://*.blob.vercel-storage.com"}`,
    ...(!development ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
