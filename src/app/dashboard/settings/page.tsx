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

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireSectionAccess("FULL");
  const user = await requireUser();
  const hotelId = await getCurrentHotelId();
  const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId } });
  const [memberships, invitations, notificationMembership] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.settings.title}
        description={t.settings.description}
      />

      <Tabs defaultValue="hotel" className="space-y-5">
        <TabsList className="h-11 w-full max-w-2xl justify-start rounded-lg border bg-card p-1 shadow-sm">
          <TabsTrigger value="hotel" className="h-9 px-5">Отель</TabsTrigger>
          <TabsTrigger value="profile" className="h-9 px-5">Профиль</TabsTrigger>
          <TabsTrigger value="access" className="h-9 px-5">Доступ</TabsTrigger>
          <TabsTrigger value="notifications" className="h-9 px-5">Уведомления</TabsTrigger>
        </TabsList>
        <TabsContent value="hotel">
          <SettingsForm initial={{ name: hotel.name, address: hotel.address, city: hotel.city, country: hotel.country, timezone: hotel.timezone, currency: hotel.currency }} />
        </TabsContent>
        <TabsContent value="profile">
          <AccountForm initial={{ firstName: user.firstName, lastName: user.lastName, avatarUrl: isManagedAvatar(user.avatarUrl) ? "" : user.avatarUrl ?? "", email: user.email, phone: user.phone }} />
        </TabsContent>
        <TabsContent value="access"><AccessManagement initialMembers={memberships.map((membership) => ({ id: membership.id, name: membership.user.fullName, email: membership.user.email ?? "—", permissions: resolveHotelPermissions(membership), role: membership.role }))} pendingInvitations={invitations.map((invitation) => ({ id: invitation.id, email: invitation.email, permissions: resolveHotelPermissions(invitation), expiresAt: invitation.expiresAt.toISOString() }))} canManage={user.role === "OWNER"} /></TabsContent>
        <TabsContent value="notifications"><NotificationPreferences initial={notificationMembership} emailAvailable={Boolean(user.email)} /></TabsContent>
      </Tabs>
    </div>
  );
}
