"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";
import { mobileCopy, type AppLocale } from "@/lib/locale";
import { canOpenNavigation, mobileNavigationSection, type NavigationAccess } from "@/lib/navigation";
import { navigationForLocale } from "./nav-config";

export function MobileAppShell({ locale, permissions, accessLevel, isOwner }: { locale: AppLocale } & NavigationAccess) {
  const pathname = usePathname();
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const primary = ["/dashboard", "/dashboard/calendar", "/dashboard/reservations", "/dashboard/rooms"];
  const items = navigationForLocale(locale).main.filter((item) => primary.includes(item.href) && canOpenNavigation({ permissions, accessLevel, isOwner }, item.permission));
  const current = mobileNavigationSection(pathname);
  const tabs = [...items, { href: "/dashboard/more", title: mobileCopy[locale].nav.more, icon: Ellipsis }];
  return <nav aria-label={locale === "kk" ? "Негізгі навигация" : "Основная навигация"} className="fixed inset-x-0 bottom-0 z-50 border-t bg-background lg:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 5px)" }}>
    <div className="mx-auto grid max-w-5xl px-1 pt-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((item) => <Link key={item.href} href={item.href} aria-current={current === item.href ? "page" : undefined} className={cn("flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-xs font-semibold text-[#56635b] focus-visible:outline-2 focus-visible:outline-primary", current === item.href && "bg-accent text-accent-foreground")}><item.icon className="size-5 shrink-0" aria-hidden="true" strokeWidth={current === item.href ? 2.5 : 1.8} /><span>{item.title}</span></Link>)}
    </div>
  </nav>;
}
