import { getCurrentHotelId, getCurrentMembership } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { assertBillingWriteAccess } from "@/lib/billing/service";
import { AuthenticationError, AuthorizationError } from "@/server/errors";
import { firstAllowedDashboardPath, hasHotelPermission, resolveHotelPermissions, type HotelPermission } from "@/lib/access";

export type AccessRequirement = HotelPermission | "FULL";

export async function requireSectionAccess(required: AccessRequirement): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");
  if (required === "FULL") {
    if (membership.role === "OWNER" || membership.accessLevel === "FULL") return;
  } else if (hasHotelPermission(membership, required)) {
    return;
  }
  redirect(firstAllowedDashboardPath(resolveHotelPermissions(membership)));
}

/**
 * Authorization guard for server actions.
 *
 * Pages are protected by `requireUser()` in the dashboard layout, but server
 * actions are independently addressable endpoints — every mutating action must
 * verify the session itself before touching data. This also enforces the
 * tenant boundary: the hotel id is resolved server-side and can never be
 * supplied by the client.
 */
export async function requireSessionHotelId(options: { allowExpiredSync?: boolean; permission?: HotelPermission } = {}): Promise<string> {
  const membership = await getCurrentMembership();
  if (!membership) throw new AuthenticationError();
  const allowed = options.permission
    ? hasHotelPermission(membership, options.permission)
    : membership.role === "OWNER" || membership.accessLevel === "FULL";
  if (!allowed) {
    throw new AuthorizationError();
  }
  if (!options.allowExpiredSync) await assertBillingWriteAccess(membership.organizationId);
  return getCurrentHotelId();
}
