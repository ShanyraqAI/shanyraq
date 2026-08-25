"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, Hotel } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_MAIN, NAV_SECONDARY } from "./nav-config";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV_MAIN.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(item.href)
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          <item.icon className={cn("size-4 shrink-0", isActive(item.href) && "text-primary")} />
          {item.title}
        </Link>
      ))}
      <div className="mt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        Manage
      </div>
      {NAV_SECONDARY.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(item.href)
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          <item.icon className={cn("size-4 shrink-0", isActive(item.href) && "text-primary")} />
          {item.title}
        </Link>
      ))}
    </nav>
  );
}

export function SidebarContent({ hotelName, userName }: { hotelName: string; userName: string }) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b px-5 py-[18px]">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Hotel className="size-4" />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">Shanyraq AI</div>
          <div className="text-[11px] text-muted-foreground">Hotel Operations Platform</div>
        </div>
      </div>

      {/* Property */}
      <div className="mx-3 mt-4 rounded-lg border bg-secondary/50 px-3 py-2.5">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Property</div>
        <div className="truncate text-sm font-semibold" title={hotelName}>
          {hotelName}
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto">
        <NavLinks />
      </div>

      {/* Footer */}
      <div className="border-t p-3">
        <button
          type="button"
          className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          onClick={() => window.open("mailto:support@shanyraq.kz")}
        >
          <LifeBuoy className="size-4" />
          Help
        </button>
        <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-sm">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {userName
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium">{userName}</div>
            <div className="text-[11px] text-muted-foreground">Property manager</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DesktopSidebar({ hotelName, userName }: { hotelName: string; userName: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-sidebar lg:block">
      <SidebarContent hotelName={hotelName} userName={userName} />
    </aside>
  );
}

export { NavLinks };
