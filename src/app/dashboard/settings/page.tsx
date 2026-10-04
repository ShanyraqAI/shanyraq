import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, BedDouble, BellRing, Building2, ChevronLeft, ChevronRight, FileText, LogOut, RadioTower, ShieldCheck, UserRound, UsersRound, Clock3, type LucideIcon } from "lucide-react";
import { AccountForm } from "@/components/account/account-form";
import { PageHeader } from "@/components/shared/page-header";
import { AccessManagement } from "@/components/settings/access-management";
import { DocumentProfileForm } from "@/components/settings/document-profile-form";
import { NotificationPreferences } from "@/components/settings/notification-preferences";
import { SettingsForm } from "@/components/settings/settings-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolveHotelPermissions } from "@/lib/access";
import { isManagedAvatar } from "@/lib/avatar";
import { requireUser } from "@/lib/auth/session";
import { db, getCurrentHotelId } from "@/lib/db";
import { EMPTY_DOCUMENT_PROFILE, getDocumentProfile } from "@/lib/documents/service";
import { getRequestLocale } from "@/lib/locale-server";
import { signOutAction } from "@/server/actions/auth";
import { SignOutForm } from "@/components/pwa/sign-out-form";
import { requireSectionAccess } from "@/server/guards";

export const dynamic = "force-dynamic";
type Section = "company" | "profile" | "access" | "notifications" | "documents" | "stay" | "rules";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string | string[] }> }) {
  await requireSectionAccess("FULL");
  const [user, hotelId, locale, query] = await Promise.all([requireUser(), getCurrentHotelId(), getRequestLocale(), searchParams]);
  const rawSection = Array.isArray(query.section) ? query.section[0] : query.section;
  const selected = isSection(rawSection) ? rawSection : null;
  const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId } });
  const [memberships, invitations, notificationMembership, documentProfile, roomCount] = await Promise.all([
    db.membership.findMany({ where: { hotelId }, orderBy: [{ role: "asc" }, { createdAt: "asc" }], select: { id: true, role: true, accessLevel: true, permissions: true, user: { select: { fullName: true, email: true } } } }),
    db.hotelInvitation.findMany({ where: { hotelId, status: "PENDING", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true, email: true, accessLevel: true, permissions: true, expiresAt: true } }),
    db.membership.findUniqueOrThrow({ where: { id: user.membershipId! }, select: { newReservationEmail: true, dailyDigestEmail: true, digestHour: true } }),
    getDocumentProfile(user.organizationId!),
    db.room.count({ where: { roomType: { hotelId } } }),
  ]);
  const pushConfigured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
  const data = { hotel, user, memberships, invitations, notificationMembership, documentProfile, locale, pushConfigured, vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? "" };

  return <>
    <div className="lg:hidden">
      {selected ? <div className="space-y-5">
        <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-sm font-semibold text-primary"><ChevronLeft className="size-4" />{locale === "kk" ? "Баптаулар" : "Настройки"}</Link>
        <SectionContent section={selected} data={data} />
      </div> : <MobileSettings locale={locale} hotelName={hotel.name} roomCount={roomCount} memberCount={memberships.length} />}
    </div>
    <div className="hidden space-y-6 lg:block">
      <PageHeader title={locale === "kk" ? "Баптаулар" : "Настройки"} description={locale === "kk" ? "Жұмыс кеңістігі, профиль, команда және хабарландырулар." : "Рабочее пространство, профиль, команда и уведомления."} />
      <Tabs defaultValue="hotel" className="max-w-5xl space-y-5">
        <div className="overflow-hidden rounded-xl border border-primary/15 bg-card shadow-sm"><TabsList variant="line" style={{ height: "auto" }} className="grid w-full grid-cols-5 gap-0 rounded-none bg-transparent p-0">
          <TabsTrigger value="hotel" className="h-12 rounded-none border-r"><Building2 className="size-4" />Отель</TabsTrigger>
          <TabsTrigger value="profile" className="h-12 rounded-none border-r"><UserRound className="size-4" />Профиль</TabsTrigger>
          <TabsTrigger value="access" className="h-12 rounded-none border-r"><ShieldCheck className="size-4" />Доступ</TabsTrigger>
          <TabsTrigger value="notifications" className="h-12 rounded-none border-r"><BellRing className="size-4" />Уведомления</TabsTrigger>
          <TabsTrigger value="documents" className="h-12 rounded-none"><FileText className="size-4" />Документы</TabsTrigger>
        </TabsList></div>
        <TabsContent value="hotel"><SectionContent section="company" data={data} /></TabsContent>
        <TabsContent value="profile"><SectionContent section="profile" data={data} /></TabsContent>
        <TabsContent value="access"><SectionContent section="access" data={data} /></TabsContent>
        <TabsContent value="notifications"><SectionContent section="notifications" data={data} /></TabsContent>
        <TabsContent value="documents"><SectionContent section="documents" data={data} /></TabsContent>
      </Tabs>
    </div>
  </>;
}

