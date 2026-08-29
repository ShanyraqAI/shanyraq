import { db, getCurrentHotelId } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { AccountForm } from "@/components/account/account-form";
import { requireUser } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
import { AccessManagement } from "@/components/settings/access-management";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireSectionAccess } from "@/server/guards";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireSectionAccess("FULL");
  const user = await requireUser();
  const hotelId = await getCurrentHotelId();
  const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId } });
  const memberships = await db.membership.findMany({
    where: { hotelId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true, role: true, accessLevel: true, user: { select: { fullName: true, email: true } } },
  });

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
        </TabsList>
        <TabsContent value="hotel">
          <SettingsForm initial={{ name: hotel.name, address: hotel.address, city: hotel.city, country: hotel.country, timezone: hotel.timezone, currency: hotel.currency }} />
        </TabsContent>
        <TabsContent value="profile">
          <AccountForm initial={{ fullName: user.fullName, avatarUrl: user.avatarUrl ?? "", email: user.email, phone: user.phone }} />
        </TabsContent>
        <TabsContent value="access"><AccessManagement initialMembers={memberships.map((membership) => ({ id: membership.id, name: membership.user.fullName, email: membership.user.email ?? "—", access: membership.accessLevel as "OVERVIEW" | "CALENDAR" | "FULL", role: membership.role }))} canManage={user.role === "OWNER"} /></TabsContent>
      </Tabs>
    </div>
  );
}
