"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Check, ChevronDown, Ellipsis, Languages, LogOut, Plus } from "lucide-react";
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
import { PwaInstallButton } from "@/components/pwa/pwa-install-button";
import { mobileCopy, type AppLocale } from "@/lib/locale";
import { setAppLocaleAction } from "@/server/actions/locale";

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
  locale: AppLocale;
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
  const copy = mobileCopy[props.locale];

  useEffect(() => {
    document.documentElement.lang = props.locale;
  }, [props.locale]);
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

  function selectLocale(locale: AppLocale) {
    if (locale === props.locale) return;
    startTransition(async () => {
      const result = await setAppLocaleAction(locale);
      if (result.ok) {
        document.documentElement.lang = locale;
        router.refresh();
      }
    });
  }

  const mobileTitle = (item: NavItem) => {
    if (item.href === "/dashboard") return copy.nav.overview;
    if (item.href === "/dashboard/calendar") return copy.nav.calendar;
    if (item.href === "/dashboard/reservations") return copy.nav.reservations;
    if (props.locale === "kk") {
      return ({
        "/dashboard/guests": "Қонақтар",
        "/dashboard/rooms": "Юниттер",
        "/dashboard/rates": "Бағалар",
        "/dashboard/channels": "Арналар",
        "/dashboard/reports": "Есептер",
        "/dashboard/exports": "Экспорт",
        "/dashboard/settings": "Баптаулар",
        "/dashboard/activity": "Белсенділік",
        "/dashboard/billing": "Төлемдер",
      } as Record<string, string>)[item.href] ?? item.title;
    }
    return item.href === "/dashboard/rooms" ? "Объекты и юниты" : item.title;
  };

  return <>
    <header className="mobile-ornament sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur lg:hidden">
      <BrandLogo variant="mark" className="size-7 shrink-0" />
      <DropdownMenu>
        <DropdownMenuTrigger disabled={switching} className="flex min-w-0 max-w-[48vw] items-center gap-1 rounded-lg px-1 py-2 text-left focus-visible:outline-2 focus-visible:outline-primary">
          <span className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{copy.shell.workspace}</span><span className="block truncate text-sm font-semibold">{props.hotelName}</span></span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-52">
          <DropdownMenuLabel>{copy.shell.properties}</DropdownMenuLabel>
          {props.hotels.map((hotel) => <DropdownMenuItem key={hotel.id} onSelect={() => selectHotel(hotel.id)}><span className="grid size-5 place-items-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">SH</span><span className="min-w-0 flex-1 truncate">{hotel.name}</span>{hotel.id === props.activeHotelId ? <Check className="size-4 text-primary" /> : null}</DropdownMenuItem>)}
          {props.canManageHotels ? <DropdownMenuItem onSelect={() => setAddHotelOpen(true)}><Plus className="size-4" />{copy.shell.addProperty}</DropdownMenuItem> : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="ml-auto flex items-center gap-1"><GlobalSearch items={props.searchItems} /><NotificationCenter initialUnreadCount={props.notificationCount} initialItems={props.notificationItems} /></div>
    </header>
    <nav aria-label="Основная навигация" className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-2 pt-1 shadow-[0_-5px_24px_rgba(25,62,48,0.07)] backdrop-blur lg:hidden" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }}>
      <div className="mx-auto grid max-w-md gap-1" style={{ gridTemplateColumns: `repeat(${main.length + 1}, minmax(0, 1fr))` }}>
        {main.map((item) => <Link key={item.href} href={item.href} aria-current={active(item.href) ? "page" : undefined} className={cn("flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-muted-foreground", active(item.href) && "bg-accent text-primary")}><item.icon className="size-5" strokeWidth={active(item.href) ? 2.2 : 1.8} />{mobileTitle(item)}</Link>)}
        <button type="button" aria-current={moreActive ? "page" : undefined} aria-label={copy.nav.more} onClick={() => setMoreOpen(true)} className={cn("flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-muted-foreground", moreActive && "bg-accent text-primary")}><Ellipsis className="size-5" />{copy.nav.more}</button>
      </div>
    </nav>
    <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl px-4 pb-[max(env(safe-area-inset-bottom),20px)]">
        <SheetHeader><SheetTitle>{copy.shell.more}</SheetTitle></SheetHeader>
        <div className="space-y-5 pb-2">
          {groups.map((group, groupIndex) => {
            const links = group.paths.map((path) => items.find((item) => item.href === path)).filter((item): item is NavItem => Boolean(item));
            const groupTitle = [copy.shell.manage, copy.shell.analytics, copy.shell.system][groupIndex];
            return links.length ? <section key={group.title}><h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{groupTitle}</h2><div className="overflow-hidden rounded-2xl border bg-card shadow-xs">{links.map((item) => <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className={cn("flex min-h-13 items-center gap-3 border-b px-3.5 text-sm font-medium last:border-b-0", active(item.href) && "bg-accent text-primary")}><span className="grid size-8 place-items-center rounded-xl bg-primary/8 text-primary"><item.icon className="size-4" /></span>{mobileTitle(item)}<span className="ml-auto text-muted-foreground">›</span></Link>)}</div></section> : null;
          })}
          <section>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.shell.language}</h2>
            <div className="flex items-center gap-3 rounded-2xl border bg-card p-2 shadow-xs">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/8 text-primary"><Languages className="size-4" /></span>
              <div className="grid flex-1 grid-cols-2 rounded-xl bg-secondary p-1">
                {(["ru", "kk"] as const).map((locale) => <button key={locale} type="button" disabled={switching} onClick={() => selectLocale(locale)} className={cn("min-h-9 rounded-lg px-2 text-xs font-semibold transition-colors", props.locale === locale ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>{locale === "ru" ? copy.shell.russian : copy.shell.kazakh}</button>)}
              </div>
            </div>
          </section>
          <PwaInstallButton title={copy.shell.install} hint={copy.shell.installHint} />
          <SupportDialog />
          <form action={signOutAction}><button type="submit" className="flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-sm text-muted-foreground"><LogOut className="size-4" />{copy.shell.signOut}</button></form>
        </div>
      </SheetContent>
    </Sheet>
    <Dialog open={addHotelOpen} onOpenChange={setAddHotelOpen}><DialogContent><DialogHeader><DialogTitle>{copy.shell.addProperty}</DialogTitle><DialogDescription>{props.locale === "kk" ? "Жаңа нысан жұмыс кеңістіктері тізімінде пайда болады." : "Новый объект появится в списке рабочих пространств."}</DialogDescription></DialogHeader><Input aria-label={copy.shell.propertyName} value={newHotelName} onChange={(event) => setNewHotelName(event.target.value)} placeholder={copy.shell.propertyName} /><DialogFooter><Button variant="outline" onClick={() => setAddHotelOpen(false)}>{copy.shell.cancel}</Button><Button disabled={!newHotelName.trim() || switching} onClick={addHotel}>{copy.shell.add}</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