function MobileSettings({ locale, hotelName, roomCount, memberCount }: { locale: "ru" | "kk"; hotelName: string; roomCount: number; memberCount: number }) {
  const kk = locale === "kk";
  return <div className="space-y-5">
    <header><h1 className="sh-mobile-title">{kk ? "Баптаулар" : "Настройки"}</h1><p className="sh-mobile-eyebrow mt-1">{hotelName}</p></header>
    <Group title={kk ? "Басқару" : "Управление"}>
      <Row href="/dashboard/settings?section=company" icon={Building2} title={kk ? "Компания" : "Компания"} subtitle={kk ? "Нысан және бизнес деректері" : "Профиль объекта и бизнеса"} />
      <Row href="/dashboard/rooms" icon={BedDouble} title={kk ? "Нысандар мен бөлмелер" : "Объекты и номера"} subtitle={`${roomCount} ${kk ? "белсенді" : "активных"}`} />
      <Row href="/dashboard/settings?section=access" icon={UsersRound} title={kk ? "Команда және рөлдер" : "Команда и роли"} subtitle={`${memberCount} ${kk ? "қызметкер" : "сотрудников"}`} />
      <Row href="/dashboard/settings?section=documents" icon={FileText} title={kk ? "Құжат деректемелері" : "Реквизиты документов"} subtitle={kk ? "Бизнес деректері және қол қоюшы" : "Данные компании и подписанта"} />
      <Row href="/dashboard/settings?section=rules" icon={FileText} title={kk ? "Тұру ережелері" : "Правила проживания"} subtitle={kk ? "Нұсқаулар қонақтарға" : "Инструкции для гостей"} />
      <Row href="/dashboard/settings?section=stay" icon={Clock3} title={kk ? "Заезд и выезд" : "Заезд и выезд"} subtitle={kk ? "Уақыт әдепкі мәні" : "Время по умолчанию"} />
    </Group>
    <Group title={kk ? "Сатылымдар" : "Продажи"}>
      <Row href="/dashboard/channels" icon={RadioTower} title={kk ? "Арналар" : "Каналы"} subtitle="Booking.com, Airbnb +2" />
      <Row href="/dashboard/rates" icon={BarChart3} title={kk ? "Бағалар мен салықтар" : "Цены и налоги"} subtitle={kk ? "KZT · ҚҚС көрсетілмеген" : "KZT · НДС не указан"} />
      <Row href="/dashboard/settings?section=notifications" icon={BellRing} title={kk ? "Хабарландырулар" : "Уведомления"} subtitle="Push, WhatsApp, email" />
    </Group>
    <Group title={kk ? "Аккаунт" : "Аккаунт"}><Row href="/dashboard/settings?section=profile" icon={UserRound} title={kk ? "Жеке профиль" : "Личный профиль"} subtitle={kk ? "Аты-жөні, телефон, фото" : "Имя, телефон, фото"} /></Group>
    <SignOutForm action={signOutAction} locale={locale}><button type="submit" className="flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-destructive"><LogOut className="size-4" />{kk ? "Аккаунттан шығу" : "Выйти из аккаунта"}</button></SignOutForm>
  </div>;
}

function Group({ title, children }: { title: string; children: ReactNode }) { return <section className="space-y-2"><h2 className="sh-mobile-section-title">{title}</h2><div className="sh-mobile-card divide-y overflow-hidden p-0">{children}</div></section>; }
function Row({ href, icon: Icon, title, subtitle }: { href: string; icon: LucideIcon; title: string; subtitle: string }) { return <Link href={href} className="flex items-center gap-3 px-4 py-3.5 active:bg-primary/5"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-[18px]" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block truncate text-xs text-muted-foreground">{subtitle}</span></span><ChevronRight className="size-4 text-muted-foreground" /></Link>; }

