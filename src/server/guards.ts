import { getSessionUser } from "@/lib/auth/session";
import { getCurrentHotelId } from "@/lib/db";

/**
 * Authorization guard for server actions.
 *
 * Pages are protected by `requireUser()` in the dashboard layout, but server
 * actions are independently addressable endpoints — every mutating action must
 * verify the session itself before touching data. This also enforces the
 * tenant boundary: the hotel id is resolved server-side and can never be
 * supplied by the client.
 */
export async function requireSessionHotelId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("Требуется вход в аккаунт");
  return getCurrentHotelId();
}
