"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ChangeEvent, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, ImagePlus, Hotel, LogOut, Plus, Settings2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { signOutAction, uploadAvatarAction } from "@/server/actions/auth";
import { createHotelAction, switchHotelAction } from "@/server/actions/settings";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { navigationForLocale } from "./nav-config";
import { canOpenNavigation, isNavigationActive } from "@/lib/navigation";
import type { AppLocale } from "@/lib/locale";
import { SupportDialog } from "@/components/support/support-dialog";
import type { HotelPermission } from "@/lib/access";

function NavLinks({ onNavigate, mobile = false, accessLevel = "FULL", permissions = [], isOwner = false, locale = "ru" }: { onNavigate?: () => void; mobile?: boolean; accessLevel?: string; permissions?: HotelPermission[]; isOwner?: boolean; locale?: AppLocale }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isActive = (href: string) => isNavigationActive(pathname, href, searchParams.get("tab"));
  const access = { accessLevel, permissions, isOwner };
  const navigation = navigationForLocale(locale);
  const mainItems = navigation.main.filter((item) => canOpenNavigation(access, item.permission, item.ownerOnly));
  const secondaryItems = navigation.secondary.filter((item) => canOpenNavigation(access, item.permission, item.ownerOnly));
  const groups = mobile ? [
    [locale === "kk" ? "Негізгі" : "Основное", mainItems.filter((item) => ["/dashboard", "/dashboard/calendar", "/dashboard/reservations"].includes(item.href))],
    [locale === "kk" ? "Нысан" : "Объект", mainItems.filter((item) => !["/dashboard", "/dashboard/calendar", "/dashboard/reservations"].includes(item.href))],
    [locale === "kk" ? "Аналитика" : "Аналитика", secondaryItems.filter((item) => ["/dashboard/reports", "/dashboard/exports"].includes(item.href))],
    [locale === "kk" ? "Жүйе" : "Система", secondaryItems.filter((item) => !["/dashboard/reports", "/dashboard/exports"].includes(item.href))],
  ] as const : [];

  const navLink = (item: (typeof mainItems)[number]) => <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} data-tour-id={item.tourId} onClick={onNavigate} className={cn("flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", isActive(item.href) ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}><item.icon className={cn("size-4 shrink-0", isActive(item.href) && "text-primary")} />{item.title}</Link>;

  return (
    <nav className="flex flex-col gap-1 px-3">
      {mobile ? groups.map(([label, items]) => items.length ? <div key={label} className="space-y-1"><div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</div>{items.map(navLink)}</div> : null) : <>
      {mainItems.map((item) => (
        <Link
          key={item.href}
          href={item.href} aria-current={isActive(item.href) ? "page" : undefined}
          data-tour-id={item.tourId}
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
      {secondaryItems.length ? <div className="mt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {locale === "kk" ? "Басқару" : t.sidebar.manage}
      </div> : null}
      {secondaryItems.map((item) => (
        <Link
          key={item.href}
          href={item.href} aria-current={isActive(item.href) ? "page" : undefined}
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
      </>}
    </nav>
  );
}

export function SidebarContent({
  hotelName,
  userName,
  userAvatarUrl,
  hotels,
  activeHotelId,
  accessLevel,
  permissions,
  canManageHotels,
  locale = "ru",
  mobile = false,
  onNavigate,
}: {
  hotelName: string;
  userName: string;
  userAvatarUrl?: string | null;
  hotels: { id: string; name: string }[];
  activeHotelId: string;
  accessLevel?: string;
  permissions?: HotelPermission[];
  canManageHotels: boolean;
  locale?: AppLocale;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newHotelName, setNewHotelName] = useState("");
  const [hotelDialogOpen, setHotelDialogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState(userAvatarUrl ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function selectHotel(hotelId: string) {
    startTransition(async () => {
      const result = await switchHotelAction(hotelId);
      if (!result.ok) toast.error(result.error);
      else router.refresh();
    });
  }

  function addHotel() {
    startTransition(async () => {
      const result = await createHotelAction({ name: newHotelName });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setNewHotelName("");
      setHotelDialogOpen(false);
      router.refresh();
    });
  }

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || pending) return;
    if (!file.size || file.size > 1024 * 1024) {
      toast.error("Выберите изображение размером до 1 МБ.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Поддерживаются PNG, JPG и WebP.");
      return;
    }
    const formData = new FormData();
    formData.set("avatar", file);
    startTransition(async () => {
      try {
        const result = await uploadAvatarAction(formData);
        if (!result.ok || !result.data) {
          toast.error(result.error);
          return;
        }
        setAvatarSrc(result.data);
        toast.success(result.message);
        router.refresh();
      } catch {
        toast.error("Не удалось загрузить фото. Проверьте соединение и попробуйте снова.");
      }
    });
  }

  return (
    <div data-dashboard-sidebar className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b px-5 py-[18px]">
        <BrandLogo variant="mark" inverse className="size-8" />
        <div className="leading-tight">
          <BrandLogo variant="wordmark" inverse className="h-[18.75px] w-auto" />
          <div className="text-[11px] text-muted-foreground">{t.tagline}</div>
        </div>
      </div>

      {/* Property */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="mx-3 mt-4 flex items-center rounded-lg border bg-secondary/50 px-3 py-2.5 text-left transition-colors hover:bg-secondary">
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{locale === "kk" ? "Нысан" : "Объект"}</span>
              <span className="block truncate text-sm font-semibold" title={hotelName}>{hotelName}</span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60" align="start">
          <DropdownMenuLabel>{locale === "kk" ? "Нысандарыңыз" : "Ваши объекты"}</DropdownMenuLabel>
          {hotels.map((hotel) => (
            <DropdownMenuItem key={hotel.id} onSelect={() => selectHotel(hotel.id)} className="py-2" disabled={pending}>
              <Hotel className="size-4" />
              <span className="flex-1 truncate">{hotel.name}</span>
              {hotel.id === activeHotelId ? <Check className="size-4 text-primary" /> : null}
            </DropdownMenuItem>
          ))}
          {canManageHotels ? <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setHotelDialogOpen(true)} className="py-2 text-primary">
              <Plus className="size-4" /> {locale === "kk" ? "Нысан қосу" : "Добавить объект"}
            </DropdownMenuItem>
          </> : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mt-4 flex-1 overflow-y-auto">
        <NavLinks mobile={mobile} onNavigate={onNavigate} accessLevel={accessLevel} permissions={permissions} isOwner={canManageHotels} locale={locale} />
      </div>

      {/* Footer */}
      <div className="border-t p-3">
        <SupportDialog locale={locale} />
        <button type="button" onClick={() => setProfileOpen(true)} className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left shadow-sm transition-colors hover:bg-secondary/60">
          <Avatar className="size-8 shrink-0">
            {avatarSrc ? <AvatarImage src={avatarSrc} alt={userName} /> : null}
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
            <div className="text-[11px] text-muted-foreground">{locale === "kk" ? (canManageHotels ? "Иесі" : "Қызметкер") : (canManageHotels ? "Владелец" : "Сотрудник")}</div>
          </div>
          <Settings2 className="size-4 text-muted-foreground" />
        </button>
      </div>

      <Dialog open={hotelDialogOpen} onOpenChange={setHotelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locale === "kk" ? "Нысан қосу" : "Добавить объект"}</DialogTitle>
            <DialogDescription>{locale === "kk" ? "Басқа нысанды қосып, бүйірлік мәзірден ауыстырыңыз." : "Добавьте ещё один объект и переключайтесь между ними из бокового меню."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-hotel-name">{locale === "kk" ? "Нысан атауы" : "Название объекта"}</Label>
            <Input id="new-hotel-name" value={newHotelName} onChange={(event) => setNewHotelName(event.target.value)} placeholder="Например, Almaty City Hotel" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHotelDialogOpen(false)}>{locale === "kk" ? "Бас тарту" : "Отмена"}</Button>
            <Button onClick={addHotel} disabled={!newHotelName.trim() || pending}><Plus className="size-4" /> {locale === "kk" ? "Қосу" : "Добавить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locale === "kk" ? "Жеке профиль" : "Мой профиль"}</DialogTitle>
            <DialogDescription>{locale === "kk" ? "Профиль суреті және аккаунтты басқару." : "Фото профиля и управление аккаунтом."}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-4 rounded-lg border bg-secondary/30 p-4">
            <Avatar className="size-14">
              {avatarSrc ? <AvatarImage src={avatarSrc} alt={userName} /> : null}
              <AvatarFallback className="bg-primary/10 font-semibold text-primary"><UserRound className="size-5" /></AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">{locale === "kk" ? "PNG, JPG немесе WebP · 1 МБ дейін" : "PNG, JPG или WebP · до 1 МБ"}</p>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} className="sr-only" />
              <Button type="button" variant="outline" size="sm" className="mt-2" disabled={pending} onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="size-4" /> {locale === "kk" ? "Суретті таңдау" : "Выбрать фото"}
              </Button>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button asChild variant="outline"><Link href="/dashboard/profile" onClick={() => setProfileOpen(false)}>{locale === "kk" ? "Жеке профиль" : "Мой профиль"}</Link></Button>
            <form action={signOutAction}><Button type="submit" variant="ghost"><LogOut className="size-4" /> {locale === "kk" ? "Шығу" : t.account.signOut}</Button></form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DesktopSidebar({
  hotelName,
  userName,
  userAvatarUrl,
  hotels,
  activeHotelId,
  accessLevel,
  permissions,
  canManageHotels,
  locale = "ru",
}: {
  hotelName: string;
  userName: string;
  userAvatarUrl?: string | null;
  hotels: { id: string; name: string }[];
  activeHotelId: string;
  accessLevel?: string;
  permissions?: HotelPermission[];
  canManageHotels: boolean;
  locale?: AppLocale;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-sidebar lg:block">
      <SidebarContent hotelName={hotelName} userName={userName} userAvatarUrl={userAvatarUrl} hotels={hotels} activeHotelId={activeHotelId} accessLevel={accessLevel} permissions={permissions} canManageHotels={canManageHotels} locale={locale} />
    </aside>
  );
}

export { NavLinks };
