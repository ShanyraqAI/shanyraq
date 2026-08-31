import { getCurrentHotelId, getCurrentMembership } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { assertBillingWriteAccess } from "@/lib/billing/service";

export type AccessRequirement = "CALENDAR" | "FULL";

export async function requireSectionAccess(required: AccessRequirement): Promise<void> {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");
  if (membership.role === "OWNER" || membership.accessLevel === "FULL") return;
  if (required === "CALENDAR" && membership.accessLevel === "CALENDAR") return;
  redirect("/dashboard");
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
export async function requireSessionHotelId(options: { allowExpiredSync?: boolean } = {}): Promise<string> {
  await requireSectionAccess("FULL");
  const membership = await getCurrentMembership();
  if (membership && !options.allowExpiredSync) await assertBillingWriteAccess(membership.organizationId);
  return getCurrentHotelId();
}
