import { db, getCurrentHotelId } from "@/lib/db";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/settings/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const hotelId = await getCurrentHotelId();
  const hotel = await db.hotel.findUniqueOrThrow({ where: { id: hotelId } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hotel settings"
        description="Property profile used across Shanyraq and pushed to channels."
      />
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
        <h2 className="mb-1 font-semibold text-foreground">Demo environment</h2>
        <p>
          This MVP runs on a local database with simulated channel providers. To restore the original demo
          dataset at any time run:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-foreground/90 p-3 text-xs text-background">
          npm run db:reset
        </pre>
        <p className="mt-2">
          Authentication, multi-user roles and encrypted credential storage are planned for the next stage —
          all server actions already validate input and are structured around a single tenant boundary.
        </p>
      </section>
    </div>
  );
}
