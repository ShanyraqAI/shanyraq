"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { APP_LOCALES, type AppLocale } from "@/lib/locale";

export async function setAppLocaleAction(locale: AppLocale) {
  if (!APP_LOCALES.includes(locale)) return { ok: false as const };

  const store = await cookies();
  store.set("shanyraq-locale", locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/dashboard", "layout");
  return { ok: true as const };
}

