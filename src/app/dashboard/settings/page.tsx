import { db, getCurrentHotelId } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { AccountForm } from "@/components/account/account-form";
import { requireUser } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
import { AccessManagement } from "@/components/settings/access-management";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const hotelId = await getCurrentHotelId();
  const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId } });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.settings.title}
        description={t.settings.description}
      />

      <Tabs defaultValue="hotel" className="space-y-5">
        <TabsList className="h-auto w-full justify-start overflow-x-auto bg-transparent p-0" variant="line">
          <TabsTrigger value="hotel" className="px-3 py-2">Отель</TabsTrigger>
          <TabsTrigger value="profile" className="px-3 py-2">Профиль</TabsTrigger>
          <TabsTrigger value="access" className="px-3 py-2">Доступ</TabsTrigger>
        </TabsList>
        <TabsContent value="hotel">
          <SettingsForm initial={{ name: hotel.name, address: hotel.address, city: hotel.city, country: hotel.country, timezone: hotel.timezone, currency: hotel.currency }} />
        </TabsContent>
        <TabsContent value="profile">
          <AccountForm initial={{ fullName: user.fullName, avatarUrl: user.avatarUrl ?? "", email: user.email, phone: user.phone }} />
        </TabsContent>
        <TabsContent value="access"><AccessManagement /></TabsContent>
      </Tabs>

      <section className="max-w-2xl rounded-xl border border-dashed bg-secondary/30 p-5 text-sm text-muted-foreground">
        <h2 className="mb-1 font-semibold text-foreground">{t.settings.demo.heading}</h2>
        <p>
          {t.settings.demo.intro}
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-foreground/90 p-3 text-xs text-background">
          npm run db:reset
        </pre>
        <p className="mt-2">
          Новые отели, аватары с устройства и права пользователей сейчас работают как интерактивный демо-прототип в браузере.
        </p>
      </section>
    </div>
  );
}
