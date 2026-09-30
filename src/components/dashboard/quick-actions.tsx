"use client";

import Link from "next/link";
import { BedDouble, CalendarDays, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GuestVM, RatePlanVM, RoomVM } from "@/lib/types";
import type { AppLocale } from "@/lib/locale";

export function QuickActions({ canCreateReservation, canOpenCalendar, canOpenGuests, canOpenRooms, mobile = false, locale = "ru" }: {
  rooms: RoomVM[]; ratePlans: RatePlanVM[]; guests: GuestVM[]; hotelCurrency: string;
  canCreateReservation: boolean; canOpenCalendar: boolean; canOpenGuests: boolean; canOpenRooms: boolean; mobile?: boolean; locale?: AppLocale;
}) {
  const links = [
    canOpenCalendar ? { href: "/dashboard/calendar", label: "Открыть календарь", icon: CalendarDays } : null,
    canOpenGuests ? { href: "/dashboard/guests", label: "Гости", icon: Users } : null,
    canOpenRooms ? { href: "/dashboard/rooms", label: "Номера", icon: BedDouble } : null,
  ].filter((item): item is { href: string; label: string; icon: typeof BedDouble } => Boolean(item));

  if (!canCreateReservation && links.length === 0) return null;
  return <>
    {mobile && canCreateReservation ? <Button asChild className="h-12 w-full text-sm"><Link href="/dashboard/reservations/new"><Plus className="size-4" /> {locale === "kk" ? "Жаңа бронь" : "Новая бронь"}</Link></Button> : null}
    {!mobile ? <Card className="shadow-sm">
      <CardHeader className="border-b pb-4"><CardTitle className="text-base">Быстрые действия</CardTitle></CardHeader>
      <CardContent className="grid gap-2 pt-5 sm:grid-cols-2 xl:grid-cols-1">
        {canCreateReservation ? <Button asChild className="justify-start"><Link href="/dashboard/reservations/new"><Plus className="size-4" /> Новая бронь</Link></Button> : null}
        {links.map((item) => <Button key={item.href} asChild variant="outline" className="justify-start bg-background"><Link href={item.href}><item.icon className="size-4" /> {item.label}</Link></Button>)}
      </CardContent>
    </Card> : null}
  </>;
}
