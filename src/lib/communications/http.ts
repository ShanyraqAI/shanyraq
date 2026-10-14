import { getCurrentMembership } from "@/lib/tenant";
import { hasHotelPermission } from "@/lib/access";
import { PublicError, toErrorMessage, RateLimitError, AuthenticationError, AuthorizationError } from "@/server/errors";
import type { CurrentMembership } from "@/lib/tenant";
import { databaseFailure } from "./database-error";
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
  const failure = databaseFailure(error);
  if (failure) {
    const requestId = crypto.randomUUID();
    // No connection strings, tokens, message bodies, ORM messages or SQL in logs/responses.
    console.error("Communication request failed", { requestId, code: failure.code });
    return privateJson({ error: failure.message, code: failure.code, retryable: failure.retryable, requestId }, failure.status);
  }
  const status = error instanceof AuthenticationError ? 401 : error instanceof AuthorizationError ? 403 : error instanceof RateLimitError ? 429 : error instanceof PublicError ? 400 : 500;
  return privateJson({ error: toErrorMessage(error), code: status === 401 ? "SIGN_IN_REQUIRED" : status === 403 ? "ACCESS_DENIED" : "REQUEST_FAILED", retryable: status >= 500 || status === 429 }, status);
}
