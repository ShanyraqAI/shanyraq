import { db, getCurrentHotelId } from "@/lib/db";
import { addDays, today, toISODate } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { RatesBoard } from "@/components/rates/rates-board";
import type { RatePlanVM } from "@/lib/types";
import { t } from "@/lib/i18n";
import { requireSectionAccess } from "@/server/guards";

export const dynamic = "force-dynamic";

const HORIZON = 14;

export default async function RatesPage() {
  await requireSectionAccess("FULL");
  const hotelId = await getCurrentHotelId();
  const start = today();

  const [plansRaw, roomTypes, availabilityToday] = await Promise.all([
    db.ratePlan.findMany({ where: { hotelId }, orderBy: [{ roomTypeId: "asc" }, { basePrice: "asc" }] }),
    db.roomType.findMany({ where: { hotelId }, orderBy: { sortOrder: "asc" } }),
    db.availability.findMany({ where: { hotelId, date: start } }),
  ]);

  const dates = Array.from({ length: HORIZON }, (_, i) => toISODate(addDays(start, i)));
  const planIds = plansRaw.map((p) => p.id);
  const allRates = planIds.length
    ? await db.rate.findMany({
        where: { ratePlanId: { in: planIds }, date: { gte: start, lt: addDays(start, HORIZON) } },
        orderBy: { date: "asc" },
      })
    : [];

  const planVMs: (RatePlanVM & { availableToday: number | null })[] = [];
  const prices: Record<string, (number | null)[]> = {};
  for (const plan of plansRaw) {
    const typeName = roomTypes.find((t) => t.id === plan.roomTypeId)?.name ?? "";
    planVMs.push({
      id: plan.id,
      name: plan.name,
      roomTypeId: plan.roomTypeId,
      roomTypeName: typeName,
      basePrice: plan.basePrice,
      currency: plan.currency,
      refundable: plan.refundable,
      breakfastIncluded: plan.breakfastIncluded,
      availableToday: availabilityToday.find((a) => a.roomTypeId === plan.roomTypeId)?.availableRooms ?? null,
    });
    const byDate = new Map(allRates.filter((r) => r.ratePlanId === plan.id).map((r) => [toISODate(r.date), r.price]));
    prices[plan.id] = dates.map((d) => byDate.get(d) ?? null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.rates.title}
        description={t.rates.description(HORIZON)}
      />
      <RatesBoard plans={planVMs} dates={dates} prices={prices} roomTypes={roomTypes} />
    </div>
  );
}
