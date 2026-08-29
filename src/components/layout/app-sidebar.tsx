"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, ImagePlus, LifeBuoy, Hotel, LogOut, Plus, Settings2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { signOutAction } from "@/server/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [hotels, setHotels] = useState(() => [hotelName]);
  const [activeHotel, setActiveHotel] = useState(hotelName);
  const [newHotelName, setNewHotelName] = useState("");
  const [hotelDialogOpen, setHotelDialogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedHotels = window.localStorage.getItem("shanyraq-demo-hotels");
    const storedActiveHotel = window.localStorage.getItem("shanyraq-demo-active-hotel");
    const storedAvatar = window.localStorage.getItem("shanyraq-demo-avatar");
    if (storedHotels) {
      try {
        const parsed = JSON.parse(storedHotels) as string[];
        if (parsed.length) setHotels(parsed);
      } catch {
        window.localStorage.removeItem("shanyraq-demo-hotels");
      }
    }
    if (storedActiveHotel) setActiveHotel(storedActiveHotel);
    if (storedAvatar) setLocalAvatar(storedAvatar);
  }, []);

  function selectHotel(name: string) {
    setActiveHotel(name);
    window.localStorage.setItem("shanyraq-demo-active-hotel", name);
  }

  function addHotel() {
    const name = newHotelName.trim();
    if (!name) return;
    const nextHotels = hotels.includes(name) ? hotels : [...hotels, name];
    setHotels(nextHotels);
    selectHotel(name);
    window.localStorage.setItem("shanyraq-demo-hotels", JSON.stringify(nextHotels));
    setNewHotelName("");
    setHotelDialogOpen(false);
  }

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setLocalAvatar(reader.result);
      window.localStorage.setItem("shanyraq-demo-avatar", reader.result);
    };
    reader.readAsDataURL(file);
  }

  const avatarSrc = localAvatar ?? userAvatarUrl;

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="mx-3 mt-4 flex items-center rounded-lg border bg-secondary/50 px-3 py-2.5 text-left transition-colors hover:bg-secondary">
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t.sidebar.property}</span>
              <span className="block truncate text-sm font-semibold" title={activeHotel}>{activeHotel}</span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60" align="start">
          <DropdownMenuLabel>Ваши отели</DropdownMenuLabel>
          {hotels.map((name) => (
            <DropdownMenuItem key={name} onSelect={() => selectHotel(name)} className="py-2">
              <Hotel className="size-4" />
              <span className="flex-1 truncate">{name}</span>
              {name === activeHotel ? <Check className="size-4 text-primary" /> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setHotelDialogOpen(true)} className="py-2 text-primary">
            <Plus className="size-4" /> Добавить отель
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
            <p className="text-xs text-muted-foreground">Демо: отель сохраняется в этом браузере.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHotelDialogOpen(false)}>Отмена</Button>
            <Button onClick={addHotel} disabled={!newHotelName.trim()}><Plus className="size-4" /> Добавить</Button>
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
              <p className="text-xs text-muted-foreground">PNG, JPG или WebP · до 2 МБ</p>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} className="sr-only" />
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="size-4" /> Выбрать фото
              </Button>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button asChild variant="outline"><Link href="/dashboard/settings" onClick={() => setProfileOpen(false)}>Настройки профиля</Link></Button>
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
