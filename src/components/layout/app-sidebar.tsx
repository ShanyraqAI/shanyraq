"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, Hotel, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { signOutAction } from "@/server/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
        {t.sidebar.manage}
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

export function SidebarContent({
  hotelName,
  userName,
  userAvatarUrl,
}: {
  hotelName: string;
  userName: string;
  userAvatarUrl?: string | null;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b px-5 py-[18px]">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Hotel className="size-4" />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">Shanyraq AI</div>
          <div className="text-[11px] text-muted-foreground">{t.tagline}</div>
        </div>
      </div>

      {/* Property */}
      <div className="mx-3 mt-4 rounded-lg border bg-secondary/50 px-3 py-2.5">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.sidebar.property}</div>
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
          {t.sidebar.help}
        </button>
        <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-sm">
          <Avatar className="size-8 shrink-0">
            {userAvatarUrl ? <AvatarImage src={userAvatarUrl} alt={userName} /> : null}
            <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
              {userName
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium">{userName}</div>
            <div className="text-[11px] text-muted-foreground">{t.sidebar.role}</div>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              title={t.account.signOut}
              aria-label={t.account.signOut}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function DesktopSidebar({
  hotelName,
  userName,
  userAvatarUrl,
}: {
  hotelName: string;
  userName: string;
  userAvatarUrl?: string | null;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-sidebar lg:block">
      <SidebarContent hotelName={hotelName} userName={userName} userAvatarUrl={userAvatarUrl} />
    </aside>
  );
}

export { NavLinks };
