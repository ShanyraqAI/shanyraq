import "server-only";

import { cookies } from "next/headers";
import { normalizeLocale, type AppLocale } from "@/lib/locale";

export async function getRequestLocale(fallback?: string | null): Promise<AppLocale> {
  const store = await cookies();
  return normalizeLocale(store.get("shanyraq-locale")?.value ?? fallback);
}

