import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser, type SessionUser } from "@/lib/auth/session";
import { isPlatformAdminRole } from "@/lib/superadmin/roles";

export const requirePlatformAdmin = cache(async (): Promise<SessionUser> => {
  const user = await requireUser();
  if (!isPlatformAdminRole(user.platformRole)) notFound();
  return user;
});
