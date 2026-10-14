import Link from "next/link";
import { BarChart3, BedDouble, ChevronRight, CreditCard, FileSpreadsheet, Settings, Sparkles, Users, WashingMachine, KeyRound, MessageCircle } from "lucide-react";
import { hasHotelPermission } from "@/lib/access";
import { db } from "@/lib/db";
import { getCurrentHotel, getCurrentUser } from "@/lib/tenant";
import { getRequestLocale } from "@/lib/locale-server";
import { MobileLanguageSwitcher } from "@/components/mobile/mobile-language-switcher";
import { PwaInstallButton } from "@/components/pwa/pwa-install-button";

export const dynamic = "force-dynamic";

export default async function MorePage() {
  const [hotel, user, locale] = await Promise.all([getCurrentHotel(), getCurrentUser(), getRequestLocale()]);
  if (!hotel || !user) return null;
  const [guests, rooms, cleaning] = await Promise.all([
    db.guest.count({ where: { hotelId: hotel.id } }),
    db.room.count({ where: { hotelId: hotel.id } }),
    db.room.count({ where: { hotelId: hotel.id, status: "CLEANING" } }),
  ]);
  const kk = locale === "kk";
  const groups = [
    {
      title: kk ? "Операциялар" : "Операции",
      items: [
        ...(hasHotelPermission(user, "RESERVATIONS") ? [{ href: "/dashboard/communications", icon: MessageCircle, title: kk ? "Қонақпен байланыс" : "Коммуникации", subtitle: kk ? "Хабарламалар, пәтер деректері және фото" : "Сообщения, данные квартиры и фото" }] : []),
        { href: "/dashboard/guests", icon: Users, title: kk ? "Қонақтар" : "Гости", subtitle: kk ? `${guests} профиль және сапарлар тарихы` : `${guests} профилей и история поездок` },
        { href: "/dashboard/rooms", icon: BedDouble, title: kk ? "Пәтерлер" : "Квартиры", subtitle: kk ? `${rooms} белсенді · қызмет көрсету` : `${rooms} активных · обслуживание` },
        { href: "/dashboard/rooms", icon: WashingMachine, title: kk ? "Тапсырмалар мен жинау" : "Задачи и уборка", subtitle: kk ? `${cleaning} жинау керек` : `${cleaning} требуют уборки` },
        { href: "/dashboard/locks", icon: KeyRound, title: kk ? "Құлып кодтары" : "Коды замков", subtitle: kk ? "Уақытша TTLock кодтары" : "Временные коды TTLock" },
      ],
    },
    {
      title: kk ? "Бизнес" : "Бизнес",
      items: [
        { href: "/dashboard/reports", icon: BarChart3, title: kk ? "Есептер" : "Отчёты", subtitle: kk ? "Табыс, жүктеме, арналар" : "Доход, загрузка, каналы" },
        { href: "/dashboard/exports", icon: FileSpreadsheet, title: kk ? "Құжаттар · Excel" : "Документы · Excel", subtitle: kk ? "Есептер мен деректерді жүктеу" : "Скачать отчёты и данные в Excel" },
        { href: "/dashboard/reports#payments", icon: CreditCard, title: kk ? "Төлемдер" : "Платежи", subtitle: kk ? "Төлемдер мен шығындар" : "Оплаты, возвраты и расходы" },
      ],
    },
    {
      title: kk ? "Жүйе" : "Система",
      items: [
        { href: "/dashboard/settings", icon: Settings, title: kk ? "Баптаулар" : "Настройки", subtitle: kk ? "Нысандар, команда, интеграциялар" : "Объекты, команда, интеграции" },
      ],
    },
  ];

  return (
    <div className="space-y-5 lg:hidden">
      <header><h1 className="sh-mobile-title">{kk ? "Тағы" : "Ещё"}</h1><p className="sh-mobile-eyebrow">{kk ? "Басқару және сервистер" : "Управление и сервисы"}</p></header>
      <Link href="/dashboard/settings" className="flex min-h-20 items-center gap-3 rounded-2xl bg-gradient-to-br from-[#09856b] to-[#075f4f] px-4 text-white shadow-lg shadow-emerald-950/10">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-sm font-black text-[#087d66]">SH</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{hotel.name}</span><span className="mt-0.5 block text-[11px] text-white/70">{rooms} {kk ? "пәтер" : "квартир"} · {user.role === "OWNER" ? "Business" : user.role}</span></span>
        <ChevronRight className="size-5" />
      </Link>
      {groups.map((group) => <section key={group.title} className="space-y-2"><h2 className="sh-mobile-section-title px-0.5">{group.title}</h2><div className="sh-mobile-card overflow-hidden">{group.items.map((item) => <Link key={item.title} href={item.href} className="flex min-h-[62px] items-center gap-3 border-b border-[#edeee7] px-3.5 last:border-0"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf4f0] text-[#088269]"><item.icon className="size-[18px]" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#28362f]">{item.title}</span><span className="block truncate text-[11px] text-[#939992]">{item.subtitle}</span></span><ChevronRight className="size-4 text-[#a7ada6]" /></Link>)}</div></section>)}
      <section className="space-y-2"><h2 className="sh-mobile-section-title px-0.5">{kk ? "Тіл" : "Язык"}</h2><MobileLanguageSwitcher locale={locale} /></section>
      <PwaInstallButton title={kk ? "Shanyraq Mobile орнату" : "Установить Shanyraq Mobile"} hint={kk ? "Басты экраннан жылдам қолжетімділік, интернетсіз жұмыс" : "Быстрый доступ с главного экрана и работа без интернета"} locale={locale} />
      <div className="flex items-center justify-center gap-2 pb-2 text-[10px] font-semibold text-[#a0a69f]"><Sparkles className="size-3" />Shanyraq Mobile · Kazakhstan</div>
    </div>
  );
}
