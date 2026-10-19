export class BodyError extends Error {
  constructor(readonly status: 400 | 413) { super(status === 413 ? "Payload too large" : "Invalid JSON"); }
}
/** Enforce the limit on streamed bytes, not only on an untrusted Content-Length. */
export async function readBoundedText(request: Request, maxBytes: number): Promise<string> {
  const length = request.headers.get("content-length");
  if (length && Number(length) > maxBytes) throw new BodyError(413);
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel().catch(() => undefined); throw new BodyError(413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  const text = await readBoundedText(request, maxBytes);
  try { return JSON.parse(text); } catch { throw new BodyError(400); }
}
