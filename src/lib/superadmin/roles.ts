export const PLATFORM_ADMIN_ROLE = "SUPER_ADMIN" as const;

export function isPlatformAdminRole(role: string | null | undefined): boolean {
  return role === PLATFORM_ADMIN_ROLE;
}
