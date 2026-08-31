import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  BedDouble,
  Users,
  BadgePercent,
  Cable,
  BarChart3,
  Settings,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { t } from "@/lib/i18n";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_MAIN: NavItem[] = [
  { title: t.nav.overview, href: "/dashboard", icon: LayoutDashboard },
  { title: t.nav.calendar, href: "/dashboard/calendar", icon: CalendarDays },
  { title: t.nav.reservations, href: "/dashboard/reservations", icon: ClipboardList },
  { title: t.nav.rooms, href: "/dashboard/rooms", icon: BedDouble },
  { title: t.nav.guests, href: "/dashboard/guests", icon: Users },
  { title: t.nav.rates, href: "/dashboard/rates", icon: BadgePercent },
  { title: t.nav.channels, href: "/dashboard/channels", icon: Cable },
];

export const NAV_SECONDARY: NavItem[] = [
  { title: "Подписка и оплата", href: "/dashboard/billing", icon: CreditCard },
  { title: t.nav.reports, href: "/dashboard/reports", icon: BarChart3 },
  { title: t.nav.settings, href: "/dashboard/settings", icon: Settings },
];
