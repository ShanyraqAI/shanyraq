import { db, getCurrentHotelId } from "@/lib/db";
import { addDays, today, toISODate } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { RatesBoard, type DailyRateVM } from "@/components/rates/rates-board";
import type { RatePlanVM } from "@/lib/types";
import { t } from "@/lib/i18n";
import { requireSectionAccess } from "@/server/guards";

export const dynamic = "force-dynamic";

const HORIZON = 14;

export default async function RatesPage() {
  await requireSectionAccess("RATES");
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
  const dailyRates: Record<string, DailyRateVM[]> = {};
  for (const plan of plansRaw) {
    const typeName = roomTypes.find((t) => t.id === plan.roomTypeId)?.name ?? "";
    planVMs.push({
      id: plan.id,
      sequenceNumber: plan.sequenceNumber,
      name: plan.name,
      roomTypeId: plan.roomTypeId,
      roomTypeName: typeName,
      basePrice: Number(plan.basePrice),
      currency: plan.currency,
      refundable: plan.refundable,
      breakfastIncluded: plan.breakfastIncluded,
      availableToday: availabilityToday.find((a) => a.roomTypeId === plan.roomTypeId)?.availableRooms ?? null,
    });
    const byDate = new Map(allRates.filter((r) => r.ratePlanId === plan.id).map((r) => [toISODate(r.date), r]));
    dailyRates[plan.id] = dates.map((date) => {
      const rate = byDate.get(date);
      return {
        price: rate ? Number(rate.price) : null,
        minStay: rate?.minStay ?? 1,
        minStayType: rate?.minStayType === "THROUGH" ? "THROUGH" : "ARRIVAL",
        maxStay: rate?.maxStay ?? null,
        stopSell: rate?.stopSell ?? false,
        closedToArrival: rate?.closedToArrival ?? false,
        closedToDeparture: rate?.closedToDeparture ?? false,
      };
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.rates.title}
        description={t.rates.description(HORIZON)}
      />
      <RatesBoard
        plans={planVMs}
        dates={dates}
        dailyRates={dailyRates}
        roomTypes={roomTypes.map((roomType) => ({ id: roomType.id, name: roomType.name }))}
      />
    </div>
  );
}
