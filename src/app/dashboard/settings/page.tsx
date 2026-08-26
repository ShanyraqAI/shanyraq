import { db, getCurrentHotelId } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { AccountForm } from "@/components/account/account-form";
import { requireUser } from "@/lib/auth/session";
import { t } from "@/lib/i18n";

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

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">{t.account.title}</h2>
        <AccountForm
          initial={{
            fullName: user.fullName,
            avatarUrl: user.avatarUrl ?? "",
            email: user.email,
            phone: user.phone,
          }}
        />
      </section>

      <SettingsForm
        initial={{
          name: hotel.name,
          address: hotel.address,
          city: hotel.city,
          country: hotel.country,
          timezone: hotel.timezone,
          currency: hotel.currency,
        }}
      />

      <section className="max-w-2xl rounded-xl border border-dashed bg-secondary/30 p-5 text-sm text-muted-foreground">
        <h2 className="mb-1 font-semibold text-foreground">{t.settings.demo.heading}</h2>
        <p>
          {t.settings.demo.intro}
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-foreground/90 p-3 text-xs text-background">
          npm run db:reset
        </pre>
        <p className="mt-2">
          {t.settings.demo.outro}
        </p>
      </section>
    </div>
  );
}
