"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, Ellipsis, House } from "lucide-react";
import { cn } from "@/lib/utils";
import { mobileCopy, type AppLocale } from "@/lib/locale";

export function MobileAppShell({ locale }: { locale: AppLocale }) {
  const pathname = usePathname();
  const copy = mobileCopy[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const items = [
    { href: "/dashboard", label: copy.nav.overview, icon: House, exact: true },
    { href: "/dashboard/calendar", label: copy.nav.calendar, icon: CalendarDays },
    { href: "/dashboard/reservations", label: copy.nav.reservations, icon: ClipboardList },
    { href: "/dashboard/more", label: copy.nav.more, icon: Ellipsis },
  ];

  return (
    <nav
      aria-label={locale === "kk" ? "Негізгі навигация" : "Основная навигация"}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e8e8df] bg-white/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 5px)" }}
    >
      <div className="mx-auto grid max-w-[430px] grid-cols-4 px-2 pt-1">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold text-[#90978f] transition-colors",
                active && "text-[#07866b]",
              )}
            >
              <item.icon className="size-[19px]" strokeWidth={active ? 2.5 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
