import { hasHotelPermission, type HotelPermission } from "@/lib/access";

/** Notification types whose content requires a section permission to read. */
const NOTIFICATION_TYPE_PERMISSIONS: Record<string, HotelPermission> = {
  NEW_RESERVATION: "RESERVATIONS",
};

export function notificationPermission(type: string): HotelPermission | null {
  return NOTIFICATION_TYPE_PERMISSIONS[type] ?? null;
}

export function canReceiveNotification(
  member: { role?: string | null; accessLevel?: string | null; permissions?: readonly string[] | null },
  type: string,
): boolean {
  const permission = notificationPermission(type);
  return permission === null || hasHotelPermission(member, permission);
}

export function hiddenNotificationTypes(permissions: readonly string[]): string[] {
  return Object.entries(NOTIFICATION_TYPE_PERMISSIONS)
    .filter(([, permission]) => !permissions.includes(permission))
    .map(([type]) => type);
}

const PUSH_EXACT_HOSTS = new Set(["fcm.googleapis.com", "android.googleapis.com", "web.push.apple.com"]);
const PUSH_HOST_SUFFIXES = [".push.services.mozilla.com", ".notify.windows.com", ".push.apple.com"];

/** Push delivery is a server-side request, so only browser push services are allowed (SSRF guard). */
export function isAllowedPushEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_EXACT_HOSTS.has(host) || PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}
