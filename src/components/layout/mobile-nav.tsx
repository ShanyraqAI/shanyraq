"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { t } from "@/lib/i18n";
import { SidebarContent } from "./app-sidebar";

export function MobileNav({
  hotelName,
  userName,
  userAvatarUrl,
  hotels,
  activeHotelId,
  accessLevel,
  canManageHotels,
}: {
  hotelName: string;
  userName: string;
  userAvatarUrl?: string | null;
  hotels: { id: string; name: string }[];
  activeHotelId: string;
  accessLevel?: string;
  canManageHotels: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t.a11y.openNav}>
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{t.a11y.navigation}</SheetTitle>
        </SheetHeader>
        <SidebarContent hotelName={hotelName} userName={userName} userAvatarUrl={userAvatarUrl} hotels={hotels} activeHotelId={activeHotelId} accessLevel={accessLevel} canManageHotels={canManageHotels} />
      </SheetContent>
    </Sheet>
  );
}
