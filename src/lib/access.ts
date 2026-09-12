export const HOTEL_PERMISSIONS = [
  "OVERVIEW",
  "CALENDAR",
  "RESERVATIONS",
  "ROOMS",
  "GUESTS",
  "RATES",
  "REPORTS",
] as const;

export type HotelPermission = (typeof HOTEL_PERMISSIONS)[number];

export const HOTEL_PERMISSION_LABELS: Record<HotelPermission, string> = {
  OVERVIEW: "Обзор",
  CALENDAR: "Календарь",
  RESERVATIONS: "Бронирования",
  ROOMS: "Номера",
  GUESTS: "Гости",
  RATES: "Тарифы",
  REPORTS: "Отчёты",
};

const PERMISSION_SET = new Set<string>(HOTEL_PERMISSIONS);

export function legacyPermissions(accessLevel: string | null | undefined): HotelPermission[] {
  if (accessLevel === "FULL") return [...HOTEL_PERMISSIONS];
  if (accessLevel === "CALENDAR") return ["OVERVIEW", "CALENDAR"];
  return ["OVERVIEW"];
}

export function resolveHotelPermissions(input: {
  role?: string | null;
  accessLevel?: string | null;
  permissions?: readonly string[] | null;
}): HotelPermission[] {
  if (input.role === "OWNER") return [...HOTEL_PERMISSIONS];
  const stored = (input.permissions ?? []).filter((value): value is HotelPermission => PERMISSION_SET.has(value));
  return stored.length ? HOTEL_PERMISSIONS.filter((permission) => stored.includes(permission)) : legacyPermissions(input.accessLevel);
}

export function hasHotelPermission(
  input: { role?: string | null; accessLevel?: string | null; permissions?: readonly string[] | null },
  permission: HotelPermission,
): boolean {
  return resolveHotelPermissions(input).includes(permission);
}

export function accessLevelForPermissions(permissions: readonly HotelPermission[]): "OVERVIEW" | "CALENDAR" | "FULL" {
  const normalized = HOTEL_PERMISSIONS.filter((permission) => permissions.includes(permission));
  if (normalized.length === HOTEL_PERMISSIONS.length) return "FULL";
  if (normalized.length === 2 && normalized.includes("OVERVIEW") && normalized.includes("CALENDAR")) return "CALENDAR";
  if (normalized.length === 1 && normalized[0] === "OVERVIEW") return "OVERVIEW";
  // The legacy database constraint accepts only OVERVIEW/CALENDAR/FULL.
  // Non-empty `permissions` remains the source of truth for custom access.
  return "OVERVIEW";
}

export function firstAllowedDashboardPath(permissions: readonly HotelPermission[]): string {
  const paths: Record<HotelPermission, string> = {
    OVERVIEW: "/dashboard",
    CALENDAR: "/dashboard/calendar",
    RESERVATIONS: "/dashboard/reservations",
    ROOMS: "/dashboard/rooms",
    GUESTS: "/dashboard/guests",
    RATES: "/dashboard/rates",
    REPORTS: "/dashboard/reports",
  };
  return paths[permissions[0] ?? "OVERVIEW"];
}
