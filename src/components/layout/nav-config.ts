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
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_MAIN: NavItem[] = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
  { title: "Reservations", href: "/dashboard/reservations", icon: ClipboardList },
  { title: "Rooms", href: "/dashboard/rooms", icon: BedDouble },
  { title: "Guests", href: "/dashboard/guests", icon: Users },
  { title: "Rates", href: "/dashboard/rates", icon: BadgePercent },
  { title: "Channels", href: "/dashboard/channels", icon: Cable },
];

export const NAV_SECONDARY: NavItem[] = [
  { title: "Reports", href: "/dashboard/reports", icon: BarChart3 },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];
