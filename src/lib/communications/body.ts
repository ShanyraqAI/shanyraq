import { PublicError } from "@/server/errors";
/** Enforces limits even when Content-Length is absent or dishonest. */
export async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length") || 0) > maxBytes) throw new PublicError("Слишком большой запрос");
  const reader = request.body?.getReader();
  if (!reader) throw new PublicError("Пустой запрос");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new PublicError("Слишком большой запрос"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}
