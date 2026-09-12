"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ChangeEvent, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import { NAV_MAIN, NAV_SECONDARY } from "./nav-config";
import { SupportDialog } from "@/components/support/support-dialog";
import type { HotelPermission } from "@/lib/access";

function NavLinks({ onNavigate, accessLevel = "FULL", permissions = [] }: { onNavigate?: () => void; accessLevel?: string; permissions?: HotelPermission[] }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  const canOpen = (permission: HotelPermission | "FULL") =>
    permission === "FULL" ? accessLevel === "FULL" : permissions.includes(permission);
  const mainItems = NAV_MAIN.filter((item) => canOpen(item.permission));
  const secondaryItems = NAV_SECONDARY.filter((item) => canOpen(item.permission));

  return (
    <nav className="flex flex-col gap-1 px-3">
      {mainItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
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
        {t.sidebar.manage}
      </div> : null}
      {secondaryItems.map((item) => (
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
  hotels,
  activeHotelId,
  accessLevel,
  permissions,
  canManageHotels,
}: {
  hotelName: string;
  userName: string;
  userAvatarUrl?: string | null;
  hotels: { id: string; name: string }[];
  activeHotelId: string;
  accessLevel?: string;
  permissions?: HotelPermission[];
  canManageHotels: boolean;
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
              <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.sidebar.property}</span>
              <span className="block truncate text-sm font-semibold" title={hotelName}>{hotelName}</span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60" align="start">
          <DropdownMenuLabel>Ваши отели</DropdownMenuLabel>
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
              <Plus className="size-4" /> Добавить отель
            </DropdownMenuItem>
          </> : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mt-4 flex-1 overflow-y-auto">
        <NavLinks accessLevel={accessLevel} permissions={permissions} />
      </div>

      {/* Footer */}
      <div className="border-t p-3">
        <SupportDialog />
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
            <div className="text-[11px] text-muted-foreground">{t.sidebar.role}</div>
          </div>
          <Settings2 className="size-4 text-muted-foreground" />
        </button>
      </div>

      <Dialog open={hotelDialogOpen} onOpenChange={setHotelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить отель</DialogTitle>
            <DialogDescription>Создайте ещё один объект и переключайтесь между отелями из бокового меню.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-hotel-name">Название отеля</Label>
            <Input id="new-hotel-name" value={newHotelName} onChange={(event) => setNewHotelName(event.target.value)} placeholder="Например, Almaty City Hotel" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHotelDialogOpen(false)}>Отмена</Button>
            <Button onClick={addHotel} disabled={!newHotelName.trim() || pending}><Plus className="size-4" /> Добавить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Персонализация</DialogTitle>
            <DialogDescription>Настройте фото профиля и управление аккаунтом.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-4 rounded-lg border bg-secondary/30 p-4">
            <Avatar className="size-14">
              {avatarSrc ? <AvatarImage src={avatarSrc} alt={userName} /> : null}
              <AvatarFallback className="bg-primary/10 font-semibold text-primary"><UserRound className="size-5" /></AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">PNG, JPG или WebP · до 1 МБ</p>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} className="sr-only" />
              <Button type="button" variant="outline" size="sm" className="mt-2" disabled={pending} onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="size-4" /> Выбрать фото
              </Button>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            {accessLevel === "FULL" ? <Button asChild variant="outline"><Link href="/dashboard/settings" onClick={() => setProfileOpen(false)}>Настройки профиля</Link></Button> : <span />}
            <form action={signOutAction}><Button type="submit" variant="ghost"><LogOut className="size-4" /> {t.account.signOut}</Button></form>
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
}: {
  hotelName: string;
  userName: string;
  userAvatarUrl?: string | null;
  hotels: { id: string; name: string }[];
  activeHotelId: string;
  accessLevel?: string;
  permissions?: HotelPermission[];
  canManageHotels: boolean;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-sidebar lg:block">
      <SidebarContent hotelName={hotelName} userName={userName} userAvatarUrl={userAvatarUrl} hotels={hotels} activeHotelId={activeHotelId} accessLevel={accessLevel} permissions={permissions} canManageHotels={canManageHotels} />
    </aside>
  );
}

export { NavLinks };
