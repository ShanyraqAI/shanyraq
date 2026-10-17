/** Ephemeral tab memory, never localStorage, IndexedDB, shared cache or outbox.
 * Keys are server supplied and include user + organization + property + booking.
 * Signed document links and prepared attachment bytes are intentionally excluded.
 */
export interface ComposerMemory { text: string; templateId: string; photoIds: string[] }
const TTL = 15 * 60 * 1000;
const drafts = new Map<string, { expiresAt: number; value: ComposerMemory }>();
export function rememberComposer(key: string, value: ComposerMemory, now = Date.now()) {
  if (!key) return;
  for (const [id, entry] of drafts) if (entry.expiresAt <= now) drafts.delete(id);
  if (drafts.size >= 20 && !drafts.has(key)) drafts.delete(drafts.keys().next().value!);
  drafts.set(key, { expiresAt: now + TTL, value: { ...value, photoIds: [...value.photoIds] } });
}
export function recallComposer(key: string, now = Date.now()): ComposerMemory | null {
  const entry = drafts.get(key);
  if (!entry || entry.expiresAt <= now) { drafts.delete(key); return null; }
  return { ...entry.value, photoIds: [...entry.value.photoIds] };
}
export function clearComposerMemory() { drafts.clear(); }
