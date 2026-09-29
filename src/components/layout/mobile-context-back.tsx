"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { AppLocale } from "@/lib/locale";

const parentRoutes: Array<[prefix: string, parent: string]> = [
  ["/dashboard/exports", "/dashboard/reports"],
  ["/dashboard/channels", "/dashboard/settings"],
  ["/dashboard/rates", "/dashboard/settings"],
  ["/dashboard/billing", "/dashboard/settings"],
  ["/dashboard/settings", "/dashboard/more"],
  ["/dashboard/reports", "/dashboard/more"],
  ["/dashboard/rooms", "/dashboard/more"],
  ["/dashboard/guests", "/dashboard/more"],
  ["/dashboard/activity", "/dashboard/more"],
];

export function MobileContextBack({ locale }: { locale: AppLocale }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pathname === "/dashboard/reports") return null;
  if (pathname === "/dashboard/settings" && searchParams.has("section")) return null;
  const route = parentRoutes.find(([prefix]) => pathname.startsWith(prefix));
  if (!route) return null;
  return <Link href={route[1]} className="mb-4 inline-flex min-h-9 items-center gap-1 rounded-full bg-white px-3 text-xs font-bold text-[#4f5b54] shadow-sm ring-1 ring-[#e5e8df] lg:hidden"><ChevronLeft className="size-4" />{locale === "kk" ? "Артқа" : "Назад"}</Link>;
}
