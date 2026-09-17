import { db, getCurrentHotelId } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { AccountForm } from "@/components/account/account-form";
import { requireUser } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
import { AccessManagement } from "@/components/settings/access-management";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireSectionAccess } from "@/server/guards";
import { isManagedAvatar } from "@/lib/avatar";
import { resolveHotelPermissions } from "@/lib/access";
import { NotificationPreferences } from "@/components/settings/notification-preferences";
import { DocumentProfileForm } from "@/components/settings/document-profile-form";
import { EMPTY_DOCUMENT_PROFILE, getDocumentProfile } from "@/lib/documents/service";
import { BellRing, Building2, FileText, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireSectionAccess("FULL");
  const user = await requireUser();
  const hotelId = await getCurrentHotelId();
  const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId } });
  const [memberships, invitations, notificationMembership, documentProfile] = await Promise.all([
    db.membership.findMany({
      where: { hotelId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { id: true, role: true, accessLevel: true, permissions: true, user: { select: { fullName: true, email: true } } },
    }),
    db.hotelInvitation.findMany({
      where: { hotelId, status: "PENDING", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, accessLevel: true, permissions: true, expiresAt: true },
    }),
    db.membership.findUniqueOrThrow({
      where: { id: user.membershipId! },
      select: { newReservationEmail: true, dailyDigestEmail: true, digestHour: true },
    }),
    getDocumentProfile(user.organizationId!),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.settings.title}
        description={t.settings.description}
      />

      <Tabs defaultValue="hotel" className="max-w-5xl space-y-5">
        <div className="overflow-hidden rounded-xl border border-primary/15 bg-card shadow-sm">
        <TabsList variant="line" className="grid h-auto w-full grid-cols-2 gap-0 rounded-none bg-transparent p-0 sm:grid-cols-5">
          <TabsTrigger value="hotel" className="h-12 justify-start rounded-none border-r border-b px-4 data-active:bg-primary/[0.045] data-active:text-primary sm:justify-center sm:border-b-0"><Building2 className="size-4" />Отель</TabsTrigger>
          <TabsTrigger value="profile" className="h-12 justify-start rounded-none border-b px-4 data-active:bg-primary/[0.045] data-active:text-primary sm:justify-center sm:border-r sm:border-b-0"><UserRound className="size-4" />Профиль</TabsTrigger>
          <TabsTrigger value="access" className="h-12 justify-start rounded-none border-r border-b px-4 data-active:bg-primary/[0.045] data-active:text-primary sm:justify-center sm:border-b-0"><ShieldCheck className="size-4" />Доступ</TabsTrigger>
          <TabsTrigger value="notifications" className="h-12 justify-start rounded-none border-b px-4 data-active:bg-primary/[0.045] data-active:text-primary sm:justify-center sm:border-r sm:border-b-0"><BellRing className="size-4" />Уведомления</TabsTrigger>
          <TabsTrigger value="documents" className="col-span-2 h-12 justify-start rounded-none px-4 data-active:bg-primary/[0.045] data-active:text-primary sm:col-span-1 sm:justify-center"><FileText className="size-4" />Документы</TabsTrigger>
        </TabsList>
        </div>
        <TabsContent value="hotel" className="mt-0">
          <SettingsPanel icon={Building2} title="Данные объекта" description="Основная информация, которую видят сотрудники и подключённые каналы.">
            <SettingsForm initial={{ name: hotel.name, address: hotel.address, city: hotel.city, country: hotel.country, timezone: hotel.timezone, currency: hotel.currency }} />
          </SettingsPanel>
        </TabsContent>
        <TabsContent value="profile" className="mt-0">
          <SettingsPanel icon={UserRound} title="Личный профиль" description="Ваши контактные данные и изображение профиля.">
            <AccountForm initial={{ firstName: user.firstName, lastName: user.lastName, avatarUrl: isManagedAvatar(user.avatarUrl) ? "" : user.avatarUrl ?? "", email: user.email, phone: user.phone }} />
          </SettingsPanel>
        </TabsContent>
        <TabsContent value="access" className="mt-0"><SettingsPanel icon={ShieldCheck} title="Команда и доступ" description="Роли сотрудников и разрешения внутри этого отеля."><AccessManagement initialMembers={memberships.map((membership) => ({ id: membership.id, name: membership.user.fullName, email: membership.user.email ?? "—", permissions: resolveHotelPermissions(membership), role: membership.role }))} pendingInvitations={invitations.map((invitation) => ({ id: invitation.id, email: invitation.email, permissions: resolveHotelPermissions(invitation), expiresAt: invitation.expiresAt.toISOString() }))} canManage={user.role === "OWNER"} /></SettingsPanel></TabsContent>
        <TabsContent value="notifications" className="mt-0"><SettingsPanel icon={BellRing} title="Уведомления" description="Выберите, какие события получать за пределами приложения."><NotificationPreferences initial={notificationMembership} emailAvailable={Boolean(user.email)} /></SettingsPanel></TabsContent>
        <TabsContent value="documents" className="mt-0"><SettingsPanel icon={FileText} title="Реквизиты для документов" description="Данные владельца сохраняются один раз и автоматически подставляются при генерации."><DocumentProfileForm initial={documentProfile ?? EMPTY_DOCUMENT_PROFILE} canManage={user.role === "OWNER"} /></SettingsPanel></TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsPanel({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children: ReactNode }) {
  return <section className="space-y-4">
    <header className="flex items-start gap-3 px-1">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
      <div><h2 className="font-semibold">{title}</h2><p className="mt-0.5 text-sm text-muted-foreground">{description}</p></div>
    </header>
    {children}
  </section>;
}
