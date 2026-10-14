import { getCurrentMembership } from "@/lib/tenant";
import { hasHotelPermission } from "@/lib/access";
import { PublicError, toErrorMessage, RateLimitError, AuthenticationError, AuthorizationError } from "@/server/errors";
import type { CurrentMembership } from "@/lib/tenant";
export async function requireCommunicationAccess(owner = false): Promise<CurrentMembership> {
  const member = await getCurrentMembership();
  if (!member) throw new AuthenticationError();
  if (!hasHotelPermission(member, "RESERVATIONS")) throw new AuthorizationError();
  if (owner && member.role !== "OWNER") throw new AuthorizationError();
  return member;
}
export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_URL || request.url).origin;
  if (!origin || origin !== expected) throw new PublicError("Запрос отклонён. Обновите страницу.");
}
export function privateJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff" } });
}
export function communicationError(error: unknown) {
  return privateJson({ error: toErrorMessage(error) }, error instanceof AuthenticationError ? 401 : error instanceof AuthorizationError ? 403 : error instanceof RateLimitError ? 429 : error instanceof PublicError ? 400 : 500);
}
