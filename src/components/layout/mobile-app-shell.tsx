"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ChevronDown, Ellipsis, Hotel, LogOut, Plus } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/shared/brand-logo";
import { GlobalSearch, type GlobalSearchItem } from "./global-search";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NAV_MAIN, NAV_SECONDARY, type NavItem } from "./nav-config";
import { signOutAction } from "@/server/actions/auth";
import { createHotelAction, switchHotelAction } from "@/server/actions/settings";
import type { HotelPermission } from "@/lib/access";
import { cn } from "@/lib/utils";
import { SupportDialog } from "@/components/support/support-dialog";

interface Props {
  hotelName: string;
  hotels: { id: string; name: string }[];
  activeHotelId: string;
  accessLevel: string;
  permissions: HotelPermission[];
  canManageHotels: boolean;
  searchItems: GlobalSearchItem[];
  notificationCount: number;
  notificationItems: React.ComponentProps<typeof NotificationCenter>["initialItems"];
}

const primary = ["/dashboard", "/dashboard/calendar", "/dashboard/reservations"];
const groups = [
  { title: "Управление", paths: ["/dashboard/guests", "/dashboard/rooms", "/dashboard/rates", "/dashboard/channels"] },
  { title: "Аналитика", paths: ["/dashboard/reports", "/dashboard/exports"] },
  { title: "Система", paths: ["/dashboard/settings", "/dashboard/activity", "/dashboard/billing"] },
];

export function MobileAppShell(props: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [addHotelOpen, setAddHotelOpen] = useState(false);
  const [newHotelName, setNewHotelName] = useState("");
  const [switching, startTransition] = useTransition();
  const allowed = (item: NavItem) => {
    if (item.ownerOnly && !props.canManageHotels) return false;
    if (Array.isArray(item.permission)) return item.permission.some((permission) => props.permissions.includes(permission));
    return item.permission === "FULL" ? props.accessLevel === "FULL" : props.permissions.includes(item.permission);
  };
  const items = [...NAV_MAIN, ...NAV_SECONDARY].filter(allowed);
  const main = primary.map((path) => items.find((item) => item.href === path)).filter((item): item is NavItem => Boolean(item));
  const active = (href: string) => href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  const moreActive = !primary.some(active);

  function selectHotel(hotelId: string) {
    if (hotelId === props.activeHotelId) return;
    startTransition(async () => {
      const result = await switchHotelAction(hotelId);
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  }

  function addHotel() {
    if (!newHotelName.trim()) return;
    startTransition(async () => {
      const result = await createHotelAction({ name: newHotelName });
      if (!result.ok) toast.error(result.error);
      else { toast.success(result.message); setAddHotelOpen(false); setNewHotelName(""); router.refresh(); }
    });
  }

  return <>
    <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur lg:hidden">
      <BrandLogo variant="mark" className="size-7 shrink-0" />
      <DropdownMenu>
        <DropdownMenuTrigger disabled={switching} className="flex min-w-0 max-w-[48vw] items-center gap-1 rounded-lg px-1 py-2 text-left focus-visible:outline-2 focus-visible:outline-primary">
          <span className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Shanyraq AI</span><span className="block truncate text-sm font-semibold">{props.hotelName}</span></span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-52">
          <DropdownMenuLabel>Ваши отели</DropdownMenuLabel>
          {props.hotels.map((hotel) => <DropdownMenuItem key={hotel.id} onSelect={() => selectHotel(hotel.id)}><Hotel className="size-4" /><span className="min-w-0 flex-1 truncate">{hotel.name}</span>{hotel.id === props.activeHotelId ? <Check className="size-4 text-primary" /> : null}</DropdownMenuItem>)}
          {props.canManageHotels ? <DropdownMenuItem onSelect={() => setAddHotelOpen(true)}><Plus className="size-4" />Добавить отель</DropdownMenuItem> : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="ml-auto flex items-center gap-1"><GlobalSearch items={props.searchItems} /><NotificationCenter initialUnreadCount={props.notificationCount} initialItems={props.notificationItems} /></div>
    </header>
    <nav aria-label="Основная навигация" className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-2 pt-1 shadow-[0_-5px_24px_rgba(25,62,48,0.07)] backdrop-blur lg:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }}>
      <div className="mx-auto grid max-w-md gap-1" style={{ gridTemplateColumns: `repeat(${main.length + 1}, minmax(0, 1fr))` }}>
        {main.map((item) => <Link key={item.href} href={item.href} aria-current={active(item.href) ? "page" : undefined} className={cn("flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-muted-foreground", active(item.href) && "bg-accent text-primary")}><item.icon className="size-5" strokeWidth={active(item.href) ? 2.2 : 1.8} />{item.href === "/dashboard/reservations" ? "Брони" : item.title}</Link>)}
        <button type="button" aria-current={moreActive ? "page" : undefined} aria-label="Ещё разделы" onClick={() => setMoreOpen(true)} className={cn("flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-muted-foreground", moreActive && "bg-accent text-primary")}><Ellipsis className="size-5" />Ещё</button>
      </div>
    </nav>
    <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl px-4 pb-[max(env(safe-area-inset-bottom),20px)]">
        <SheetHeader><SheetTitle>Ещё</SheetTitle></SheetHeader>
        <div className="space-y-5 pb-2">
          {groups.map((group) => {
            const links = group.paths.map((path) => items.find((item) => item.href === path)).filter((item): item is NavItem => Boolean(item));
            return links.length ? <section key={group.title}><h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h2><div className="overflow-hidden rounded-xl border bg-card">{links.map((item) => <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className={cn("flex min-h-12 items-center gap-3 border-b px-3 text-sm font-medium last:border-b-0", active(item.href) && "bg-accent text-primary")}><item.icon className="size-4 text-primary" />{item.title}<span className="ml-auto text-muted-foreground">›</span></Link>)}</div></section> : null;
          })}
          <SupportDialog />
          <form action={signOutAction}><button type="submit" className="flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-sm text-muted-foreground"><LogOut className="size-4" />Выйти</button></form>
        </div>
      </SheetContent>
    </Sheet>
    <Dialog open={addHotelOpen} onOpenChange={setAddHotelOpen}><DialogContent><DialogHeader><DialogTitle>Добавить отель</DialogTitle><DialogDescription>Новый объект появится в переключателе отелей.</DialogDescription></DialogHeader><Input aria-label="Название отеля" value={newHotelName} onChange={(event) => setNewHotelName(event.target.value)} placeholder="Название отеля" /><DialogFooter><Button variant="outline" onClick={() => setAddHotelOpen(false)}>Отмена</Button><Button disabled={!newHotelName.trim() || switching} onClick={addHotel}>Добавить</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
