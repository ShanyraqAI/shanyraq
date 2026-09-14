import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  BedDouble,
  Users,
  BadgePercent,
  Cable,
  BarChart3,
  FileDown,
  Settings,
  CreditCard,
  History,
  type LucideIcon,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { PRODUCT_AVAILABILITY } from "@/lib/product-availability";
import type { HotelPermission } from "@/lib/access";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  tourId?: string;
  permission: HotelPermission | "FULL" | HotelPermission[];
  ownerOnly?: boolean;
}

const ALL_NAV_MAIN: (NavItem & { visible: boolean })[] = [
  { title: t.nav.overview, href: "/dashboard", icon: LayoutDashboard, tourId: "overview", permission: "OVERVIEW", visible: true },
  { title: t.nav.calendar, href: "/dashboard/calendar", icon: CalendarDays, tourId: "calendar", permission: "CALENDAR", visible: true },
  { title: t.nav.reservations, href: "/dashboard/reservations", icon: ClipboardList, tourId: "reservations", permission: "RESERVATIONS", visible: true },
  { title: t.nav.rooms, href: "/dashboard/rooms", icon: BedDouble, tourId: "rooms", permission: "ROOMS", visible: true },
  { title: t.nav.guests, href: "/dashboard/guests", icon: Users, tourId: "guests", permission: "GUESTS", visible: true },
  { title: t.nav.rates, href: "/dashboard/rates", icon: BadgePercent, tourId: "rates", permission: "RATES", visible: true },
  { title: t.nav.channels, href: "/dashboard/channels", icon: Cable, permission: "FULL", visible: PRODUCT_AVAILABILITY.channels },
];

export const NAV_MAIN: NavItem[] = ALL_NAV_MAIN.filter((item) => item.visible);

const ALL_NAV_SECONDARY: (NavItem & { visible: boolean })[] = [
  { title: "Подписка и оплата", href: "/dashboard/billing", icon: CreditCard, permission: "FULL", visible: PRODUCT_AVAILABILITY.billing },
  { title: t.nav.reports, href: "/dashboard/reports", icon: BarChart3, permission: "REPORTS", visible: true },
  { title: t.nav.exports, href: "/dashboard/exports", icon: FileDown, permission: ["REPORTS", "CALENDAR", "RESERVATIONS", "GUESTS"], visible: true },
  { title: t.nav.settings, href: "/dashboard/settings", icon: Settings, permission: "FULL", visible: true },
  { title: "Журнал действий", href: "/dashboard/activity", icon: History, permission: "FULL", ownerOnly: true, visible: true },
];

export const NAV_SECONDARY: NavItem[] = ALL_NAV_SECONDARY.filter((item) => item.visible);
