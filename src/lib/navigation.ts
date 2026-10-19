import type { HotelPermission } from "./access";

export type NavigationAccess = { permissions: readonly HotelPermission[]; accessLevel?: string | null; isOwner?: boolean };
export type NavigationRequirement = HotelPermission | "FULL" | HotelPermission[];
export function canOpenNavigation(access: NavigationAccess, requirement: NavigationRequirement, ownerOnly = false): boolean {
  if (ownerOnly && !access.isOwner) return false;
  if (requirement === "FULL") return Boolean(access.isOwner || access.accessLevel === "FULL");
  const allowed = (permission: HotelPermission) => Boolean(access.isOwner || access.permissions.includes(permission));
  return Array.isArray(requirement) ? requirement.some(allowed) : allowed(requirement);
}
export function isNavigationActive(pathname: string, href: string, tab: string | null = null): boolean {
  const url = new URL(href, "https://navigation.invalid");
  if (url.searchParams.has("tab")) return pathname === url.pathname && tab === url.searchParams.get("tab");
  if (pathname === "/dashboard/reports" && url.pathname === "/dashboard/reports" && tab === "payments") return false;
  return url.pathname === "/dashboard" ? pathname === url.pathname : pathname === url.pathname || pathname.startsWith(`${url.pathname}/`);
}
export function mobileNavigationSection(pathname: string): string {
  if (pathname === "/dashboard") return "/dashboard";
  for (const section of ["calendar", "reservations", "rooms"]) {
    const prefix = `/dashboard/${section}`;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return prefix;
  }
  return "/dashboard/more";
}
