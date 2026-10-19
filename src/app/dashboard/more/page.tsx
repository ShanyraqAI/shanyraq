import Link from "next/link";
import { ChevronRight, KeyRound, UserRound, WashingMachine } from "lucide-react";
import { resolveHotelPermissions } from "@/lib/access";
import { canOpenNavigation } from "@/lib/navigation";
import { db } from "@/lib/db";
import { getCurrentHotel, getCurrentUser } from "@/lib/tenant";
import { getRequestLocale } from "@/lib/locale-server";
import { navigationForLocale, type NavItem } from "@/components/layout/nav-config";
import { MobileLanguageSwitcher } from "@/components/mobile/mobile-language-switcher";
import { PwaInstallButton } from "@/components/pwa/pwa-install-button";
import { SupportDialog } from "@/components/support/support-dialog";
import { signOutAction } from "@/server/actions/auth";
import { SignOutForm } from "@/components/pwa/sign-out-form";

export const dynamic = "force-dynamic";
export default async function MorePage() {
  const [hotel, user, locale] = await Promise.all([getCurrentHotel(), getCurrentUser(), getRequestLocale()]);
  if (!hotel || !user) return null;
  const kk = locale === "kk";
  const access = { permissions: resolveHotelPermissions(user), accessLevel: user.accessLevel, isOwner: user.role === "OWNER" };
  const canRooms = canOpenNavigation(access, "ROOMS");
  const cleaning = canRooms ? await db.room.count({ where: { hotelId: hotel.id, status: "CLEANING" } }) : 0;
  const navigation = navigationForLocale(locale);
  const roots = ["/dashboard", "/dashboard/calendar", "/dashboard/reservations", "/dashboard/rooms"];
  const extra: NavItem[] = [
    { href: "/dashboard/rooms?status=CLEANING", icon: WashingMachine, title: kk ? `Жинау · ${cleaning}` : `Уборка · ${cleaning}`, permission: "ROOMS" },
    { href: "/dashboard/locks", icon: KeyRound, title: kk ? "Құлып кодтары" : "Коды замков", permission: "ROOMS" },
  ];
  const all = [...navigation.main.filter((item) => !roots.includes(item.href)), ...navigation.secondary, ...extra].filter((item) => canOpenNavigation(access, item.permission, item.ownerOnly));
  const business = ["/dashboard/reports", "/dashboard/reports?tab=payments", "/dashboard/exports", "/dashboard/billing"];
  const system = ["/dashboard/settings", "/dashboard/activity"];
  const groups = [
    { title: kk ? "Операциялар" : "Операции", items: all.filter((item) => !business.includes(item.href) && !system.includes(item.href)) },
    { title: kk ? "Бизнес" : "Бизнес", items: all.filter((item) => business.includes(item.href)) },
    { title: kk ? "Жүйе" : "Система", items: all.filter((item) => system.includes(item.href)) },
  ];
  return <div className="mx-auto max-w-3xl space-y-6">
    <header><h1 className="sh-mobile-title">{kk ? "Тағы" : "Ещё"}</h1><p className="mt-2 text-sm text-muted-foreground">{hotel.name} · {access.isOwner ? (kk ? "Иесі" : "Владелец") : (kk ? "Қызметкер" : "Сотрудник")}</p></header>
    {groups.filter((group) => group.items.length).map((group) => <section key={group.title} className="space-y-2"><h2 className="text-base font-semibold">{group.title}</h2><div className="sh-mobile-card divide-y overflow-hidden">{group.items.map((item) => <Link key={item.href} href={item.href} className="flex min-h-14 items-center gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-primary"><item.icon className="size-5 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 flex-1 text-base font-semibold">{item.title}</span><ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></Link>)}</div></section>)}
    <section className="space-y-2"><h2 className="text-base font-semibold">{kk ? "Аккаунт және көмек" : "Аккаунт и помощь"}</h2><div className="sh-mobile-card p-2"><Link href="/dashboard/profile" className="flex min-h-14 items-center gap-3 px-3 text-base font-semibold"><UserRound className="size-5" />{kk ? "Жеке профиль" : "Мой профиль"}<ChevronRight className="ml-auto size-4" /></Link><SupportDialog locale={locale} /><SignOutForm action={signOutAction} locale={locale}><button type="submit" className="min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold text-destructive">{kk ? "Аккаунттан шығу" : "Выйти из аккаунта"}</button></SignOutForm></div></section>
    <section className="space-y-2"><h2 className="text-base font-semibold">{kk ? "Тіл" : "Язык"}</h2><MobileLanguageSwitcher locale={locale} /></section>
    <PwaInstallButton title={kk ? "Shanyraq Mobile орнату" : "Установить Shanyraq Mobile"} hint={kk ? "Басты экраннан жылдам қолжетімділік, интернетсіз жұмыс" : "Быстрый доступ с главного экрана и работа без интернета"} locale={locale} />
  </div>;
}