type Data = {
  hotel: { name: string; address: string | null; city: string | null; country: string | null; timezone: string; currency: string; language: string; defaultCheckInTime: string; defaultCheckOutTime: string; houseRules: string };
  user: Awaited<ReturnType<typeof requireUser>>;
  memberships: Array<{ id: string; role: string; accessLevel: string; permissions: string[] | null; user: { fullName: string; email: string | null } }>;
  invitations: Array<{ id: string; email: string; accessLevel: string; permissions: string[] | null; expiresAt: Date }>;
  notificationMembership: { newReservationEmail: boolean; dailyDigestEmail: boolean; digestHour: number };
  pushConfigured: boolean;
  vapidPublicKey: string;
  documentProfile: Awaited<ReturnType<typeof getDocumentProfile>>;
  locale: "ru" | "kk";
};

function SectionContent({ section, data }: { section: Section; data: Data }) {
  const kk = data.locale === "kk";
  if (section === "company") return <Panel icon={Building2} title={kk ? "Компания" : "Компания и объект"} description={kk ? "Жұмыс кеңістігінің атауы, мекенжайы және негізгі деректері." : "Название, адрес и основные данные рабочего пространства."}><SettingsForm initial={data.hotel} /></Panel>;
  if (section === "profile") return <Panel icon={UserRound} title={kk ? "Жеке профиль" : "Личный профиль"} description={kk ? "Байланыс деректеріңіз және профиль суреті." : "Ваши контактные данные и изображение профиля."}><AccountForm locale={data.locale} initial={{ firstName: data.user.firstName, lastName: data.user.lastName, avatarUrl: isManagedAvatar(data.user.avatarUrl) ? `/api/avatar/${data.user.id}` : data.user.avatarUrl ?? "", email: data.user.email, phone: data.user.phone }} /></Panel>;
  if (section === "access") return <Panel icon={ShieldCheck} title={kk ? "Команда және қолжетімділік" : "Команда и доступ"} description={kk ? "Қызметкерлердің рөлдері мен осы нысандағы рұқсаттары." : "Роли сотрудников и разрешения внутри этого объекта."}><AccessManagement initialMembers={data.memberships.map((m) => ({ id: m.id, name: m.user.fullName, email: m.user.email ?? "—", permissions: resolveHotelPermissions(m), role: m.role }))} pendingInvitations={data.invitations.map((i) => ({ id: i.id, email: i.email, permissions: resolveHotelPermissions(i), expiresAt: i.expiresAt.toISOString() }))} canManage={data.user.role === "OWNER"} /></Panel>;
  if (section === "notifications") return <Panel icon={BellRing} title={kk ? "Хабарландырулар" : "Уведомления"} description={kk ? "Қолданбадан тыс қандай оқиғаларды алу керегін таңдаңыз." : "Выберите, какие события получать за пределами приложения."}><NotificationPreferences initial={data.notificationMembership} emailAvailable={Boolean(data.user.email)} pushConfigured={data.pushConfigured} vapidPublicKey={data.vapidPublicKey} /></Panel>;
  if (section === "stay") return <Panel icon={Clock3} title={kk ? "Заезд и выезд" : "Заезд и выезд"} description={kk ? "Әдепкі келу және кету уақытын белгілеңіз." : "Установите время заезда и выезда по умолчанию."}><SettingsForm initial={data.hotel} section="stay" /></Panel>;
  if (section === "rules") return <Panel icon={FileText} title={kk ? "Тұру ережелері" : "Правила проживания"} description={kk ? "Қонақтарға арналған ортақ нұсқауларды сақтаңыз." : "Сохраните общие инструкции, которые нужно сообщать гостям."}><SettingsForm initial={data.hotel} section="rules" /></Panel>;
  return <Panel icon={FileText} title={kk ? "Құжат деректемелері" : "Реквизиты для документов"} description={kk ? "Құжат жасағанда иесінің деректері автоматты түрде қойылады." : "Данные владельца автоматически подставляются при генерации."}><DocumentProfileForm initial={data.documentProfile ?? EMPTY_DOCUMENT_PROFILE} canManage={data.user.role === "OWNER"} /></Panel>;
}

function Panel({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children: ReactNode }) { return <section className="space-y-4"><header className="flex items-start gap-3 px-1"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><div><h2 className="font-semibold">{title}</h2><p className="mt-0.5 text-sm text-muted-foreground">{description}</p></div></header>{children}</section>; }
function isSection(value: string | undefined): value is Section { return value === "company" || value === "profile" || value === "access" || value === "notifications" || value === "documents" || value === "stay" || value === "rules"; }
